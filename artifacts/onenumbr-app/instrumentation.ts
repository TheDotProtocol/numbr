// =============================================================================
// OneNumbr — Server instrumentation (Prompt 10)
//
// Runs once when the Next.js server boots. Responsibilities:
//   1. Enforce the provider-mode guard (lib/features.ts): production may not
//      run mock financial/identity providers without the explicit
//      ONENUMBR_ALLOW_DEMO_IN_PRODUCTION acknowledgement, and development may
//      not activate real providers. Failure here is a hard boot failure —
//      exactly the point.
//   2. Register the monitoring provider when one is configured (none today —
//      the no-op from lib/monitoring.ts remains active).
//
// Build-time note: `next build` executes instrumentation for prerendering;
// enforcement is skipped during that phase (NEXT_PHASE) so a production build
// succeeds before an operator has configured runtime env vars.
// =============================================================================

export async function register(): Promise<void> {
  // Only meaningful in the Node.js server runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  const { assertProviderModeAllowed, getEnvironmentMode } = await import("@/lib/features");
  const { logger } = await import("@/lib/logger");

  if (isBuildPhase) {
    logger.info("provider_mode_check_skipped_build_phase", { environment: getEnvironmentMode() });
    return;
  }

  // Hard gate: throws (→ boot failure) on a disallowed provider/mode combo.
  for (const domain of ["payment", "telecom", "esim", "identity"] as const) {
    assertProviderModeAllowed(domain);
  }

  logger.info("provider_mode_check_passed", {
    environment: getEnvironmentMode(),
    domains: ["payment", "telecom", "esim", "identity"],
  });

  // Future: registerMonitoringProvider(new SentryProvider(...)) once a
  // monitoring integration lands. See lib/monitoring.ts for the contract.
}
