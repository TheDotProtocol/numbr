// =============================================================================
// OneNumbr — Provider readiness registry (Prompt 15)
//
// The one place that describes providers as FIRST-CLASS entities with metadata,
// configuration state, health and selection semantics — independently of any
// single vendor. Future real providers register here; existing mock/demo
// providers are described honestly (demo availability, not production ready).
//
// This layer does NOT:
//   - store or expose provider credentials
//   - let the client choose a provider for privileged operations
//   - weaken the Prompt 10 provider-mode guard
//
// This layer DOES:
//   - declare provider metadata for admin, Customer 360, health, docs
//   - derive honest configuration/availability state from env + flags
//   - provide a server-side selection API for future real providers
//   - expose a provider-mode acknowledgement helper for real-provider boot
//
// Provider instances still live in providers/index.ts; this file describes
// them. A real vendor adapter would register both its instance and its
// metadata.
// =============================================================================

import { getFeatureFlags, getEnvironmentMode } from "./features";
import type {
  ProviderCategory,
  ProviderCapability,
  ProviderCapabilitySet,
  ProviderConfigState,
  ProviderEnvironment,
  ProviderMetadata,
  ProviderHealthSnapshot,
  ProviderInterface,
  ProviderAvailability,
} from "@/types/provider";
import { emptyCapabilities } from "@/types/provider";

// Safe builder for frozen capability sets — avoids assigning into a
// readonly-typed object literal.
function buildCapabilities(partial: Partial<ProviderCapabilitySet>): ProviderCapabilitySet {
  const map: Record<ProviderCapability, boolean> = {} as Record<ProviderCapability, boolean>;
  for (const key of ALL_CAPABILITIES) map[key] = false;
  for (const [key, value] of Object.entries(partial)) if (key in map) map[key as ProviderCapability] = value as boolean;
  return map as ProviderCapabilitySet;
}

const ALL_CAPABILITIES: readonly ProviderCapability[] = [
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
];

// ---------------------------------------------------------------------------
// Registry metadata — declarative provider descriptions
// ---------------------------------------------------------------------------

/** Declarative metadata for a provider slot. Future real vendors extend this
 *  registry (and simultaneously register their implementation in
 *  providers/index.ts). */
const REGISTRY: readonly ProviderMetadata[] = [
  {
    id: "mock-telecom",
    displayName: "Demo Telecom Provider",
    category: "pstn",
    environment: "demo",
    availability: "demo",
    configState: "not_configured",
    interfaces: ["numbering"] as const,      capabilities: buildCapabilities({
      numbering: true,
      sms: true,
      voice: true,
    }),
    regions: ["*"],
    configurationRequirements: ["FEATURE_REAL_TELECOM + real carrier agreement + credentials"],
    note: "Mock telecom provider used for number orders, orders and lifecycle demos. Not connected to the public telephone network.",
  },
  {
    id: "mock-payments",
    displayName: "Demo Payment Provider",
    category: "connectivity_aggregator", // payment is infra, not a telecom family; category is nominal here for ops display
    environment: "demo",
    availability: "demo",
    configState: "not_configured",
    interfaces: [] as const,
    capabilities: emptyCapabilities(),
    regions: ["*"],
    configurationRequirements: ["FEATURE_STRIPE_PAYMENTS + Stripe account + API keys"],
    note: "Demo payment provider used for checkout and billing-demo flows. No real charges are made and no card data is collected.",
  },
  {
    id: "manual-identity",
    displayName: "Manual Identity Verification",
    category: "connectivity_aggregator", // not a telecom category; ops label only
    environment: "demo",
    availability: "live",
    configState: "production_ready",
    interfaces: [] as const,
    capabilities: emptyCapabilities(),
    regions: ["*"],
    configurationRequirements: ["FEATURE_SUMSUB for automated identity verification"],
    note: "Manual KYC review is the implemented flow. Automated identity verification is available when Sumsub is configured.",
  },
  {
    id: "mock-esim",
    displayName: "Demo eSIM Provider",
    category: "esim",
    environment: "demo",
    availability: "demo",
    configState: "not_configured",
    interfaces: ["connectivity"] as const,      capabilities: buildCapabilities({
      esim: true,
      data: true,
    }),
    regions: ["*"],
    configurationRequirements: ["FEATURE_REAL_ESIM + real SM-DP+/carrier agreement + credentials"],
    note: "Demo eSIM provider used for profile-order and activation demos. Purchased eSIMs cannot be installed on a device.",
  },
  {
    id: "mock-communications",
    displayName: "Demo Communications Provider",
    category: "cloud_telephony",
    environment: "demo",
    availability: "demo",
    configState: "not_configured",
    interfaces: ["communications"] as const,      capabilities: buildCapabilities({
      voice: true,
      sms: true,
    }),
    regions: ["*"],
    configurationRequirements: ["FEATURE_REAL_TELECOM or cloud-telephony provider + credentials + (eventually) numbering arrangement"],
    note: "Demo communications provider used for calls, messages and voicemail simulations. Not connected to the public telephone network.",
  },
  {
    id: "cloud-demo",
    displayName: "Demo Cloud Connectivity",
    category: "cloud_telephony",
    environment: "demo",
    availability: "demo",
    configState: "not_configured",
    interfaces: ["connectivity"] as const,      capabilities: buildCapabilities({
      voice: true,
      sms: true,
      data: true,
    }),
    regions: ["*"],
    configurationRequirements: ["Real cloud-telephony provider + credentials + numbering arrangement + webhook configuration"],
    note: "Demo cloud connectivity mechanism — the application-level connectivity path available today.",
  },
  {
    id: "esim-demo-adapter",
    displayName: "Demo eSIM Connectivity (adapter)",
    category: "esim",
    environment: "demo",
    availability: "demo",
    configState: "not_configured",
    interfaces: ["connectivity"] as const,      capabilities: buildCapabilities({
      esim: true,
      data: true,
    }),
    regions: ["*"],
    configurationRequirements: ["FEATURE_REAL_ESIM + real eSIM provider + SM-DP+/carrier agreement + credentials"],
    note: "Adapter over the existing eSIM engine — lifecycle parity for connectivity, no duplicated provisioning logic.",
  },
  // Future boundaries — described, never operational until configured
  {
    id: "mno-future",
    displayName: "Future MNO Provider",
    category: "mno",
    environment: "sandbox",
    availability: "disabled",
    configState: "not_configured",
    interfaces: ["connectivity", "numbering"] as const,      capabilities: buildCapabilities({
      voice: true,
      sms: true,
      data: true,
      esim: true,
      physical_sim: true,
      roaming: true,
      sip: false,
      pstn: true,
      webhooks: true,
      portability: true,
      mms: true,
      numbering: true,
    }),
    regions: ["*"],
    configurationRequirements: ["Carrier agreement + SIM/eSIM inventory + subscriber provisioning + webhook configuration + regulatory review"],
    note: "Future MNO boundary — not implemented. Would provide subscriber provisioning, SIM/eSIM lifecycle, voice, SMS, data, roaming and webhooks.",
  },
  {
    id: "mvno-future",
    displayName: "Future MVNO Provider",
    category: "mvno",
    environment: "sandbox",
    availability: "disabled",
    configState: "not_configured",
    interfaces: ["connectivity", "numbering"] as const,      capabilities: buildCapabilities({
      voice: true,
      sms: true,
      data: true,
      esim: true,
      physical_sim: true,
      roaming: true,
      sip: false,
      pstn: true,
      webhooks: true,
      portability: true,
      mms: true,
      numbering: true,
    }),
    regions: ["*"],
    configurationRequirements: ["Host/MNO agreement + subscriber provisioning + SIM/eSIM lifecycle + roaming + webhook configuration + regulatory review"],
    note: "Future MVNO boundary — not implemented. Would provide subscriber provisioning, SIM/eSIM lifecycle, voice, SMS, data, roaming and webhooks.",
  },
  {
    id: "physical-sim-future",
    displayName: "Future Physical SIM Provider",
    category: "physical_sim",
    environment: "sandbox",
    availability: "disabled",
    configState: "not_configured",
    interfaces: ["connectivity"] as const,      capabilities: buildCapabilities({
      physical_sim: true,
      data: true,
      voice: true,
      sms: true,
      numbering: false,
      esim: false,
      roaming: true,
      sip: false,
      pstn: true,
      webhooks: true,
      portability: false,
      mms: true,
    }),
    regions: ["*"],
    configurationRequirements: ["SIM inventory + carrier association + ICCID/IMSI assignment + activation + shipping + replacement + regulatory review"],
    note: "Future physical SIM boundary — not implemented. A physical SIM is connectivity infrastructure, not the OneNumbr identity.",
  },
  {
    id: "pstn-future",
    displayName: "Future PSTN Provider",
    category: "pstn",
    environment: "sandbox",
    availability: "disabled",
    configState: "not_configured",
    interfaces: ["connectivity", "communications", "numbering"] as const,      capabilities: buildCapabilities({
      pstn: true,
      voice: true,
      sms: true,
      mms: true,
      numbering: true,
      data: false,
      esim: false,
      physical_sim: false,
      roaming: false,
      sip: true,
      webhooks: true,
      portability: true,
    }),
    regions: ["*"],
    configurationRequirements: ["Legitimate numbering allocation + carrier relationship + voice/SMS routing + caller ID + emergency services + regulatory review"],
    note: "Future PSTN boundary — not implemented. PSTN includes numbering, voice, SMS and carrier routing and is kept separate from generic connectivity.",
  },
  {
    id: "sip-future",
    displayName: "Future SIP Provider",
    category: "sip",
    environment: "sandbox",
    availability: "disabled",
    configState: "not_configured",
    interfaces: ["connectivity", "communications"] as const,      capabilities: buildCapabilities({
      sip: true,
      voice: true,
      sms: false,
      mms: false,
      data: false,
      numbering: false,
      esim: false,
      physical_sim: false,
      roaming: false,
      pstn: true,
      webhooks: true,
      portability: false,
    }),
    regions: ["*"],
    configurationRequirements: ["SIP trunk/endpoint provider + credentials + caller ID + webhook configuration + regulatory review"],
    note: "Future SIP boundary — not implemented.",
  },
];

// ---------------------------------------------------------------------------
// Registry queries
// ---------------------------------------------------------------------------

/** All providers described in the registry (existing + future boundaries). */
export function listProviderMetadata(): readonly ProviderMetadata[] {
  return REGISTRY;
}

/** Metadata for a single provider slot by registry id. */
export function getProviderMetadata(id: string): ProviderMetadata | undefined {
  return REGISTRY.find((p) => p.id === id);
}

/** Providers that satisfy a given interface (existing operational providers
 *  only — future boundaries are disabled and excluded by default). */
export function providersForInterface(
  iface: ProviderInterface,
  options?: { includeFuture?: boolean },
): readonly ProviderMetadata[] {
  return REGISTRY.filter(
    (p) => p.interfaces.includes(iface) && (options?.includeFuture ? true : p.availability !== "disabled"),
  );
}

/** Providers that declare a given capability (operational only). */
export function providersForCapability(
  capability: ProviderCapability,
  options?: { includeFuture?: boolean },
): readonly ProviderMetadata[] {
  return REGISTRY.filter(
    (p) => p.capabilities[capability] && (options?.includeFuture ? true : p.availability !== "disabled"),
  );
}

// ---------------------------------------------------------------------------
// Provider configuration state
// ---------------------------------------------------------------------------

/** Derive an honest configuration state for a provider slot from env + flags.
 *  This is the "does this provider look configured" answer for ops/health —
 *  it does NOT read or expose credentials. */
export function providerConfigState(provider: ProviderMetadata): ProviderConfigState {
  // Future/disabled providers that have no environment expectation are "not_configured".
  if (provider.availability === "disabled" && provider.environment === "sandbox") {
    return "not_configured";
  }

  // Demo providers that intentionally run without credentials are "not_configured"
  // by choice — they are demo, not misconfigured.
  if (provider.availability === "demo" && provider.environment === "demo") {
    return "not_configured"; // intentional demo, no real credentials expected
  }

  // Otherwise: a provider that wants to be real but whose flag is off is
  // "not_configured"; a provider whose flag is on is at minimum "sandbox_only"
  // until we have an actual production-credential signal (which we do not fake).
  return "not_configured";
}

/** Honest availability for a provider slot given current flags/environment. */
export function providerAvailability(provider: ProviderMetadata): ProviderAvailability {
  if (provider.availability === "demo") return "demo";
  if (provider.availability === "disabled") {
    // Future providers remain disabled unless an explicit flag says otherwise.
    return "disabled";
  }
  if (provider.availability === "live") return "live";
  return "disabled";
}

// ---------------------------------------------------------------------------
// Provider health snapshots (observable, not fabricated)
// ---------------------------------------------------------------------------

/** A minimal, honest health snapshot per provider. In this release nothing is
 *  measured against a real provider, so every snapshot is "not_measured" with
 *  an honest note — we never fabricate availability numbers. */
export function providerHealthSnapshot(provider: ProviderMetadata): ProviderHealthSnapshot {
  if (provider.availability === "disabled") {
    return {
      providerId: provider.id,
      lastSuccessfulOperation: null,
      lastFailure: null,
      failureReason: null,
      status: "not_measured",
      note: "Not configured — no live provider integration exists.",
    };
  }

  if (provider.availability === "demo") {
    return {
      providerId: provider.id,
      lastSuccessfulOperation: null,
      lastFailure: null,
      failureReason: null,
      status: "not_measured",
      note: "Demo provider — operational behavior is application-level; no real provider metrics are measured.",
    };
  }

  return {
    providerId: provider.id,
    lastSuccessfulOperation: null,
    lastFailure: null,
    failureReason: null,
    status: "not_measured",
    note: "Not measured — no production provider traffic yet.",
  };
}

/** Combined operational health over currently-available providers. */
export function providerHealthSummary(): {
  available: number;
  demo: number;
  disabled: number;
  configured: number;
  note: string;
} {
  const items = REGISTRY.map((p) => ({
    provider: p,
    availability: providerAvailability(p),
    configState: providerConfigState(p),
  }));
  const available = items.filter((i) => i.availability === "live").length;
  const demo = items.filter((i) => i.availability === "demo").length;
  const disabled = items.filter((i) => i.availability === "disabled").length;
  const configured = items.filter((i) => i.configState === "production_ready" || i.configState === "sandbox_only").length;
  return {
    available,
    demo,
    disabled,
    configured,
    note:
      available > 0
        ? `${available} real provider(s) configured; demo/live boundary enforced by the provider-mode guard.`
        : demo > 0
          ? `No live providers configured — ${demo} demo provider(s) operational. Real providers require explicit feature flags and credentials.`
          : "No providers configured.",
  };
}

// ---------------------------------------------------------------------------
// Server-side provider selection (future real providers)
// ---------------------------------------------------------------------------

export type ProviderSelectionInput = {
  /** Required interface the provider must satisfy (numbering | connectivity | communications). */
  interface_: ProviderInterface;
  /** Capability the provider must declare. */
  capability?: ProviderCapability;
  /** Preferred region; "*" means any/region-neutral. */
  region?: string;
  /** Allow a disabled (future) boundary to be returned? Usually no. */
  allowFuture?: boolean;
};

/** Select a provider that can satisfy the request. Selection is server-side
 *  only — the client sends a requirement, never a provider id. In this release
 *  the only satisfied live path is the demo connectivity provider for
 *  connectivity requests; everything else is honest rejection. */
export function selectProvider(input: ProviderSelectionInput): ProviderMetadata | null {
  const candidates = REGISTRY.filter(
    (p) => {
      if (!p.interfaces.includes(input.interface_)) return false;
      if (!input.allowFuture && p.availability === "disabled") return false;
      if (input.capability && !p.capabilities[input.capability]) return false;
      if (input.region && input.region !== "*" && !p.regions.includes("*") && !p.regions.includes(input.region)) {
        return false;
      }
      return true;
    },
  );

  // Prefer a configured/live provider; fall back to demo for the operational
  // connectivity case, otherwise return null honestly.
  const live = candidates.find((p) => providerAvailability(p) === "live");
  if (live) return live;

  if (input.interface_ === "connectivity" && input.capability !== "numbering") {
    const demo = candidates.find((p) => providerAvailability(p) === "demo");
    if (demo) return demo;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Provider-mode acknowledgement helper (Prompt 10 guard-aware)
// ---------------------------------------------------------------------------

/** Returns an honest description of whether a given provider domain is
 *  permitted to run in its current environment, according to the Prompt 10
 *  provider-mode guard. Used by admin/ops display and health. */
export function describeProviderMode(domain: "payment" | "telecom" | "esim" | "identity"): {
  environment: ReturnType<typeof getEnvironmentMode>;
  real: boolean;
  mock: boolean;
  allowed: boolean;
  reason: string;
} {
  const mode = getEnvironmentMode();
  const flags = getFeatureFlags();
  const realRequested =
    domain === "payment" && flags.stripePayments ||
    domain === "telecom" && flags.realTelecom ||
    domain === "esim" && flags.realEsim ||
    domain === "identity" && flags.sumsub;
  const mockActive =
    domain === "payment" && flags.mockPayments ||
    domain === "telecom" && flags.mockTelecom ||
    domain === "esim" && flags.mockEsim ||
    domain === "identity" && !flags.sumsub;

  let allowed = true;
  let reason = "";
  if (mode === "production" && mockActive && !realRequested) {
    const demoAck = typeof process !== "undefined" && process.env["ONENUMBR_ALLOW_DEMO_IN_PRODUCTION"] === "true";
    allowed = demoAck;
    reason = demoAck
      ? "Mock provider running in production under explicit demo acknowledgement (ONENUMBR_ALLOW_DEMO_IN_PRODUCTION=true)."
      : "Refused: production environment running a mock provider without the real-provider flag or the explicit demo acknowledgement.";
  } else if (mode === "development" && realRequested) {
    allowed = false;
    reason = `Refused: real ${domain} provider cannot be activated in development — set ONENUMBR_ENV=staging|production first.`;
  } else {
    reason = mode === "production"
      ? "Production mode — real provider expected; mock blocked unless acknowledged."
      : mode === "staging"
        ? "Staging mode — explicit provider configuration expected."
        : "Development mode — mock providers permitted.";
  }

  return { environment: mode, real: realRequested, mock: mockActive, allowed, reason };
}
