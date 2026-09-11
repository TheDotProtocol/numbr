// =============================================================================
// OneNumbr — Monitoring extension point (Prompt 10)
//
// Interface + no-op implementation for a future monitoring provider
// (Sentry / Datadog / OpenTelemetry). NO provider is integrated: nothing here
// sends data anywhere. When a real provider arrives, register it once in the
// server bootstrap — call sites do not change.
//
// Integration contract for the future provider:
//   1. Implement `MonitoringProvider` (captureException / captureMessage /
//      addBreadcrumb / isConfigured).
//   2. Call `registerMonitoringProvider(impl)` once in the server entrypoint.
//   3. Everything already routed through `getMonitoring()` starts reporting.
// =============================================================================

export interface MonitoringBreadcrumb {
  message: string;
  category?: string;
  level?: "info" | "warn" | "error";
  data?: Record<string, unknown>;
}

export interface MonitoringProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  captureException(err: unknown, context?: Record<string, unknown>): void;
  captureMessage(
    message: string,
    level: "info" | "warn" | "error",
    context?: Record<string, unknown>,
  ): void;
  addBreadcrumb(breadcrumb: MonitoringBreadcrumb): void;
}

const noopProvider: MonitoringProvider = {
  name: "noop",
  isConfigured: false,
  captureException: () => undefined,
  captureMessage: () => undefined,
  addBreadcrumb: () => undefined,
};

let activeProvider: MonitoringProvider = noopProvider;

/** Register a real monitoring provider once at server bootstrap. */
export function registerMonitoringProvider(provider: MonitoringProvider): void {
  activeProvider = provider;
}

/** Access the active provider (defaults to the no-op). */
export function getMonitoring(): MonitoringProvider {
  return activeProvider;
}
