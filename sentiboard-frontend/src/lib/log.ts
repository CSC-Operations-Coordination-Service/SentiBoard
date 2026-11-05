/* Server-side logger. In production every record is ONE line of JSON, so the log pipeline
   (Docker → Alloy → Loki) sees a level, a logger name and the trace it belongs to, instead of
   free text it labels "unk". Elsewhere (dev, tests) it prints readable text.

     {"time":"…","level":"error","logger":"processors","msg":"could not load releases",
      "trace_id":"…","span_id":"…","err":{"name":"ApiError","message":"…","kind":"unreachable"}}

   Settings (server-only env): LOG_LEVEL = debug | info | warn | error (default info);
   LOG_FORMAT = json | text (default json when NODE_ENV=production, text otherwise).
   Writes go through console.* (info/debug → stdout, warn/error → stderr), so Next's own output
   and test spies on console keep working. Not for client components: they log to the browser.

   installConsoleBridge() (called at server start, src/instrumentation.ts) turns every other
   console.* call on the server — a stray console.log, a library, Next's own messages — into the
   same JSON lines, logger "console". */

import { format } from "node:util";
import { trace } from "@opentelemetry/api";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): number {
  const v = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  return RANK[v ?? "info"] ?? RANK.info;
}

function jsonFormat(): boolean {
  const f = process.env.LOG_FORMAT?.toLowerCase();
  return f ? f === "json" : process.env.NODE_ENV === "production";
}

/** An Error as plain fields: name, message, stack, the extra fields an ApiError carries
 *  (kind, url, status) and the cause chain. Anything else is passed through as is. */
export function serializeError(err: unknown, depth = 0): unknown {
  if (!(err instanceof Error)) return err;
  const out: LogFields = { name: err.name, message: err.message };
  for (const key of ["kind", "url", "status", "digest", "code"] as const) {
    const v = (err as unknown as LogFields)[key];
    if (v !== undefined) out[key] = v;
  }
  if (err.stack) out.stack = err.stack;
  if (err.cause !== undefined && depth < 3) out.cause = serializeError(err.cause, depth + 1);
  return out;
}

/** The current span's ids, so a log line links to its trace. Empty when tracing is off. */
function traceFields(): LogFields {
  const ctx = trace.getActiveSpan()?.spanContext();
  if (!ctx || !trace.isSpanContextValid(ctx)) return {};
  return { trace_id: ctx.traceId, span_id: ctx.spanId };
}

function write(level: LogLevel, logger: string, msg: string, fields?: LogFields): void {
  if (RANK[level] < minLevel()) return;
  const extra: LogFields = {};
  for (const [k, v] of Object.entries(fields ?? {})) extra[k] = k === "err" ? serializeError(v) : v;

  // The console's own methods once the bridge has replaced them, or this would loop.
  const out = originalConsole() ?? console;
  const sink = level === "error" ? out.error : level === "warn" ? out.warn : level === "debug" ? out.debug : out.info;

  if (jsonFormat()) {
    const record = { time: new Date().toISOString(), level, logger, msg, ...traceFields(), ...extra };
    let line: string;
    try {
      line = JSON.stringify(record);
    } catch {
      line = JSON.stringify({ time: record.time, level, logger, msg, note: "fields not serializable" });
    }
    sink(line);
    return;
  }
  const { err, ...rest } = extra;
  const tail = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
  const errText = err && typeof err === "object" ? `\n${(err as LogFields).stack ?? (err as LogFields).message}` : "";
  sink(`[${logger}] ${msg}${tail}${errText}`);
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
}

/** A logger named after the part of the app it speaks for: logger("processors"). */
export function logger(name: string): Logger {
  return {
    debug: (msg, fields) => write("debug", name, msg, fields),
    info: (msg, fields) => write("info", name, msg, fields),
    warn: (msg, fields) => write("warn", name, msg, fields),
    error: (msg, fields) => write("error", name, msg, fields),
  };
}

/* --- console bridge ------------------------------------------------------------------------- */

type ConsoleMethod = "log" | "info" | "debug" | "warn" | "error";

/** Which level each console method logs at. console.log is ordinary output: info. */
const BRIDGED: Record<ConsoleMethod, LogLevel> = {
  log: "info",
  info: "info",
  debug: "debug",
  warn: "warn",
  error: "error",
};

/** The console's methods as they were before the bridge, while it is installed. Kept on
 *  globalThis, not in this module: Next bundles instrumentation.ts and the pages into separate
 *  module graphs, each with its own copy of this file, and the copy a page logs through must
 *  still find them (seen in a production build: its lines were wrapped twice). */
const ORIGINAL = Symbol.for("sentiboard.log.originalConsole");
type GlobalWithConsole = typeof globalThis & { [ORIGINAL]?: Pick<Console, ConsoleMethod> };

function originalConsole(): Pick<Console, ConsoleMethod> | undefined {
  return (globalThis as GlobalWithConsole)[ORIGINAL];
}

// Colour codes, and the symbol Next puts before its own messages ("⨯ Error: …", "⚠ …", "✓ …").
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const NEXT_PREFIX = /^\s*[○⨯⚠▲✓»]\s*/;
/** Loki refuses lines over 256 KB by default; a huge dumped object is cut well before that. */
const MAX_MSG = 32_000;

function bridge(level: LogLevel, args: unknown[]): void {
  // The first Error goes to `err` (name, message, stack: one line, not one entry per stack
  // frame); the other arguments make the message, with console.log's own formatting (%s, %o…).
  const at = args.findIndex((a) => a instanceof Error);
  const err = at >= 0 ? (args[at] as Error) : undefined;
  const rest = at >= 0 ? args.filter((_, i) => i !== at) : args;
  let msg = (rest.length ? format(...rest) : "").replace(ANSI, "").replace(NEXT_PREFIX, "").trim();
  if (!msg && err) msg = err.message;
  if (!msg) return; // a blank line: Next prints some around its banner and its errors

  const fields: LogFields = {};
  if (err) fields.err = err;
  if (msg.length > MAX_MSG) {
    msg = msg.slice(0, MAX_MSG);
    fields.truncated = true;
  }
  write(level, "console", msg, fields);
}

/**
 * Routes every server-side console.log/info/debug/warn/error through the logger, so they reach
 * Loki as JSON lines with a level and the trace id instead of free text. Only in JSON format
 * (production by default): in dev the console stays as it is. Idempotent; returns a function that
 * puts the console back (for tests).
 */
export function installConsoleBridge(): () => void {
  if (originalConsole() || !jsonFormat()) return () => {};
  const saved = {
    log: console.log,
    info: console.info,
    debug: console.debug,
    warn: console.warn,
    error: console.error,
  };
  (globalThis as GlobalWithConsole)[ORIGINAL] = saved;
  for (const [method, level] of Object.entries(BRIDGED) as [ConsoleMethod, LogLevel][]) {
    console[method] = (...args: unknown[]) => {
      try {
        bridge(level, args);
      } catch {
        saved[method](...args); // never lose a line because formatting it failed
      }
    };
  }
  return () => {
    Object.assign(console, saved);
    delete (globalThis as GlobalWithConsole)[ORIGINAL];
  };
}
