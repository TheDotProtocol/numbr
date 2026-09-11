// =============================================================================
// OneNumbr — Trust & safety abstraction model (Prompt 16)
//
// Spam / abuse / anti-automation is ANOTHER replaceable infrastructure layer
// beneath OneNumbr identity, number, plan, communications and endpoints.
//
// Principles (do not violate):
//   1. OneNumbr is the product; trust-and-safety providers are replaceable
//      infrastructure.
//   2. Trust-and-safety decisions never redefine the OneNumbr identity, number,
//      plan, communications or endpoints.
//   3. Capabilities are declared, never inferred from provider names.
//   4. No live spam filter / reputation engine / anti-automation provider / inbound
//      channel exists today — this is architecture + readiness only.
//   5. Provider secrets/credentials never live in the registry, health, admin UI or
//      Customer 360.
// =============================================================================

// ---------------------------------------------------------------------------
// Provider categories
// ---------------------------------------------------------------------------

export type TrustAndSafetyCategory =
  | "spam_filter"
  | "abuse_handler"
  | "rate_control"
  | "anti_automation"
  | "reputation_service"
  | "incident_manager"
  | "verifier_challenge"
  | "telemetry_sink"; // future provider-side analytics only, not a product surface

// ---------------------------------------------------------------------------
// Capability flags — declared explicitly
// ---------------------------------------------------------------------------

export type TrustAndSafetyCapability =
  | "inbound_spam_classification"
  | "inbound_abuse_classification"
  | "outbound_spam_prevention"
  | "outbound_abuse_prevention"
  | "sender_reputation"
  | "committer_reputation"
  | "device_reputation"
  | "endpoint_reputation"
  | "account_reputation"
  | "rate_intelligence"
  | "behavior_detection"
  | "abuse_evidence_capture"
  | "block_allowlisting"
  | "quarantine"
  | "policy_enforcement"
  | "incident_detection"
  | "incident_management"
  | "verification_challenge"
  | "telemetry_ingestion";

export type TrustAndSafetyCapabilitySet = Readonly<Record<TrustAndSafetyCapability, boolean>>;

// ---------------------------------------------------------------------------
// Cross-domain interfaces
// ---------------------------------------------------------------------------

export type TrustAndSafetyInterface =
  | "trust_and_safety"     // general spam/abuse/automation signals + decisions
  | "inbound_filter"       // inbound message/communication classification + disposition
  | "outbound_guard"       // outbound safety checks before sending
  | "rate_control"         // richer rate/behavior decisions beyond Prompt 10
  | "verification_challenge"; // anti-automation challenge/proof (future)

// ---------------------------------------------------------------------------
// Provider environment + availability
// ---------------------------------------------------------------------------

export type TrustAndSafetyEnvironment = "demo" | "sandbox" | "production";
export type TrustAndSafetyAvailability = "demo" | "sandbox" | "live" | "disabled";
export type TrustAndSafetyConfigState =
  | "not_configured"
  | "missing_credentials"
  | "invalid_credentials"
  | "sandbox_only"
  | "production_ready"
  | "disabled";

// ---------------------------------------------------------------------------
// Provider metadata — registry surface
// ---------------------------------------------------------------------------

export type TrustAndSafetyProviderMetadata = {
  readonly id: string;
  readonly displayName: string;
  readonly category: TrustAndSafetyCategory;
  readonly environment: TrustAndSafetyEnvironment;
  readonly availability: TrustAndSafetyAvailability;
  readonly configState: TrustAndSafetyConfigState;
  readonly interfaces: readonly TrustAndSafetyInterface[];
  readonly capabilities: TrustAndSafetyCapabilitySet;
  readonly regions: readonly string[];
  readonly configurationRequirements: readonly string[];
  readonly note: string;
};

// ---------------------------------------------------------------------------
// Disposition model (future inbound/outbound decisions)
// ---------------------------------------------------------------------------

export type TrustAndSafetyDisposition =
  | { kind: "allow" }
  | { kind: "flag"; reason: string }
  | { kind: "quarantine"; reason: string }
  | { kind: "block"; reason: string }
  | { kind: "escalate"; reason: string };

export type TrustAndSafetyDecision = {
  providerId: string;
  decision: TrustAndSafetyDisposition;
  /** Stable id the provider used for this decision — used for dedup/audit. */
  decisionRef: string;
  /** Honest timestamp the platform applied the decision. */
  appliedAt: string;
  /** Customer-reachable note only when appropriate — never raw provider signals. */
  customerNote: string | null;
};

// ---------------------------------------------------------------------------
// Provider event model (inbound/outbound/telemetry foundation)
// ---------------------------------------------------------------------------

export type TrustAndSafetyProviderEventEnvelope = {
  readonly providerEventId: string;
  readonly providerEventType: string;
  readonly providerCategory: TrustAndSafetyCategory;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly targetRef: string;
  readonly normalized?: TrustAndSafetyProviderEventNormalized;
};

export type TrustAndSafetyProviderEventNormalized =
  | { kind: "inbound.message_classified"; messageId: string; disposition: TrustAndSafetyDisposition }
  | { kind: "inbound.communication_classified"; communicationId: string; disposition: TrustAndSafetyDisposition }
  | { kind: "outbound.guard_decision"; outgoingRef: string; disposition: TrustAndSafetyDisposition }
  | { kind: "rate.risk_decision"; subjectRef: string; disposition: TrustAndSafetyDisposition }
  | { kind: "behavior.suspected"; subjectRef: string; reason: string }
  | { kind: "incident.created"; incidentRef: string }
  | { kind: "incident.updated"; incidentRef: string }
  | { kind: "verification.challenge_requested"; subjectRef: string }
  | { kind: "verification.challenge_completed"; subjectRef: string };

// ---------------------------------------------------------------------------
// Provider error normalization
// ---------------------------------------------------------------------------

export type TrustAndSafetyProviderErrorCode =
  | "provider_auth_failed"
  | "provider_rate_limited"
  | "provider_temporarily_unavailable"
  | "provider_unavailable"
  | "provider_unsupported"
  | "provider_configuration_error"
  | "provider_unknown";

export function emptyTrustAndSafetyCapabilities(): TrustAndSafetyCapabilitySet {
  return {} as TrustAndSafetyCapabilitySet;
}
