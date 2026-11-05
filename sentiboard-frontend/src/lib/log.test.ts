import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api/client";
import { installConsoleBridge, logger, serializeError } from "./log";

vi.mock("server-only", () => ({}));

let info: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
let debug: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  debug = vi.spyOn(console, "debug").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("logger — JSON format", () => {
  beforeEach(() => vi.stubEnv("LOG_FORMAT", "json"));

  it("writes one line of JSON with time, level, logger and fields", () => {
    logger("processors").info("loaded", { count: 3 });
    expect(info).toHaveBeenCalledOnce();
    const line = info.mock.calls[0][0] as string;
    expect(line).not.toContain("\n");
    const rec = JSON.parse(line);
    expect(rec).toMatchObject({ level: "info", logger: "processors", msg: "loaded", count: 3 });
    expect(new Date(rec.time).toString()).not.toBe("Invalid Date");
  });

  it("serializes an error under `err`, with an ApiError's kind, url and status, on one line", () => {
    const err = new ApiError("http", "http://backend/processor/", 500);
    logger("processors").error("could not load releases", { err });
    const line = error.mock.calls[0][0] as string;
    expect(line).not.toContain("\n");
    expect(JSON.parse(line).err).toMatchObject({
      name: "ApiError",
      kind: "http",
      url: "http://backend/processor/",
      status: 500,
    });
  });

  it("has no trace ids when tracing is off", () => {
    logger("x").info("m");
    expect(JSON.parse(info.mock.calls[0][0] as string)).not.toHaveProperty("trace_id");
  });

  it("survives fields that cannot be serialized", () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    logger("x").info("m", { loop });
    expect(JSON.parse(info.mock.calls[0][0] as string)).toMatchObject({ msg: "m" });
  });
});

describe("logger — levels and text format", () => {
  it("drops records below LOG_LEVEL (default info)", () => {
    logger("x").debug("hidden");
    expect(debug).not.toHaveBeenCalled();
    vi.stubEnv("LOG_LEVEL", "debug");
    logger("x").debug("shown");
    expect(debug).toHaveBeenCalledOnce();
  });

  it("prints readable text outside production", () => {
    vi.stubEnv("LOG_FORMAT", "text");
    logger("events").info("excluded 3 records", { ids: ["a"] });
    expect(info.mock.calls[0][0]).toBe('[events] excluded 3 records {"ids":["a"]}');
  });
});

describe("installConsoleBridge", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let restore: () => void = () => {};

  // The spies installed in beforeEach are what the bridge saves as "the console's own methods",
  // so what reaches them is exactly what would reach stdout/stderr.
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("LOG_FORMAT", "json");
    restore = installConsoleBridge();
  });
  afterEach(() => restore());

  const lastJson = (spy: ReturnType<typeof vi.spyOn>) =>
    JSON.parse(spy.mock.calls.at(-1)![0] as string) as Record<string, unknown>;

  it("turns console.log into one info line from logger 'console', with printf formatting", () => {
    console.log("loaded %d records from %s", 3, "backend");
    expect(lastJson(info)).toMatchObject({ level: "info", logger: "console", msg: "loaded 3 records from backend" });
  });

  it("puts an Error under `err` and keeps its stack on the same line", () => {
    console.error("could not render", new TypeError("boom"));
    const line = error.mock.calls.at(-1)![0] as string;
    expect(line).not.toContain("\n");
    expect(JSON.parse(line)).toMatchObject({
      level: "error",
      msg: "could not render",
      err: { name: "TypeError", message: "boom" },
    });
    expect((JSON.parse(line).err as { stack: string }).stack).toContain("TypeError: boom");
  });

  it("strips colours and Next's prefix, and uses the error's message when nothing else is said", () => {
    console.error("\u001b[31m\u001b[1m⨯\u001b[22m\u001b[39m", new Error("render failed"));
    expect(lastJson(error)).toMatchObject({ msg: "render failed", err: { message: "render failed" } });
    console.warn("\u001b[33m⚠\u001b[39m slow fetch");
    expect(lastJson(warn)).toMatchObject({ level: "warn", msg: "slow fetch" });
  });

  it("drops blank lines", () => {
    console.error("");
    console.log("\n");
    expect(error).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("does not wrap the logger's own lines a second time", () => {
    logger("processors").warn("3 releases not shown");
    expect(lastJson(warn)).toMatchObject({ logger: "processors", msg: "3 releases not shown" });
  });

  it("does not wrap lines from another copy of the module either (Next bundles one per graph)", async () => {
    vi.resetModules();
    const other = await import("./log");
    other.logger("events").warn("from the page bundle");
    expect(lastJson(warn)).toMatchObject({ logger: "events", msg: "from the page bundle" });
  });

  it("cuts a huge message", () => {
    console.log("x".repeat(50_000));
    const rec = lastJson(info);
    expect((rec.msg as string).length).toBe(32_000);
    expect(rec.truncated).toBe(true);
  });

  it("is idempotent, and the returned function puts the console back", () => {
    const patched = console.log;
    expect(installConsoleBridge()).toBeTypeOf("function");
    expect(console.log).toBe(patched);
    restore();
    expect(console.log).not.toBe(patched);
    restore = () => {};
  });
});

describe("installConsoleBridge in text format", () => {
  it("leaves the console alone", () => {
    vi.stubEnv("LOG_FORMAT", "text");
    const before = console.log;
    installConsoleBridge()();
    expect(console.log).toBe(before);
  });
});

describe("serializeError", () => {
  it("follows the cause chain", () => {
    const err = new Error("outer", { cause: new TypeError("inner") });
    expect(serializeError(err)).toMatchObject({ message: "outer", cause: { name: "TypeError", message: "inner" } });
  });

  it("passes non-errors through", () => {
    expect(serializeError("plain")).toBe("plain");
  });
});
