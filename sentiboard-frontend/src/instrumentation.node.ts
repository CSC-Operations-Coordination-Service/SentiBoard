/* OpenTelemetry for the Node.js server, loaded by src/instrumentation.ts. Off unless an OTLP
   endpoint is configured, so local runs and tests export nothing.

   Configuration is the standard OTEL_* environment, read by the SDK itself:
     OTEL_EXPORTER_OTLP_ENDPOINT   e.g. http://alloy:4318 (required to turn telemetry on)
     OTEL_EXPORTER_OTLP_PROTOCOL   http/protobuf (default) | http/json | grpc
     OTEL_SERVICE_NAME             default "sentiboard-frontend"
     OTEL_RESOURCE_ATTRIBUTES      e.g. deployment.environment.name=prod,service.version=1.2.3
     OTEL_TRACES_SAMPLER(_ARG)     e.g. parentbased_traceidratio / 0.25 (default: every trace)
     OTEL_METRIC_EXPORT_INTERVAL   ms, default 60000
     OTEL_SDK_DISABLED=true        kill switch

   What it sends:
     · traces — Next's own spans: one root span per request ("GET /events") with render,
       metadata and backend-fetch children (NEXT_OTEL_VERBOSE=1 for more);
     · metrics — Node runtime: heap used/limit per V8 space, GC duration, event-loop delay and
       utilization. A heap creeping towards its limit shows here hours before an OOM kill. */

import { getHeapStatistics } from "node:v8";
import { RuntimeNodeInstrumentation } from "@opentelemetry/instrumentation-runtime-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { logger } from "@/lib/log";

const log = logger("telemetry");

const ENDPOINT_VARS = [
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
  "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT",
];

export function startTelemetry(): void {
  const heapLimitMb = Math.round(getHeapStatistics().heap_size_limit / 1048576);
  const disabled = process.env.OTEL_SDK_DISABLED?.toLowerCase() === "true";
  const configured = ENDPOINT_VARS.some((k) => process.env[k]);
  const enabled = configured && !disabled;

  // One line per start: the heap limit is the first thing to know when reading an OOM.
  log.info("server starting", { node: process.version, heap_limit_mb: heapLimitMb, otel: enabled });
  if (!enabled) return;

  try {
    const sdk = new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME || "sentiboard-frontend",
      instrumentations: [new RuntimeNodeInstrumentation()],
    });
    sdk.start();
    // Best effort: flush what is buffered when the container is stopped.
    process.once("SIGTERM", () => {
      sdk.shutdown().catch((err) => log.warn("telemetry shutdown failed", { err }));
    });
  } catch (err) {
    // Telemetry must never keep the site from starting.
    log.error("telemetry could not start; serving without it", { err });
  }
}
