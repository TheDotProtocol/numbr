// =============================================================================
// OneNumbr — Cloud communications adapter factory (Prompt 17)
//
// Builds the FIRST REAL PROVIDER adapter from environment configuration. This
// is a VENDOR-NEUTRAL factory: no specific commercial provider is integrated,
// no credentials are invented, and no vendor relationship is claimed.
//
// Behavior:
//   - Without complete credentials + the feature flag, the adapter is
//     `not_configured`/`disabled` and INERT — the mock provider remains the
//     operational CommunicationsProvider.
//   - With credentials + flag, the adapter becomes `configured` but is still
//     NOT live until explicitly verified (healthCheck) and enabled through the
//     provider-mode guard in the target environment.
//   - Live paid operations additionally require sandbox/live configuration.
//
// COST SAFETY: this factory never performs a network call at construction.
// Health checks and sends happen only through explicit, flag-gated service
// calls. Development tests must not trigger real paid operations.
// =============================================================================

import { getFeatureFlags, getEnvironmentMode } from "@/lib/features";
import type { ProviderConfigState, ProviderEnvironment } from "@/types/provider";
import type {
  CloudCommunicationsAdapter,
  CloudCommunicationsAdapterStatus,
  CloudCommunicationsCapability,
  CloudCommunicationsCapabilitySet,
  CloudCommunicationsConfig,
  CloudCommunicationsCredentialRequirement,
  CloudCommunicationsNormalizedEvent,
} from "./types";
import { emptyCloudCommunicationsCapabilities } from "./types";

// ---------------------------------------------------------------------------
// Environment parsing helpers (server-only)
// ---------------------------------------------------------------------------

function env(name: string): string {
  return (typeof process !== "undefined" && process.env[name]) || "";
}

/**
 * Credential requirements for the first real provider slot.
 *
 * These are the GENERIC variable names for the cloud communications slot — a
 * concrete vendor adapter maps its own documented credential names onto these
 * at configuration time. Values are never logged or persisted.
 */
export const CLOUD_COMMUNICATIONS_CREDENTIALS: readonly CloudCommunicationsCredentialRequirement[] = [
  { envVar: "CLOUD_COMMS_PROVIDER_ID", purpose: "Registry id of the configured vendor", secret: false },
  { envVar: "CLOUD_COMMS_API_KEY", purpose: "Vendor API key / account identifier", secret: true },
  { envVar: "CLOUD_COMMS_API_SECRET", purpose: "Vendor API secret / auth token", secret: true },
  { envVar: "CLOUD_COMMS_WEBHOOK_SECRET", purpose: "Webhook signature verification secret", secret: true },
  { envVar: "CLOUD_COMMS_CAPABILITIES", purpose: "Comma-separated verified capabilities (voice,sms,mms,webhooks,numbering,pstn)", secret: false },
  { envVar: "CLOUD_COMMS_SANDBOX_MODE", purpose: "true = sandbox/test mode; live paid operations stay blocked", secret: false },
];

function parseCapabilities(raw: string): CloudCommunicationsCapabilitySet {
  const set: Record<CloudCommunicationsCapability, boolean> = {
    voice: false,
    sms: false,
    mms: false,
    webhooks: false,
    numbering: false,
    pstn: false,
  };
  const declared = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const c of declared) {
    if (c === "voice") set.voice = true;
    else if (c === "sms") set.sms = true;
    else if (c === "mms") set.mms = true;
    else if (c === "webhooks") set.webhooks = true;
    else if (c === "numbering") set.numbering = true;
    else if (c === "pstn") set.pstn = true;
  }
  return set;
}

/** Read the provider configuration from the environment (no credential values
 *  are ever returned — only presence and names). */
export function readCloudCommunicationsConfig(): CloudCommunicationsConfig {
  const providerId = env("CLOUD_COMMS_PROVIDER_ID") || null;
  const apiKeyPresent = Boolean(env("CLOUD_COMMS_API_KEY"));
  const apiSecretPresent = Boolean(env("CLOUD_COMMS_API_SECRET"));
  const webhookSecretPresent = Boolean(env("CLOUD_COMMS_WEBHOOK_SECRET"));
  const capabilities = parseCapabilities(env("CLOUD_COMMS_CAPABILITIES"));
  const sandboxRaw = env("CLOUD_COMMS_SANDBOX_MODE").toLowerCase();
  const sandboxMode = sandboxRaw === "true" || sandboxRaw === "1" || sandboxRaw === "yes";

  const configured = Boolean(providerId && apiKeyPresent && apiSecretPresent);
  return {
    providerId: configured ? providerId : null,
    credentials: CLOUD_COMMUNICATIONS_CREDENTIALS,
    capabilities: configured ? capabilities : emptyCloudCommunicationsCapabilities(),
    sandboxMode,
    webhookSecretEnvVar: webhookSecretPresent ? "CLOUD_COMMS_WEBHOOK_SECRET" : null,
  };
}

// ---------------------------------------------------------------------------
// The inert adapter — safe default when no real provider is configured
// ---------------------------------------------------------------------------

class NotConfiguredError extends Error {
  constructor(operation: string) {
    super(
      `[OneNumbr] Cloud communications provider is not configured; "${operation}" was refused. ` +
        `The mock provider remains the operational communications provider.`,
    );
    this.name = "NotConfiguredError";
  }
}

function buildInertAdapter(reason: string): CloudCommunicationsAdapter {
  const capabilities = emptyCloudCommunicationsCapabilities();
  return {
    adapterId: "cloud-comms-unconfigured",
    displayName: "Cloud Communications (not configured)",
    name: "cloud-comms-unconfigured",
    environment: "demo" as ProviderEnvironment,
    configState: "not_configured" as ProviderConfigState,
    capabilities,
    operational: false,
    credentialRequirements: CLOUD_COMMUNICATIONS_CREDENTIALS,

    // CommunicationsProvider contract — every live operation is refused honestly.
    async initiateCall() {
      throw new NotConfiguredError("initiateCall");
    },
    async updateCallStatus() {
      throw new NotConfiguredError("updateCallStatus");
    },
    async getCallStatus() {
      throw new NotConfiguredError("getCallStatus");
    },
    async endCall() {
      throw new NotConfiguredError("endCall");
    },
    async forwardCall() {
      throw new NotConfiguredError("forwardCall");
    },
    async sendMessage() {
      throw new NotConfiguredError("sendMessage");
    },
    async receiveMessage() {
      throw new NotConfiguredError("receiveMessage");
    },
    async getMessageStatus() {
      throw new NotConfiguredError("getMessageStatus");
    },
    async createVoicemail() {
      throw new NotConfiguredError("createVoicemail");
    },
    async getVoicemails() {
      throw new NotConfiguredError("getVoicemails");
    },
    async markVoicemailRead() {
      throw new NotConfiguredError("markVoicemailRead");
    },
    async getCallHistory() {
      throw new NotConfiguredError("getCallHistory");
    },
    async getMessageHistory() {
      throw new NotConfiguredError("getMessageHistory");
    },

    // Prompt 17 extensions — all honest refusals; no network, no cost.
    async healthCheck() {
      return {
        status: "not_configured" as CloudCommunicationsAdapterStatus,
        note: reason,
      };
    },
    async sendSmsIdempotent() {
      throw new NotConfiguredError("sendSmsIdempotent");
    },
    async initiateCallIdempotent() {
      throw new NotConfiguredError("initiateCallIdempotent");
    },
    normalizeWebhookEvent(): CloudCommunicationsNormalizedEvent | null {
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// The configured adapter — credential-driven, vendor mapping point
// ---------------------------------------------------------------------------

/**
 * Builds the configured adapter. THIS IS THE VENDOR MAPPING POINT: the concrete
 * vendor API calls belong in this closure. No vendor SDK is installed and no
 * vendor endpoint is called in this release — the methods below remain
 * explicit `unimplemented` boundaries until a vendor is selected and its
 * adapter body is filled in, so the integration compiles and is testable
 * WITHOUT any risk of paid operations.
 */
function buildConfiguredAdapter(config: CloudCommunicationsConfig): CloudCommunicationsAdapter {
  const flagAllowed = getFeatureFlags().cloudCommunicationsProviderEnabled;
  const mode = getEnvironmentMode();
  // Provider-mode guard (Prompt 10 semantics, preserved): the real adapter may
  // operate only in staging/production, never silently in development.
  const envAllowed = mode === "staging" || mode === "production";
  const operational = Boolean(flagAllowed && envAllowed && config.providerId);

  return {
    adapterId: config.providerId ?? "cloud-comms-configured",
    displayName: `Cloud Communications (${config.providerId ?? "configured"})`,
    name: config.providerId ?? "cloud-comms-configured",
    environment: (mode === "production" ? "production" : mode === "staging" ? "sandbox" : "demo") as ProviderEnvironment,
    configState: (operational ? "configured" : "disabled") as ProviderConfigState,
    capabilities: config.capabilities,
    operational,
    credentialRequirements: CLOUD_COMMUNICATIONS_CREDENTIALS,

    async initiateCall(input) {
      if (!operational) throw new NotConfiguredError("initiateCall");
      if (!config.capabilities.voice) {
        throw Object.assign(new Error("voice capability not configured for this provider"), {
          category: "unsupported",
          vendorCode: null,
        });
      }
      // VENDOR MAPPING POINT — outbound voice API call goes here (idempotent).
      throw Object.assign(new Error("Vendor voice integration not yet implemented"), {
        category: "unsupported",
        vendorCode: "onenumbr_vendor_not_implemented",
      });
    },

    async updateCallStatus() {
      if (!operational) throw new NotConfiguredError("updateCallStatus");
      // Engine-driven status transitions; vendor sync belongs here when live.
    },

    async getCallStatus(providerReference) {
      if (!operational) throw new NotConfiguredError("getCallStatus");
      throw Object.assign(new Error(`Vendor call status lookup not yet implemented (${providerReference})`), {
        category: "unsupported",
        vendorCode: "onenumbr_vendor_not_implemented",
      });
    },

    async endCall() {
      if (!operational) throw new NotConfiguredError("endCall");
      // Vendor call termination belongs here when live.
    },

    async forwardCall() {
      if (!operational) throw new NotConfiguredError("forwardCall");
      throw Object.assign(new Error("Vendor call forwarding not yet implemented"), {
        category: "unsupported",
        vendorCode: "onenumbr_vendor_not_implemented",
      });
    },

    async sendMessage(input) {
      if (!operational) throw new NotConfiguredError("sendMessage");
      if (!config.capabilities.sms) {
        throw Object.assign(new Error("sms capability not configured for this provider"), {
          category: "unsupported",
          vendorCode: null,
        });
      }
      // VENDOR MAPPING POINT — outbound SMS API call goes here (idempotent).
      // Trust & safety pre-send evaluation happens in the service layer BEFORE
      // this adapter method is reached.
      throw Object.assign(new Error("Vendor SMS integration not yet implemented"), {
        category: "unsupported",
        vendorCode: "onenumbr_vendor_not_implemented",
      });
    },

    async receiveMessage() {
      if (!operational) throw new NotConfiguredError("receiveMessage");
      // Inbound messages arrive via /api/webhooks/[provider]; nothing to do here.
      return { providerReference: "unavailable", createdAt: Date.now() };
    },

    async getMessageStatus(providerReference) {
      if (!operational) throw new NotConfiguredError("getMessageStatus");
      throw Object.assign(new Error(`Vendor message status lookup not yet implemented (${providerReference})`), {
        category: "unsupported",
        vendorCode: "onenumbr_vendor_not_implemented",
      });
    },

    async createVoicemail() {
      if (!operational) throw new NotConfiguredError("createVoicemail");
      // Voicemail stays an application-layer feature (Prompt 11) until a vendor
      // recording capability is configured.
      return { providerReference: "unavailable", createdAt: Date.now() };
    },

    async getVoicemails() {
      if (!operational) throw new NotConfiguredError("getVoicemails");
      return [];
    },

    async markVoicemailRead() {
      if (!operational) throw new NotConfiguredError("markVoicemailRead");
    },

    async getCallHistory() {
      if (!operational) throw new NotConfiguredError("getCallHistory");
      return [];
    },

    async getMessageHistory() {
      if (!operational) throw new NotConfiguredError("getMessageHistory");
      return [];
    },

    async healthCheck() {
      if (!operational) {
        return {
          status: (flagAllowed ? "disabled" : "not_configured") as CloudCommunicationsAdapterStatus,
          note: flagAllowed
            ? "Provider credentials present but the provider-mode guard refuses this environment."
            : "Provider credentials present; feature flag off — adapter inert.",
        };
      }
      // VENDOR MAPPING POINT — explicit health probe belongs here when live.
      // Until then: honest not_measured, never fabricated health.
      return {
        status: "not_measured" as CloudCommunicationsAdapterStatus,
        note: "Configured; no vendor health probe implemented yet — no fabricated metrics.",
      };
    },

    async sendSmsIdempotent(input) {
      if (!operational) throw new NotConfiguredError("sendSmsIdempotent");
      if (!config.capabilities.sms) {
        throw Object.assign(new Error("sms capability not configured for this provider"), {
          category: "unsupported",
          vendorCode: null,
        });
      }
      // Idempotency: durable dedup check goes here (see lib/webhooks-server.ts
      // durable-idempotency design) + vendor idempotency key forwarding.
      throw Object.assign(new Error("Vendor idempotent SMS not yet implemented"), {
        category: "unsupported",
        vendorCode: "onenumbr_vendor_not_implemented",
      });
    },

    async initiateCallIdempotent(input) {
      if (!operational) throw new NotConfiguredError("initiateCallIdempotent");
      if (!config.capabilities.voice) {
        throw Object.assign(new Error("voice capability not configured for this provider"), {
          category: "unsupported",
          vendorCode: null,
        });
      }
      throw Object.assign(new Error("Vendor idempotent voice not yet implemented"), {
        category: "unsupported",
        vendorCode: "onenumbr_vendor_not_implemented",
      });
    },

    normalizeWebhookEvent(input): CloudCommunicationsNormalizedEvent | null {
      // VENDOR MAPPING POINT — map vendor event names to normalized events.
      // Only events the vendor actually sends may be mapped; never invent.
      void input;
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Build the real cloud communications adapter for this environment.
 *  Returns an INERT adapter unless credentials + flag + environment allow. */
export function createCloudCommunicationsAdapter(): CloudCommunicationsAdapter {
  const config = readCloudCommunicationsConfig();
  if (!config.providerId) {
    return buildInertAdapter(
      "No cloud communications provider credentials are configured (CLOUD_COMMS_*). The mock provider remains operational.",
    );
  }
  return buildConfiguredAdapter(config);
}

/** Is the real provider slot configured AND allowed to operate here? */
export function isCloudCommunicationsOperational(): boolean {
  return createCloudCommunicationsAdapter().operational;
}
