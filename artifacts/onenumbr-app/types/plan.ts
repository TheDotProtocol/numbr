// =============================================================================
// OneNumbr — Global Plan & Entitlements domain types (Prompt 13)
//
// Product principle: OneNumbr sells a persistent global communications identity.
//
//   ONE CUSTOMER → ONE ONENUMBR ID → ONE PRIMARY NUMBER → ONE GLOBAL PLAN
//     → ONE COMMUNICATIONS IDENTITY → MANY ENDPOINTS → MANY CONNECTIVITY PROVIDERS
//
// The plan is PROVIDER-INDEPENDENT: no "Stripe plan", no "carrier plan".
// The catalog is a server config constant; subscriptions snapshot the version
// they were created against (planSnapshot) so future versions never mutate
// historical economics.
// =============================================================================

/** Canonical entitlement keys — the centralized product-access matrix. */
export type EntitlementKey =
  | "number.primary"
  | "communications.voice"
  | "communications.messaging"
  | "communications.voicemail"
  | "endpoints.multi_device"
  | "connectivity.global"
  | "connectivity.esim"
  | "connectivity.pstn"
  | "connectivity.physical_sim"
  | "ecosystem.taucore";

/**
 * Honest product availability for an entitlement.
 *  - "available"     — works in this environment (application layer).
 *  - "demo"          — works via a clearly-labeled demo/mock provider.
 *  - "coming_soon"   — modeled but NOT operational; UI must never offer it.
 */
export type EntitlementAvailability = "available" | "demo" | "coming_soon";

/** Static definition of one entitlement inside a plan version. */
export interface PlanEntitlement {
  key: EntitlementKey;
  enabled: boolean;
  availability: EntitlementAvailability;
  /** Optional human limit, e.g. endpoint count. Null = unlimited. */
  limit: number | null;
  /** Short human label used by UI (English; product copy lives with the model). */
  label: string;
}

/** One version of the OneNumbr Global Plan. NEVER mutate a released version. */
export interface GlobalPlanVersion {
  /** Stable catalog id, e.g. "one_global_v1". Subscriptions snapshot this. */
  planId: string;
  /** Human-facing version tag, e.g. "ONE_GLOBAL_V1". */
  version: string;
  name: string;
  description: string;
  interval: "monthly";
  /** Integer minor units per interval. Server-derived only — never client-set. */
  priceMinor: number;
  currency: string;
  isDefault: boolean;
  entitlements: PlanEntitlement[];
}

/** How the current environment honors an entitlement (server-derived). */
export type EntitlementResolution = {
  key: EntitlementKey;
  label: string;
  /** Entitled by the plan AND currently honored in this environment. */
  entitled: boolean;
  /** Why not, when entitled=false at the environment level. */
  availability: EntitlementAvailability;
  limit: number | null;
  /** Demo/mock note for honest UI rendering. */
  note: string | null;
};

/** Safe, UI-ready result of resolveUserEntitlements(uid). */
export interface EntitlementsView {
  plan: {
    planId: string | null;
    version: string | null;
    name: string;
    status: "active" | "demo_active" | "past_due" | "paused" | "cancelled" | "none";
    interval: "monthly" | null;
    priceMinor: number | null;
    currency: string | null;
    currentPeriodEnd: number | null;
    subscriptionId: string | null;
    demoProvider: boolean;
  };
  entitlements: EntitlementResolution[];
  /** Server-side summary numbers the UI may display. */
  usage: { oneNumbrId: string | null; primaryNumber: string | null; activeEndpoints: number | null };
}
