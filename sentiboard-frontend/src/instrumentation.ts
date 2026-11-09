/* Next.js instrumentation hook (runs once per server start, before the first request).
   Telemetry setup lives in instrumentation.node.ts: the OpenTelemetry Node SDK cannot load in
   the edge runtime, so it is imported only under Node. */

import type { Instrumentation } from "next";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Every console.* call from here on is a JSON log line (production). Next prints its
    // "▲ Next.js … Ready" banner before this hook runs, so those few lines stay plain text.
    const { installConsoleBridge } = await import("@/lib/log");
    installConsoleBridge();
    const { startTelemetry } = await import("./instrumentation.node");
    startTelemetry();
  }
}

/** Every error Next catches while serving a request, as one structured log line with the route
 *  and the trace id. Pages that degrade on a backend failure don't throw, so they don't land here. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logger } = await import("@/lib/log");
  logger("request").error("request failed", {
    err,
    method: request.method,
    path: request.path,
    route: context.routePath,
    route_type: context.routeType,
    render_source: context.renderSource,
    revalidate_reason: context.revalidateReason,
  });
};
