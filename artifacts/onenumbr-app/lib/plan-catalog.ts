// =============================================================================
// OneNumbr — Global Plan catalog (server config; Prompt 13)
//
// ONE STANDARD GLOBAL PLAN — not a marketplace. Versions are immutable once
// released: existing subscriptions keep the economics they were created against
// (duplicated into their planSnapshot by the billing engine). A future price or
// entitlement change is a NEW version (one_global_v2), never an edit here.
//
// Availability is honest:
//   - "available"    works today at the application layer.
//   - "demo"         works today via the clearly-labeled demo/mock provider.
//   - "coming_soon"  modeled but NOT operational — never offered in UI.
//
// No price is invented: ONE_GLOBAL_V1 carries the existing server-side number
// plan price source convention (monthlyPrice already drives number checkout).
// =============================================================================

import type { EntitlementKey, EntitlementResolution, GlobalPlanVersion, PlanEntitlement } from "@/types/plan";

const GLOBAL_PLAN_V1: GlobalPlanVersion = {
  planId: "one_global_v1",
  version: "ONE_GLOBAL_V1",
  name: "OneNumbr Global",
  description: "One identity. One number. Anywhere. The standard OneNumbr plan.",
  interval: "monthly",
  // Placeholder commercial price for the demo environment: $5.00/month, USD.
  // Demo payment provider — no real charges. Replace via a future plan
  // version, never by editing this one.
  priceMinor: 500,
  currency: "USD",
  isDefault: true,
  entitlements: [
    { key: "number.primary", enabled: true, availability: "available", limit: 1, label: "Primary OneNumbr Number" },
    { key: "communications.voice", enabled: true, availability: "demo", limit: null, label: "Voice" },
    { key: "communications.messaging", enabled: true, availability: "demo", limit: null, label: "Messaging" },
    { key: "communications.voicemail", enabled: true, availability: "available", limit: null, label: "Voicemail" },
    { key: "endpoints.multi_device", enabled: true, availability: "available", limit: 5, label: "Multi-device endpoints" },
    { key: "connectivity.global", enabled: true, availability: "demo", limit: null, label: "Global connectivity" },
    { key: "connectivity.esim", enabled: true, availability: "demo", limit: null, label: "eSIM connectivity" },
    { key: "connectivity.pstn", enabled: false, availability: "coming_soon", limit: null, label: "PSTN calling" },
    { key: "connectivity.physical_sim", enabled: false, availability: "coming_soon", limit: null, label: "Physical SIM" },
    { key: "ecosystem.taucore", enabled: false, availability: "coming_soon", limit: null, label: "TauCore integration" },
  ],
};

/** Released plan versions, newest last. Immutable. */
const PLAN_CATALOG: readonly GlobalPlanVersion[] = [GLOBAL_PLAN_V1];

/** The default plan (the only released version today). */
export function getDefaultGlobalPlan(): GlobalPlanVersion {
  return GLOBAL_PLAN_V1;
}

/** Look up a plan version by catalog id; null when unknown. */
export function getPlanVersion(planId: string): GlobalPlanVersion | null {
  return PLAN_CATALOG.find((p) => p.planId === planId) ?? null;
}

/** All released versions (admin/ops display). */
export function listPlanVersions(): readonly GlobalPlanVersion[] {
  return PLAN_CATALOG;
}

export function findEntitlement(plan: GlobalPlanVersion, key: EntitlementKey): PlanEntitlement | null {
  return plan.entitlements.find((e) => e.key === key) ?? null;
}

/**
 * Environment-level honesty notes surfaced to UI for demo entitlements.
 * Kept beside the catalog so labels stay consistent everywhere.
 */
export const ENTITLEMENT_NOTES: Record<EntitlementKey, string | null> = {
  "number.primary": null,
  "communications.voice": "Demo provider — simulated calls, clearly labeled.",
  "communications.messaging": "Demo provider — simulated messages, clearly labeled.",
  "communications.voicemail": null,
  "endpoints.multi_device": null,
  "connectivity.global": "Connectivity architecture ready; runs on the demo provider.",
  "connectivity.esim": "Demo eSIM provider — provisioning is simulated.",
  "connectivity.pstn": "Requires a future carrier/numbering arrangement.",
  "connectivity.physical_sim": "Planned for a later phase.",
  "ecosystem.taucore": "Future TauCore integration boundary.",
};

/** Static catalog definition → safe per-user resolution entry. */
export function toResolution(entitlement: PlanEntitlement, overrides?: Partial<EntitlementResolution>): EntitlementResolution {
  return {
    key: entitlement.key,
    label: entitlement.label,
    entitled: entitlement.enabled,
    availability: entitlement.availability,
    limit: entitlement.limit,
    note: ENTITLEMENT_NOTES[entitlement.key],
    ...overrides,
  };
}
