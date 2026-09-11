// =============================================================================
// OneNumbr — Feature flags & environment mode (Prompt 10)
//
// ONE server-readable source of truth for what is enabled. Flags are
// environment-driven (no client trust) and drive BOTH the provider registry
// guard and the maintenance-mode middleware.
//
// Honest defaults: without an explicit production configuration the platform
// runs in development mode with mock providers — never silently pretending
// otherwise, and never letting a real provider activate without an explicit
// flag.
//
// Server-only: do not import from client components (it reads raw env vars
// that are not NEXT_PUBLIC and it is not bundled for the browser).
// =============================================================================

export type EnvironmentMode = "development" | "staging" | "production";

function env(name: string): string {
  return (typeof process !== "undefined" && process.env[name]) || "";
}

function truthy(name: string): boolean {
  const v = env(name).toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/** The environment OneNumbr is running in (drives provider + UX honesty). */
export function getEnvironmentMode(): EnvironmentMode {
  const v = env("ONENUMBR_ENV").toLowerCase();
  if (v === "production") return "production";
  if (v === "staging") return "staging";
  return "development";
}

export function isProduction(): boolean {
  return getEnvironmentMode() === "production";
}

// ---------------------------------------------------------------------------
// Feature flags (server-readable; the UI learns state via APIs, never flags)
// ---------------------------------------------------------------------------

export interface FeatureFlags {
  /** Manual KYC review (Prompt 2) — the implemented flow. */
  manualKyc: boolean;
  /** Future Sumsub identity provider. */
  sumsub: boolean;
  /** Mock payment provider (Prompt 5). */
  mockPayments: boolean;
  /** Future Stripe provider. */
  stripePayments: boolean;
  /** Mock telecom provider (Prompt 4). */
  mockTelecom: boolean;
  /** Future real carrier integration. */
  realTelecom: boolean;
  /** Mock eSIM provider (Prompt 3). */
  mockEsim: boolean;
  /** Future real eSIM provider. */
  realEsim: boolean;
  /** Platform-wide maintenance screen (bypassed for staff). */
  maintenanceMode: boolean;
  /** Per-domain maintenance switches. */
  maintenanceBilling: boolean;
  maintenanceEsim: boolean;
  maintenanceNumber: boolean;
  maintenanceSupport: boolean;
  /** Real 2FA provider (Prompt 6 ships the placeholder only). */
  twoFactor: boolean;
  /** Future product analytics. */
  analytics: boolean;
  /** In-app live chat (not built). */
  supportChat: boolean;
  // --- Communications (Prompt 11) ---
  /** Communications domain (calls/messages/voicemail/routing/endpoints). */
  communicationsEnabled: boolean;
  /** Voice — demo/mock provider only in this release. */
  voiceEnabled: boolean;
  /** Messaging — demo/mock provider only in this release. */
  messagingEnabled: boolean;
  /** Voicemail — demo/mock provider only in this release. */
  voicemailEnabled: boolean;
  /** Connectivity abstraction (eSIM today). */
  connectivityEnabled: boolean;
  /** Future PSTN adapter — requires a legitimate carrier arrangement. */
  pstnEnabled: boolean;
  /** Future TauCore integration boundary. */
  tauCoreIntegrationEnabled: boolean;
  // --- Endpoints (Prompt 12) ---
  /** Endpoint layer (registration, lifecycle, routing simulation). */
  endpointsEnabled: boolean;
  /** TauPhone demo endpoint registration. */
  tauPhoneEndpointEnabled: boolean;
  /** TauTalk demo endpoint registration. */
  tauTalkEndpointEnabled: boolean;
  /** Explicit-update presence (no heartbeats). */
  endpointPresenceEnabled: boolean;
  /** Endpoint routing simulation. */
  endpointRoutingEnabled: boolean;
  // --- Global Plan & entitlements (Prompt 13) ---
  /** Global Plan domain (catalog, subscription linkage, entitlements). */
  globalPlanEnabled: boolean;
  /** Entitlement gates on communications/endpoints operations. */
  entitlementsEnabled: boolean;
  // --- Connectivity service layer (Prompt 14) ---
  /** Cloud connectivity mechanism (current demo reality). */
  connectivityCloudEnabled: boolean;
  /** Future MNO mechanism — off until a carrier agreement exists. */
  connectivityMnoEnabled: boolean;
  /** Future MVNO mechanism — off until a host agreement exists. */
  connectivityMvnoEnabled: boolean;
  /** Future REAL TauCore integration (auth, identity linking). */
  realTauCoreIntegrationEnabled: boolean;
  /** Future physical SIM infrastructure. */
  physicalSimEnabled: boolean;
  // --- Provider readiness (Prompt 15) ---
  /** Provider-readiness/registry surface (describes providers; never enables a real one). */
  providerReadinessEnabled: boolean;
  /** Honest provider health/availability reporting at `/api/health`. */
  providerHealthReportingEnabled: boolean;
  /** Real cloud-telephony provider (Prompt 15 boundary). */
  realCloudTelephonyEnabled: boolean;
  /** Real eSIM provider (Prompt 15 boundary). */
  realEsimProviderEnabled: boolean;
  /** Real MNO provider. */
  realMnoEnabled: boolean;
  /** Real MVNO provider. */
  realMvnoEnabled: boolean;
  /** Real physical SIM provider. */
  realPhysicalSimEnabled: boolean;
  /** Real PSTN provider. */
  realPstnEnabled: boolean;
  /** Webhook verification/normalization/idempotency framework (Prompt 15). */
  webhookArchitectureEnabled: boolean;
  // --- Trust & safety (Prompt 16) ---
  /** Trust & safety surface is present as a readiness layer; it does not mean live spam/abuse protection. */
  trustAndSafetyEnabled: boolean;
  /** Real inbound spam/abuse filter — off until a real provider is configured. */
  inboundSpamFilterEnabled: boolean;
  /** Real outbound guard — off until a real provider is configured. */
  outboundGuardEnabled: boolean;
  /** Real anti-automation / behavior-detection provider — off until configured. */
  antiAutomationProviderEnabled: boolean;
  /** Real sender/committer reputation provider — off until configured. */
  senderReputationEnabled: boolean;
  /** Real abuse-reporting pipeline — off until configured. */
  abuseReportingEnabled: boolean;
  /** Real incident management provider — off until configured. */
  incidentManagementEnabled: boolean;
  /** Real verification/challenge provider (anti-automation) — off until configured. */
  verificationChallengeEnabled: boolean;
  // --- First real provider integration (Prompt 17) ---
  /** Real cloud communications provider (vendor configured via CLOUD_COMMS_*). Default OFF — never silently enabled. */
  cloudCommunicationsProviderEnabled: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    manualKyc: truthy("FEATURE_MANUAL_KYC") || true, // default on — implemented
    sumsub: truthy("FEATURE_SUMSUB"),
    mockPayments: !truthy("FEATURE_STRIPE_PAYMENTS"), // on unless Stripe is on
    stripePayments: truthy("FEATURE_STRIPE_PAYMENTS"),
    mockTelecom: !truthy("FEATURE_REAL_TELECOM"),
    realTelecom: truthy("FEATURE_REAL_TELECOM"),
    mockEsim: !truthy("FEATURE_REAL_ESIM"),
    realEsim: truthy("FEATURE_REAL_ESIM"),
    maintenanceMode: truthy("FEATURE_MAINTENANCE_MODE"),
    maintenanceBilling: truthy("FEATURE_MAINTENANCE_BILLING"),
    maintenanceEsim: truthy("FEATURE_MAINTENANCE_ESIM"),
    maintenanceNumber: truthy("FEATURE_MAINTENANCE_NUMBER"),
    maintenanceSupport: truthy("FEATURE_MAINTENANCE_SUPPORT"),
    twoFactor: truthy("FEATURE_TWO_FACTOR"),
    analytics: truthy("FEATURE_ANALYTICS"),
    supportChat: truthy("FEATURE_SUPPORT_CHAT"),
    // Communications defaults per Prompt 11: domain on; voice/messaging/
    // voicemail on FOR DEMO ONLY; PSTN and TauCore strictly off.
    communicationsEnabled: !truthy("FEATURE_COMMUNICATIONS_DISABLED"),
    voiceEnabled: !truthy("FEATURE_VOICE_DISABLED"),
    messagingEnabled: !truthy("FEATURE_MESSAGING_DISABLED"),
    voicemailEnabled: !truthy("FEATURE_VOICEMAIL_DISABLED"),
    connectivityEnabled: !truthy("FEATURE_CONNECTIVITY_DISABLED"),
    pstnEnabled: truthy("FEATURE_PSTN_ENABLED"),
    tauCoreIntegrationEnabled: truthy("FEATURE_TAUCORE_ENABLED"),
    // Endpoints (Prompt 12): demo adapters on; real TauCore off.
    endpointsEnabled: !truthy("FEATURE_ENDPOINTS_DISABLED"),
    tauPhoneEndpointEnabled: !truthy("FEATURE_TAUPHONE_ENDPOINT_DISABLED"),
    tauTalkEndpointEnabled: !truthy("FEATURE_TAUTALK_ENDPOINT_DISABLED"),
    endpointPresenceEnabled: !truthy("FEATURE_ENDPOINT_PRESENCE_DISABLED"),
    endpointRoutingEnabled: !truthy("FEATURE_ENDPOINT_ROUTING_DISABLED"),
    realTauCoreIntegrationEnabled: truthy("FEATURE_REAL_TAUCORE_ENABLED"),
    physicalSimEnabled: truthy("FEATURE_PHYSICAL_SIM_ENABLED"),
    // Global Plan (Prompt 13): on; entitlement gates on by default.
    globalPlanEnabled: !truthy("FEATURE_GLOBAL_PLAN_DISABLED"),
    entitlementsEnabled: !truthy("FEATURE_ENTITLEMENTS_DISABLED"),
    // Connectivity service layer (Prompt 14): cloud demo on; carriers off.
    connectivityCloudEnabled: !truthy("FEATURE_CONNECTIVITY_CLOUD_DISABLED"),
    connectivityMnoEnabled: truthy("FEATURE_CONNECTIVITY_MNO_ENABLED"),
    connectivityMvnoEnabled: truthy("FEATURE_CONNECTIVITY_MVNO_ENABLED"),
    // Provider readiness (Prompt 15): the readiness/registry surface is always
    // available (it describes providers — it never enables a real one).
    providerReadinessEnabled: true,
    providerHealthReportingEnabled: true,
    // Real-provider activation flags — all off by default.
    realCloudTelephonyEnabled: false,
    realEsimProviderEnabled: false,
    realMnoEnabled: false,
    realMvnoEnabled: false,
    realPhysicalSimEnabled: false,
    realPstnEnabled: false,
    // Webhook architecture (Prompt 15) — the verification/normalization/
    // idempotency framework is always available; actual provider webhooks
    // require a configured provider and a real-provider flag.
    webhookArchitectureEnabled: true,
    // --- Trust & safety (Prompt 16) ---
    /** Trust & safety surface is present as a readiness layer; it does not mean live spam/abuse protection. */
    trustAndSafetyEnabled: true,
    /** Real inbound spam/abuse filter — off until a real provider is configured. */
    inboundSpamFilterEnabled: false,
    /** Real outbound guard — off until a real provider is configured. */
    outboundGuardEnabled: false,
    /** Real anti-automation / behavior-detection provider — off until configured. */
    antiAutomationProviderEnabled: false,
    /** Real sender/committer reputation provider — off until configured. */
    senderReputationEnabled: false,
    /** Real abuse-reporting pipeline — off until configured. */
    abuseReportingEnabled: false,
    /** Real incident management provider — off until configured. */
    incidentManagementEnabled: false,
    /** Real verification/challenge provider (anti-automation) — off until configured. */
    verificationChallengeEnabled: false,
    // First real provider (Prompt 17): OFF by default; enabling is an explicit,
    // intentional act after the provider is configured and tested.
    cloudCommunicationsProviderEnabled: truthy("FEATURE_CLOUD_COMMUNICATIONS_PROVIDER_ENABLED"),
  };
}

/**
 * Guard: refuse to boot server contexts where production runs on mock
 * financial/identity providers without the explicit mock flag. This makes
 * "accidentally charging demo money in prod" impossible and "accidentally
 * calling a real provider from dev" impossible.
 */
export function assertProviderModeAllowed(provider: "payment" | "telecom" | "esim" | "identity"): void {
  const mode = getEnvironmentMode();
  const flags = getFeatureFlags();
  const realRequested =
    (provider === "payment" && flags.stripePayments) ||
    (provider === "telecom" && flags.realTelecom) ||
    (provider === "esim" && flags.realEsim) ||
    (provider === "identity" && flags.sumsub);
  const mockActive =
    (provider === "payment" && flags.mockPayments) ||
    (provider === "telecom" && flags.mockTelecom) ||
    (provider === "esim" && flags.mockEsim) ||
    (provider === "identity" && !flags.sumsub);

  if (mode === "production" && mockActive && !realRequested) {
    // Allowed ONLY with the explicit demo-mode acknowledgement flag.
    if (env("ONENUMBR_ALLOW_DEMO_IN_PRODUCTION").toLowerCase() !== "true") {
      throw new Error(
        `[OneNumbr] Refusing to run ${provider} on a MOCK provider in production. ` +
          `Set the real-provider feature flag, or set ONENUMBR_ALLOW_DEMO_IN_PRODUCTION=true ` +
          `to explicitly acknowledge demo mode.`,
      );
    }
  }

  if (mode === "development" && realRequested) {
    throw new Error(
      `[OneNumbr] Refusing to activate the REAL ${provider} provider in development. ` +
        `Set ONENUMBR_ENV=staging|production first.`,
    );
  }
}
