// =============================================================================
// OneNumbr — Reference trust-and-safety test provider (Prompt 16)
//
// A deterministic test provider for the trust-and-safety contract, in the same
// spirit as the Prompt 15 reference connectivity provider. It is test/seed-only
// and never reaches a network.
//
// It lets contract tests exercise:
//   - inbound classification (allow/flag/quarantine/block/escalate)
//   - outbound guard decisions
//   - anti-automation behavior detection
//   - abuse report ingestion
//
// IMPORTANT: not imported by application servers by default.
// =============================================================================

import type {
  TrustAndSafetyCategory,
  TrustAndSafetyCapability,
  TrustAndSafetyCapabilitySet,
  TrustAndSafetyInterface,
  TrustAndSafetyProviderMetadata,
} from "@/types/trust-and-safety";

// ---------------------------------------------------------------------------
// Reference provider config
// ---------------------------------------------------------------------------

export type ReferenceTrustAndSafetyConfig = {
  id: string;
  name: string;
  category: TrustAndSafetyCategory;
  behavior:
    | "classify_flag"
    | "classify_block"
    | "classify_allow"
    | "classify_escalate"
    | "classify_quarantine"
    | "outbound_allow"
    | "outbound_throttle"
    | "outbound_reject"
    | "behavior_flag"
    | "behavior_restrict"
    | "always_allow"
    | "unsupported"
    | "transient_failure";
  /** Interfaces the reference provider declares. */
  interfaces: readonly TrustAndSafetyInterface[];
  /** Capabilities the reference provider declares. */
  capabilities: readonly TrustAndSafetyCapability[];
  regions?: readonly string[];
};

function capabilitySet(capabilities: readonly TrustAndSafetyCapability[]): TrustAndSafetyCapabilitySet {
  const set = {} as Record<TrustAndSafetyCapability, boolean>;
  for (const c of capabilities) set[c] = true;
  return set;
}

// ---------------------------------------------------------------------------
// Reference provider metadata factory
// ---------------------------------------------------------------------------

export function createReferenceTrustAndSafetyProvider(
  config: ReferenceTrustAndSafetyConfig,
): TrustAndSafetyProviderMetadata {
  return {
    id: config.id,
    displayName: config.name,
    category: config.category,
    environment: "demo",
    availability: "demo",
    configState: "not_configured",
    interfaces: config.interfaces,
    capabilities: capabilitySet(config.capabilities),
    regions: config.regions ?? ["*"],
    configurationRequirements: ["Test reference provider — not a real vendor."],
    note: "Deterministic reference provider for trust-and-safety contract tests.",
  };
}

// ---------------------------------------------------------------------------
// Contract test helpers
// ---------------------------------------------------------------------------

export function assertInboundClassifierContractSatisfied(
  provider: TrustAndSafetyProviderMetadata,
): void {
  if (!provider.interfaces.includes("inbound_filter") && !provider.interfaces.includes("trust_and_safety")) {
    throw new Error("trust-and-safety contract: provider must support inbound_filter or trust_and_safety");
  }
  const caps = Object.entries(provider.capabilities).filter(([, v]) => v).map(([k]) => k);
  if (!caps.includes("inbound_spam_classification") && !caps.includes("inbound_abuse_classification")) {
    throw new Error("trust-and-safety contract: inbound classifier should declare a classification capability");
  }
}

export function assertOutboundGuardContractSatisfied(
  provider: TrustAndSafetyProviderMetadata,
): void {
  if (!provider.interfaces.includes("outbound_guard") && !provider.interfaces.includes("trust_and_safety")) {
    throw new Error("trust-and-safety contract: provider must support outbound_guard or trust_and_safety");
  }
  const caps = Object.entries(provider.capabilities).filter(([, v]) => v).map(([k]) => k);
  if (!caps.includes("outbound_spam_prevention") && !caps.includes("outbound_abuse_prevention")) {
    throw new Error("trust-and-safety contract: outbound guard should declare a prevention capability");
  }
}

export function assertAntiAutomationContractSatisfied(
  provider: TrustAndSafetyProviderMetadata,
): void {
  if (!provider.interfaces.includes("rate_control") && !provider.interfaces.includes("trust_and_safety")) {
    throw new Error("trust-and-safety contract: provider must support rate_control or trust_and_safety");
  }
  const caps = Object.entries(provider.capabilities).filter(([, v]) => v).map(([k]) => k);
  if (!caps.includes("behavior_detection") && !caps.includes("rate_intelligence")) {
    throw new Error("trust-and-safety contract: anti-automation provider should declare behavior/rate capability");
  }
}

// ---------------------------------------------------------------------------
// Reference behavior factories (used by contract tests)
// ---------------------------------------------------------------------------

export function referenceInboundClassifier(
  id = "reference-inbound",
  behavior: ReferenceTrustAndSafetyConfig["behavior"] = "classify_flag",
): TrustAndSafetyProviderMetadata {
  return createReferenceTrustAndSafetyProvider({
    id,
    name: "Reference Inbound Classifier",
    category: "spam_filter",
    behavior,
    interfaces: ["inbound_filter", "trust_and_safety"],
    capabilities: [
      "inbound_spam_classification",
      "inbound_abuse_classification",
      "abuse_evidence_capture",
      "quarantine",
      "block_allowlisting",
      "policy_enforcement",
    ],
  });
}

export function referenceOutboundGuard(
  id = "reference-outbound",
  behavior: ReferenceTrustAndSafetyConfig["behavior"] = "outbound_allow",
): TrustAndSafetyProviderMetadata {
  return createReferenceTrustAndSafetyProvider({
    id,
    name: "Reference Outbound Guard",
    category: "spam_filter",
    behavior,
    interfaces: ["outbound_guard", "trust_and_safety"],
    capabilities: ["outbound_spam_prevention", "outbound_abuse_prevention", "sender_reputation", "policy_enforcement"],
  });
}

export function referenceAntiAutomation(
  id = "reference-anti-automation",
  behavior: ReferenceTrustAndSafetyConfig["behavior"] = "behavior_flag",
): TrustAndSafetyProviderMetadata {
  return createReferenceTrustAndSafetyProvider({
    id,
    name: "Reference Anti-Automation Provider",
    category: "anti_automation",
    behavior,
    interfaces: ["rate_control", "verification_challenge", "trust_and_safety"],
    capabilities: [
      "behavior_detection",
      "rate_intelligence",
      "account_reputation",
      "device_reputation",
      "endpoint_reputation",
      "committer_reputation",
      "verification_challenge",
    ],
  });
}

export function referenceAbuseHandler(id = "reference-abuse-handler"): TrustAndSafetyProviderMetadata {
  return createReferenceTrustAndSafetyProvider({
    id,
    name: "Reference Abuse Handler",
    category: "abuse_handler",
    behavior: "classify_escalate",
    interfaces: ["inbound_filter", "outbound_guard", "trust_and_safety"],
    capabilities: [
      "inbound_abuse_classification",
      "outbound_abuse_prevention",
      "abuse_evidence_capture",
      "quarantine",
      "block_allowlisting",
      "incident_management",
      "incident_detection",
    ],
  });
}

export function referenceUnsupportedProvider(id = "reference-unsupported"): TrustAndSafetyProviderMetadata {
  return createReferenceTrustAndSafetyProvider({
    id,
    name: "Reference Unsupported Provider",
    category: "spam_filter",
    behavior: "unsupported",
    interfaces: ["trust_and_safety"],
    capabilities: [],
  });
}
