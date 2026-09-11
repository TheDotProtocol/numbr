// =============================================================================
// OneNumbr — Provider abstraction model (Prompt 15)
//
// Reads the provider architecture into a coherent model that the readiness
// layer can reason about without leaking vendor specifics to clients.
//
// Principles (do not violate):
//   1. OneNumbr is the product — providers are replaceable infrastructure.
//   2. Numbering, connectivity and communications are separate concerns that
//      a single vendor may eventually implement, but the domain model must
//      not require it.
//   3. A provider capability is a declared contract, not an inferred trait.
//   4. Provider refs (ICCID, IMSI, subscriber id, SIP account, carrier ref)
//      are connectivity identifiers — never the OneNumbr number.
//   5. The +1739 OneNumbr numbering abstraction is application-level and is
//      NOT represented as an officially assigned PSTN country code.
// =============================================================================

// ---------------------------------------------------------------------------
// Provider categories
// ---------------------------------------------------------------------------

/** The broad family a provider belongs to. A vendor may implement more than
 *  one in the future, but each interface answers a different question. */
export type ProviderCategory =
  | "cloud_telephony"   // voice/SMS over cloud APIs, no SIM
  | "pstn"              // public switched telephone network carrier
  | "sip"               // SIP trunk/endpoint
  | "esim"              // eSIM profile + connectivity
  | "mno"               // mobile network operator
  | "mvno"             // mobile virtual network operator
  | "connectivity_aggregator" // wholesale connectivity (eSIM/MNO/SIM) from one API surface
  | "physical_sim";     // physical SIM inventory + activation

// ---------------------------------------------------------------------------
// Capability flags — declared, not inferred
// ---------------------------------------------------------------------------

/** Capabilities a provider explicitly signs up to provide. Do not infer
 *  capabilities from the provider name or category. */
export type ProviderCapability =
  | "numbering"     // number inventory, reservation, assignment, release
  | "voice"         // outbound + inbound voice
  | "sms"           // outbound + inbound text
  | "mms"           // media messaging
  | "data"          // data access (connectivity layer concern)
  | "esim"          // eSIM profile lifecycle
  | "physical_sim"  // physical SIM lifecycle
  | "roaming"       // international roaming
  | "sip"           // SIP trunk/endpoint
  | "pstn"          // PSTN routing/connectivity
  | "webhooks"      // signed webhook event delivery
  | "portability"   // number portability where supported

export type ProviderCapabilitySet = Readonly<Record<ProviderCapability, boolean>>;

// ---------------------------------------------------------------------------
// Cross-domain interface tags — which Prompt-layer surface the provider
// satisfies. A single configured vendor may satisfy several.
// ---------------------------------------------------------------------------

export type ProviderInterface =
  | "numbering"       // TelecomProvider-style number operations (Prompt 4)
  | "connectivity"    // ConnectivityProvider-style lifecycle (Prompt 14)
  | "communications"; // CommunicationsProvider-style call/message/voicemail (Prompt 11)

// ---------------------------------------------------------------------------
// Provider environment + availability
// ---------------------------------------------------------------------------

/** The environment the provider is operating in. A real production provider
 *  that has not been configured for production is not "live" yet. */
export type ProviderEnvironment = "demo" | "sandbox" | "production";

/** Honest availability — what the customer/system can actually use today. */
export type ProviderAvailability =
  | "demo"            // working demo/mock behavior
  | "sandbox"         // vendor sandbox reachable, not production traffic
  | "live"           // production provider, configured and authorized
  | "disabled";       // feature flag or configuration keeps it off

// ---------------------------------------------------------------------------
// Provider configuration state (status only — never the credentials)
// ---------------------------------------------------------------------------

/** Honest status a configured provider may report for ops/health. Do not
 *  expose credential values, tokens, or secrets. */
export type ProviderConfigState =
  | "not_configured"       // no provider slot exists or no env expected
  | "missing_credentials"  // provider expected but required env absent
  | "invalid_credentials"  // provider reachable but auth failing
  | "sandbox_only"         // configured, but only sandbox access
  | "production_ready"     // configured, authorized, intended for production traffic
  | "disabled";            // administratively or flag-disabled

// ---------------------------------------------------------------------------
// Provider error normalization
// ---------------------------------------------------------------------------

/** OneNumbr domain errors that a provider adapter must map its raw errors
 *  into. Raw provider messages must NOT leak through to customers. */
export type ProviderErrorCode =
  | "provider_auth_failed"
  | "provider_rate_limited"
  | "provider_temporarily_unavailable"
  | "provider_unavailable"
  | "provider_unsupported"
  | "provider_configuration_error"
  | "provider_number_unavailable"
  | "provider_provisioning_failed"
  | "provider_activation_failed"
  | "provider_termination_failed"
  | "provider_timeout"
  | "provider_duplicate_request"
  | "provider_unknown";

/** How to treat the error for retry/exposure decisions. */
export type ProviderErrorCategory =
  | "transient"      // safe to retry with backoff
  | "permanent"      // do not retry automatically
  | "authentication" // credentials/configuration problem
  | "rate_limited"   // wait and retry
  | "not_found"      // resource does not exist
  | "conflict"       // idempotent conflict, likely already done
  | "unsupported";   // capability/region/operation not supported

// ---------------------------------------------------------------------------
// Provider event model (webhook foundation)
// ---------------------------------------------------------------------------

/** Optional normalized webhook event envelope concept for future provider
 *  integration. A real provider webhook handler normalizes first, then emits
 *  OneNumbr domain audit events — never mutating customer data directly. */
export type ProviderEventEnvelope = {
  /** Provider's own event id — used for idempotency dedup. */
  providerEventId: string;
  /** Provider event type, before normalization. */
  providerEventType: string;
  /** Provider category that emitted it. */
  providerCategory: ProviderCategory;
  /** When the provider says it happened (validated, replay-protected). */
  occurredAt: string;
  /** When OneNumbr received it. */
  receivedAt: string;
  /** Stable target identifier the provider was about (connection / number / endpoint). */
  targetRef: string;
  /** Raw payload is never exposed to clients; this is admin/internal only. */
  normalized?: ProviderEventNormalized;
};

export type ProviderEventNormalized =
  | { kind: "connectivity.provisioning_started"; connectionId: string }
  | { kind: "connectivity.activated"; connectionId: string }
  | { kind: "connectivity.suspended"; connectionId: string }
  | { kind: "connectivity.resumed"; connectionId: string }
  | { kind: "connectivity.terminated"; connectionId: string }
  | { kind: "connectivity.failed"; connectionId: string; reason: string }
  | { kind: "communications.call_started"; callId: string }
  | { kind: "communications.call_answered"; callId: string }
  | { kind: "communications.call_ended"; callId: string; durationSeconds: number }
  | { kind: "communications.message_delivered"; messageId: string }
  | { kind: "communications.message_failed"; messageId: string; reason: string }
  | { kind: "number.assigned"; numberId: string }
  | { kind: "number.released"; numberId: string };

// ---------------------------------------------------------------------------
// Provider metadata — registry surface
// ---------------------------------------------------------------------------

export type ProviderMetadata = {
  readonly id: string;
  readonly displayName: string;
  readonly category: ProviderCategory;
  readonly environment: ProviderEnvironment;
  readonly availability: ProviderAvailability;
  readonly configState: ProviderConfigState;
  readonly interfaces: readonly ProviderInterface[];
  readonly capabilities: ProviderCapabilitySet;
  readonly regions: readonly string[];
  /** What the provider needs configured before it can operate (ops/docs). */
  readonly configurationRequirements: readonly string[];
  /** Stable OneNumbr-facing note — never credential details. */
  readonly note: string;
};

// ---------------------------------------------------------------------------
// Provider health / reliability model (observability, not fabricated stats)
// ---------------------------------------------------------------------------

export type ProviderHealthSnapshot = {
  providerId: string;
  lastSuccessfulOperation: string | null; // ISO timestamp, null if none measured
  lastFailure: string | null;
  failureReason: string | null;            // normalized category only
  status: "available" | "degraded" | "unavailable" | "not_measured";
  /** Honest note for ops; never fabricated numbers. */
  note: string;
};

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/** Default-empty capability set (everything false). */
// Default-empty capability set (everything false). Public so callers can
// create capability sets without importing the private builder in lib/provider-registry.
export function emptyCapabilities(): ProviderCapabilitySet {
  return {} as ProviderCapabilitySet;
}

export const ALL_CAPABILITIES: readonly ProviderCapability[] = [
  "numbering",
  "voice",
  "sms",
  "mms",
  "data",
  "esim",
  "physical_sim",
  "roaming",
  "sip",
  "pstn",
  "webhooks",
  "portability",
] as const;

/** Provider can service the requested capability. */
export function providerSupports(
  provider: Pick<ProviderMetadata, "capabilities">,
  capability: ProviderCapability,
): boolean {
  return Boolean(provider.capabilities[capability]);
}

/** Provider can satisfy at least one of the requested interfaces. */
export function providerSupportsAnyInterface(
  provider: Pick<ProviderMetadata, "interfaces">,
  interfaces: readonly ProviderInterface[],
): boolean {
  return interfaces.some((i) => provider.interfaces.includes(i));
}
