type ServiceName = "api" | "workers";

let sentryClient: { captureException(error: unknown): void } | null = null;
let tracingStarted = false;

export async function startObservability(serviceName: ServiceName): Promise<void> {
  await startSentry(serviceName);
  await startTracing(serviceName);
}

export function captureException(error: unknown): void {
  sentryClient?.captureException(error);
}

async function startSentry(serviceName: ServiceName): Promise<void> {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  const sentry = await import("@sentry/node");
  sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    serverName: `movex-${serviceName}`,
  });
  sentryClient = sentry;
}

async function startTracing(serviceName: ServiceName): Promise<void> {
  if (tracingStarted || process.env.OTEL_ENABLED === "false") {
    return;
  }

  const [{ NodeSDK }, { getNodeAutoInstrumentations }, { OTLPTraceExporter }, { resourceFromAttributes }, { ATTR_SERVICE_NAME }] = await Promise.all([
    import("@opentelemetry/sdk-node"),
    import("@opentelemetry/auto-instrumentations-node"),
    import("@opentelemetry/exporter-trace-otlp-http"),
    import("@opentelemetry/resources"),
    import("@opentelemetry/semantic-conventions"),
  ]);

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: `movex-${serviceName}` }),
    traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  tracingStarted = true;

  process.once("SIGTERM", () => {
    void sdk.shutdown();
  });
}
