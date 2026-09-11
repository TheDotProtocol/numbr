// =============================================================================
// OneNumbr — Trust & safety registry (Prompt 16)
//
// Read-only description surface for future spam/abuse/anti-automation providers,
// in the same style as the Prompt 15 provider readiness registry. It describes
// providers — it does not enable a real one, it does not store credentials, and it
// does not make live spam/abuse/automation claims.
//
// In this release every provider slot is demo/disabled/legacy-infra-only, and the
// only honest operational protection is the Prompt 10 basic abuse-resistant design.
// =============================================================================

import { getFeatureFlags, getEnvironmentMode } from "./features";
import type {
  TrustAndSafetyAvailability,
  TrustAndSafetyCategory,
  TrustAndSafetyCapability,
  TrustAndSafetyCapabilitySet,
  TrustAndSafetyConfigState,
  TrustAndSafetyEnvironment,
  TrustAndSafetyInterface,
  TrustAndSafetyProviderMetadata,
} from "@/types/trust-and-safety";
import { emptyTrustAndSafetyCapabilities } from "@/types/trust-and-safety";

// Safe builder (mirror of Prompt 15 capability builder).
function buildCapabilities(partial: Partial<Record<TrustAndSafetyCapability, boolean>>) {
  const map: Record<TrustAndSafetyCapability, boolean> = {} as Record<TrustAndSafetyCapability, boolean>;
  const ALL: readonly TrustAndSafetyCapability[] = [
    "inbound_spam_classification",
    "inbound_abuse_classification",
    "outbound_spam_prevention",
    "outbound_abuse_prevention",
    "sender_reputation",
    "committer_reputation",
    "device_reputation",
    "endpoint_reputation",
    "account_reputation",
    "rate_intelligence",
    "behavior_detection",
    "abuse_evidence_capture",
    "block_allowlisting",
    "quarantine",
    "policy_enforcement",
    "incident_detection",
    "incident_management",
    "verification_challenge",
    "telemetry_ingestion",
  ];
  for (const k of ALL) map[k] = false;
  for (const [k, v] of Object.entries(partial)) if (k in map) map[k as TrustAndSafetyCapability] = v as boolean;
  return map as TrustAndSafetyCapabilitySet;
}

// ---------------------------------------------------------------------------
// Registry metadata — declarative provider descriptions
// ---------------------------------------------------------------------------

const REGISTRY: readonly TrustAndSafetyProviderMetadata[] = [
  // Prompt 10 basic abuse-resistant design as the existing protection layer.
  {
    id: "prompt10_basic_controls",
    displayName: "OneNumbr Basic Abuse-Resistant Controls",
    category: "rate_control",
    environment: "demo",
    availability: "live",
    configState: "production_ready",
    interfaces: ["trust_and_safety", "rate_control"] as const,
    capabilities: buildCapabilities({
      rate_intelligence: true,
      behavior_detection: false,
      abuse_evidence_capture: false,
      block_allowlisting: false,
      quarantine: false,
      policy_enforcement: false,
      incident_detection: false,
      incident_management: false,
      verification_challenge: false,
      inbound_spam_classification: false,
      inbound_abuse_classification: false,
      outbound_spam_prevention: false,
      outbound_abuse_prevention: false,
      sender_reputation: false,
      committer_reputation: false,
      device_reputation: false,
      endpoint_reputation: false,
      account_reputation: false,
      telemetry_ingestion: false,
    }),
    regions: ["*"],
    configurationRequirements: [],
    note: "Existing basic abuse-resistant controls (Prompt 10): rate limiting, safe errors, ownership checks, audit and request IDs. This is not a spam filter, reputation engine or anti-automation challenge provider.",
  },
  // Future spam filter boundary
  {
    id: "spam-filter-future",
    displayName: "Future Spam Filter Provider",
    category: "spam_filter",
    environment: "sandbox",
    availability: "disabled",
    configState: "not_configured",
    interfaces: ["trust_and_safety", "inbound_filter", "outbound_guard"] as const,
    capabilities: buildCapabilities({
      inbound_spam_classification: true,
      inbound_abuse_classification: true,
      outbound_spam_prevention: true,
      outbound_abuse_prevention: true,
      abuse_evidence_capture: true,
      quarantine: true,
      block_allowlisting: true,
      policy_enforcement: true,
      incident_detection: true,
    }),
    regions: ["*"],
    configurationRequirements: [
      "Signed provider agreement + API credentials + webhook configuration + regulatory review for the target market(s)",
    ],
    note: "Not configured. Would provide inbound/outbound spam and abuse classification with quarantine/block/allow-listing and policy enforcement.",
  },
  // Future abuse handler boundary
  {
    id: "abuse-handler-future",
    displayName: "Future Abuse Handler Provider",
    category: "abuse_handler",
    environment: "sandbox",
    availability: "disabled",
    configState: "not_configured",
    interfaces: ["trust_and_safety", "inbound_filter", "outbound_guard"] as const,
    capabilities: buildCapabilities({
      inbound_abuse_classification: true,
      outbound_abuse_prevention: true,
      abuse_evidence_capture: true,
      quarantine: true,
      block_allowlisting: true,
      policy_enforcement: true,
      incident_management: true,
      incident_detection: true,
    }),
    regions: ["*"],
    configurationRequirements: [
      "Signed provider agreement + API credentials + webhook configuration + abuse-evidence retention/privacy review",
    ],
    note: "Not configured. Would provide abuse classification, evidence capture, quarantine/block handling and incident management.",
  },
  // Future rate-control / anti-automation boundary
  {
    id: "anti-automation-future",
    displayName: "Future Anti-Automation Provider",
    category: "anti_automation",
    environment: "sandbox",
    availability: "disabled",
    configState: "not_configured",
    interfaces: ["trust_and_safety", "rate_control", "verification_challenge"] as const,
    capabilities: buildCapabilities({
      rate_intelligence: true,
      behavior_detection: true,
      verification_challenge: true,
      account_reputation: true,
      device_reputation: true,
      endpoint_reputation: true,
      committer_reputation: true,
    }),
    regions: ["*"],
    configurationRequirements: [
      "Signed provider agreement + API credentials + webhook configuration + privacy/verification review",
    ],
    note: "Not configured. Would provide richer rate/behavior intelligence and anti-automation challenge/proof. No live CAPTCHA-style vendor is integrated today.",
  },
  // Future reputation boundary
  {
    id: "reputation-service-future",
    displayName: "Future Reputation Service",
    category: "reputation_service",
    environment: "sandbox",
    availability: "disabled",
    configState: "not_configured",
    interfaces: ["trust_and_safety", "outbound_guard", "rate_control"] as const,
    capabilities: buildCapabilities({
      sender_reputation: true,
      committer_reputation: true,
      device_reputation: true,
      endpoint_reputation: true,
      account_reputation: true,
      outbound_spam_prevention: true,
      outbound_abuse_prevention: true,
      rate_intelligence: true,
    }),
    regions: ["*"],
    configurationRequirements: [
      "Signed provider agreement + API credentials + privacy/reputation-data review",
    ],
    note: "Not configured. Would provide sender/committer/device/endpoint/account reputation signals.",
  },
  // Future incident manager boundary
  {
    id: "incident-manager-future",
    displayName: "Future Incident Manager",
    category: "incident_manager",
    environment: "sandbox",
    availability: "disabled",
    configState: "not_configured",
    interfaces: ["trust_and_safety"] as const,
    capabilities: buildCapabilities({
      incident_detection: true,
      incident_management: true,
      abuse_evidence_capture: true,
      policy_enforcement: true,
    }),
    regions: ["*"],
    configurationRequirements: [
      "Signed provider agreement + API credentials + webhook configuration + incident/privacy review",
    ],
    note: "Not configured. Would provide incident detection, management and evidence capture.",
  },
  // Future verification/challenge boundary
  {
    id: "verification-challenge-future",
    displayName: "Future Verification / Challenge Provider",
    category: "verifier_challenge",
    environment: "sandbox",
    availability: "disabled",
    configState: "not_configured",
    interfaces: ["trust_and_safety", "verification_challenge"] as const,
    capabilities: buildCapabilities({
      verification_challenge: true,
      behavior_detection: false,
    }),
    regions: ["*"],
    configurationRequirements: [
      "Signed provider agreement + API credentials + privacy/regulatory review for any verification/challenge surface",
    ],
    note: "Not configured. Would provide anti-automation challenge/proof. No live verification-challenge vendor is integrated today.",
  },
  // Future telemetry sink boundary (provider-side analytics only, never a product surface)
  {
    id: "trust-and-safety-telemetry-future",
    displayName: "Future Trust & Safety Telemetry Sink",
    category: "telemetry_sink",
    environment: "sandbox",
    availability: "disabled",
    configState: "not_configured",
    interfaces: ["trust_and_safety"] as const,
    capabilities: buildCapabilities({
      telemetry_ingestion: true,
      incident_detection: false,
      abuse_evidence_capture: false,
    }),
    regions: ["*"],
    configurationRequirements: [
      "Signed provider agreement + API credentials + privacy/data-transfer review",
    ],
    note: "Not configured. Would be a provider-side telemetry sink only — never a customer-facing product surface and never a substitute for OneNumbr ownership/entitlement logic.",
  },
];

// ---------------------------------------------------------------------------
// Registry queries
// ---------------------------------------------------------------------------

export function listTrustAndSafetyProviders(): readonly TrustAndSafetyProviderMetadata[] {
  return REGISTRY;
}

export function getTrustAndSafetyProviderMetadata(id: string): TrustAndSafetyProviderMetadata | undefined {
  return REGISTRY.find((p) => p.id === id);
}

export function trustAndSafetyProvidersForInterface(
  iface: TrustAndSafetyInterface,
  options?: { includeFuture?: boolean },
): readonly TrustAndSafetyProviderMetadata[] {
  return REGISTRY.filter(
    (p) => p.interfaces.includes(iface) && (options?.includeFuture ? true : p.availability !== "disabled"),
  );
}

export function trustAndSafetyProvidersForCapability(
  capability: TrustAndSafetyCapability,
  options?: { includeFuture?: boolean },
): readonly TrustAndSafetyProviderMetadata[] {
  return REGISTRY.filter(
    (p) => p.capabilities[capability] && (options?.includeFuture ? true : p.availability !== "disabled"),
  );
}

// ---------------------------------------------------------------------------
// Configuration state + availability
// ---------------------------------------------------------------------------

export function trustAndSafetyConfigState(provider: TrustAndSafetyProviderMetadata): TrustAndSafetyConfigState {
  if (provider.availability === "disabled" && provider.environment === "sandbox") return "not_configured";
  if (provider.availability === "demo" && provider.environment === "demo") return "not_configured"; // intentional demo posture
  return "not_configured";
}

export function trustAndSafetyAvailability(provider: TrustAndSafetyProviderMetadata): TrustAndSafetyAvailability {
  if (provider.availability === "live") return "live";
  if (provider.availability === "demo") return "demo";
  if (provider.availability === "disabled") return "disabled";
  return "disabled";
}

// ---------------------------------------------------------------------------
// Health snapshots (honest: not_measured without real traffic)
// ---------------------------------------------------------------------------

export function trustAndSafetyProviderHealthSnapshot(
  provider: TrustAndSafetyProviderMetadata,
): {
  providerId: string;
  lastSuccessfulOperation: string | null;
  lastFailure: string | null;
  failureReason: string | null;
  status: "available" | "degraded" | "unavailable" | "not_measured";
  note: string;
} {
  if (provider.availability === "disabled") {
    return {
      providerId: provider.id,
      lastSuccessfulOperation: null,
      lastFailure: null,
      failureReason: null,
      status: "not_measured",
      note: "Not configured — no live trust-and-safety provider integration exists.",
    };
  }
  if (provider.availability === "demo") {
    return {
      providerId: provider.id,
      lastSuccessfulOperation: null,
      lastFailure: null,
      failureReason: null,
      status: "not_measured",
      note: "Demo/legacy control — no real trust-and-safety provider metrics are measured.",
    };
  }
  return {
    providerId: provider.id,
    lastSuccessfulOperation: null,
    lastFailure: null,
    failureReason: null,
    status: "not_measured",
    note: "Not measured — no production trust-and-safety provider traffic yet.",
  };
}

export function trustAndSafetyHealthSummary(): {
  providersDeclared: number;
  live: number;
  demo: number;
  disabled: number;
  configured: number;
  note: string;
} {
  const items = REGISTRY.map((p) => ({
    provider: p,
    availability: trustAndSafetyAvailability(p),
    configState: trustAndSafetyConfigState(p),
  }));
  const live = items.filter((i) => i.availability === "live").length;
  const demo = items.filter((i) => i.availability === "demo").length;
  const disabled = items.filter((i) => i.availability === "disabled").length;
  const configured = items.filter((i) => i.configState === "production_ready" || i.configState === "sandbox_only").length;
  return {
    providersDeclared: REGISTRY.length,
    live,
    demo,
    disabled,
    configured,
    note:
      live > 0
        ? `${live} live trust-and-safety provider(s) configured.`
        : demo > 0
          ? `No live trust-and-safety providers configured — ${demo} existing/basic control(s). Future spam/abuse/automation providers require explicit flags and credentials.`
          : "No trust-and-safety providers configured.",
  };
}

// ---------------------------------------------------------------------------
// Server-side selection (future real providers)
// ---------------------------------------------------------------------------

export type TrustAndSafetySelectionInput = {
  interface_: TrustAndSafetyInterface;
  capability?: TrustAndSafetyCapability;
  region?: string;
  allowFuture?: boolean;
};

export function selectTrustAndSafetyProvider(
  input: TrustAndSafetySelectionInput,
): TrustAndSafetyProviderMetadata | null {
  const candidates = REGISTRY.filter(
    (p) => {
      if (!p.interfaces.includes(input.interface_)) return false;
      if (!input.allowFuture && p.availability === "disabled") return false;
      if (input.capability && !p.capabilities[input.capability]) return false;
      if (input.region && input.region !== "*" && !p.regions.includes("*") && !p.regions.includes(input.region))
        return false;
      return true;
    },
  );
  const live = candidates.find((p) => trustAndSafetyAvailability(p) === "live");
  if (live) return live;
  // Existing basic controls can satisfy basic trust_and_safety/rate_control needs today.
  const existing = candidates.find(
    (p) => trustAndSafetyAvailability(p) === "live" || trustAndSafetyAvailability(p) === "demo",
  );
  if (existing && input.interface_ === "trust_and_safety") return existing;
  return null;
}

// ---------------------------------------------------------------------------
// Provider-mode description (Prompt 10 guard-aware)
// ---------------------------------------------------------------------------

export function describeTrustAndSafetyProviderMode(): {
  environment: ReturnType<typeof getEnvironmentMode>;
  real: boolean;
  allowed: boolean;
  reason: string;
} {
  const mode = getEnvironmentMode();
  const flags = getFeatureFlags();
  const realRequested =
    flags.trustAndSafetyEnabled &&
    (flags.inboundSpamFilterEnabled || flags.outboundGuardEnabled || flags.antiAutomationProviderEnabled ||
      flags.senderReputationEnabled || flags.abuseReportingEnabled || flags.incidentManagementEnabled ||
      flags.verificationChallengeEnabled);
  let allowed = true;
  let reason = "";
  if (mode === "production" && !realRequested) {
    reason = "Production mode — real trust-and-safety behavior requires explicit real-provider flags. No live spam/abuse/automation provider is configured.";
  } else if (mode === "development" && realRequested) {
    allowed = false;
    reason = "Refused: real trust-and-safety provider flags cannot be activated in development — set ONENUMBR_ENV=staging|production first.";
  } else {
    reason = "Development/staging — future trust-and-safety providers require explicit configuration and the Prompt 10 provider-mode guard.";
  }
  return { environment: mode, real: realRequested, allowed, reason };
}
