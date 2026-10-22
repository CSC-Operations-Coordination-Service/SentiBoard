/* A small typed fetch wrapper for the SentiBoard backend (FastAPI, contract in api/openapi.json,
   types generated into ./schema.d.ts by `pnpm gen:api`). Ported from the prototype's
   src/api/client.ts; server-only, because the base URL comes from BACKEND_URL.

   Every failure surfaces as an ApiError, so pages need one catch and one switch on `kind`:
     · "unreachable" — the request never got an answer: network error, timeout, or a gateway
                       answering 502-504 because the backend behind it is down.
     · "http"        — the backend answered with a non-2xx status.
     · "parse"       — the backend answered 2xx with a body that is not JSON. */

import "server-only";
import type { paths } from "./schema";

/** A hung backend must degrade the page, not hold the request open. */
const TIMEOUT_MS = 10_000;

/** Base URL for every call, e.g. http://localhost:8000. Read per call so a missing variable fails
 *  the request (degraded state), not the module import. */
function backendUrl(): string {
  const url = process.env.BACKEND_URL;
  if (!url) throw new Error("BACKEND_URL is not set (see .env.sample)");
  return url.replace(/\/+$/, "");
}

export type ApiErrorKind = "unreachable" | "http" | "parse";

export class ApiError extends Error {
  /** The underlying error (fetch's TypeError, the JSON SyntaxError), when there is one. */
  readonly cause?: unknown;

  constructor(
    readonly kind: ApiErrorKind,
    readonly url: string,
    readonly status?: number,
    cause?: unknown,
  ) {
    super(
      kind === "unreachable"
        ? `Backend unreachable (${url})`
        : kind === "http"
          ? `Backend returned HTTP ${status} (${url})`
          : `Backend returned a body that is not JSON (${url})`,
    );
    this.name = "ApiError";
    this.cause = cause;
  }
}

/** Statuses a proxy or gateway answers with when the backend behind it is down. */
const GATEWAY_DOWN = new Set([502, 503, 504]);

/** Paths that answer GET, as the contract declares them. */
export type GetPath = {
  [P in keyof paths]: paths[P] extends { get: object } ? P : never;
}[keyof paths];

/** The JSON body a GET on `P` answers 200 with. */
export type GetResponse<P extends GetPath> = paths[P] extends {
  get: { responses: { 200: { content: { "application/json": infer T } } } };
}
  ? T
  : never;

/** Query parameters a GET on `P` accepts. */
export type GetQuery<P extends GetPath> = paths[P] extends {
  get: { parameters: { query?: infer Q } };
}
  ? NonNullable<Q>
  : never;

function buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const s = qs.toString();
  return `${backendUrl()}${path}${s ? `?${s}` : ""}`;
}

/** GET a path from the contract and return its typed JSON body. Throws ApiError on failure. */
export async function apiGet<P extends GetPath>(
  path: P,
  query?: GetQuery<P>,
): Promise<GetResponse<P>> {
  const url = buildUrl(path, query as Record<string, string | number | undefined>);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Caching is decided by the caller's "use cache" scope, not by fetch.
      cache: "no-store",
    });
  } catch (err) {
    throw new ApiError("unreachable", url, undefined, err);
  }

  if (!res.ok) {
    throw new ApiError(GATEWAY_DOWN.has(res.status) ? "unreachable" : "http", url, res.status);
  }

  try {
    return (await res.json()) as GetResponse<P>;
  } catch (err) {
    throw new ApiError("parse", url, res.status, err);
  }
}
