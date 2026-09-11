// =============================================================================
// OneNumbr — Entitlements engine (server-side; Admin SDK; Prompt 13)
//
// The authoritative product-access layer. All commercial/product access checks
// resolve here — never `if (subscription.status === "active")` scattered
// through call sites.
//
//   resolveUserEntitlements(uid) → EntitlementsView (safe for UI)
//   hasEntitlement(uid, key)     → boolean, for server gates
//   getPlanStatus(uid)           → subscription/plan status summary
//
// Derivation: catalog plan version × subscription (source:"number") × account
// state × feature flags. Client state is NEVER authoritative. Entitlements are
// derived (no per-user entitlement documents) — minimal Firestore reads.
// =============================================================================

import { getAdminDb } from "@/firebase/admin";
import { appError } from "@/lib/errors";
import { getFeatureFlags } from "@/lib/features";
import {
  ENTITLEMENT_NOTES,
  findEntitlement,
  getDefaultGlobalPlan,
  getPlanVersion,
  toResolution,
} from "@/lib/plan-catalog";
import type {
  EntitlementKey,
  EntitlementResolution,
  EntitlementsView,
} from "@/types/plan";
import type { SubscriptionRecord } from "@/types/billing";

/** The plan subscription is the number-sourced subscription (Prompt 11 model). */
function isPlanSubscription(sub: Pick<SubscriptionRecord, "source" | "planId">): boolean {
  return sub.source === "number";
}

export type PlanStatus = EntitlementsView["plan"]["status"];

/** Load the user's current Global Plan subscription (null when none). */
export async function getPlanSubscription(uid: string): Promise<SubscriptionRecord | null> {
  const snap = await getAdminDb()
    .collection("subscriptions")
    .where("uid", "==", uid)
    .where("source", "==", "number")
    .limit(10)
    .get();
  if (snap.empty) return null;
  const subs = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubscriptionRecord, "id">) }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return subs[0];
}

/** Plan status summary — subscription-derived, never client-trusted. */
export async function getPlanStatus(uid: string): Promise<PlanStatus> {
  const sub = await getPlanSubscription(uid);
  if (!sub) return "none";
  switch (sub.status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    case "cancelled":
    case "expired":
    case "failed":
      return "cancelled";
  }
}

/** Read the account lifecycle without duplicating account logic. */
async function getAccountState(uid: string): Promise<"active" | "deactivated" | "deletion_requested" | "deleted"> {
  const snap = await getAdminDb().collection("users").doc(uid).get();
  const state = snap.data()?.accountState;
  if (state === "deactivated" || state === "deletion_requested" || state === "deleted") return state;
  return "active";
}

/**
 * Resolve every entitlement for a user in one pass:
 * plan entitlement × subscription status × account state × feature flags.
 * Environment honesty (demo vs coming_soon) comes from the catalog; flags can
 * only disable, never enable beyond it.
 */
export async function resolveUserEntitlements(uid: string): Promise<EntitlementsView> {
  const flags = getFeatureFlags();
  const [sub, accountState, primaryNumber, activeEndpoints, oneNumbrId] = await Promise.all([
    getPlanSubscription(uid),
    getAccountState(uid),
    getPrimaryNumberLabel(uid),
    countActiveEndpoints(uid),
    getOneNumbrIdLabel(uid),
  ]);

  const plan = sub ? getPlanVersion(sub.planId) ?? null : null;
  // Fall back to the default version for subscriptions created before the
  // catalog existed (unknown planId) — economics still come from planSnapshot.
  const resolvedPlan = plan ?? (sub ? getDefaultGlobalPlan() : null);

  // Legacy bridge (Prompt 13): users who activated a number before the plan
  // catalog existed have no subscription record, but the number assignment IS
  // the commercial relationship under the Prompt 11 model. They keep plan
  // access without inventing economics (price/period stay null).
  const legacyPlan = sub === null && primaryNumber !== null;

  const commerciallyActive =
    (sub !== null && (sub.status === "active" || sub.status === "trialing")) || legacyPlan;
  const accountOk = accountState === "active";

  const mapKeyToFlag: Partial<Record<EntitlementKey, boolean>> = {
    "communications.voice": flags.voiceEnabled && flags.communicationsEnabled,
    "communications.messaging": flags.messagingEnabled && flags.communicationsEnabled,
    "communications.voicemail": flags.voicemailEnabled && flags.communicationsEnabled,
    "endpoints.multi_device": flags.endpointsEnabled,
    "connectivity.esim": flags.connectivityEnabled,
  };

  const entitlements: EntitlementResolution[] = (resolvedPlan?.entitlements ?? []).map((e) => {
    // 1. Commercial gate: needs an active subscription.
    let entitled = commerciallyActive && e.enabled;
    // 2. Account gate: suspended/deletion-requested accounts lose product access.
    if (entitled && !accountOk) entitled = false;
    // 3. Environment gate: feature flags may disable.
    const flagOn = mapKeyToFlag[e.key] ?? true;
    if (entitled && !flagOn) entitled = false;
    // future/coming_soon entitlements are never entitled regardless of gates
    if (entitled && e.availability === "coming_soon") entitled = false;
    return toResolution(e, { entitled });
  });

  return {
    plan: {
      planId: resolvedPlan?.planId ?? null,
      version: resolvedPlan?.version ?? null,
      name: resolvedPlan?.name ?? "OneNumbr Global Plan",
      status: legacyPlan ? "active" : await getPlanStatus(uid),
      interval: sub || legacyPlan ? "monthly" : null,
      // No invented economics: legacy-plan users show no price/period.
      priceMinor: sub?.planSnapshot?.amountMinor ?? null,
      currency: sub?.planSnapshot?.currency ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      subscriptionId: sub?.id ?? null,
      demoProvider: true,
    },
    entitlements,
    usage: { oneNumbrId, primaryNumber, activeEndpoints },
  };
}

/** Gate helper for server code paths. */
export async function hasEntitlement(uid: string, key: EntitlementKey): Promise<boolean> {
  const view = await resolveUserEntitlements(uid);
  const e = view.entitlements.find((x) => x.key === key);
  return Boolean(e?.entitled);
}

/**
 * Entitlement gate for product operations. Throws a clean, product-level
 * error (no provider internals) when the user lacks access.
 */
export async function requireEntitlement(uid: string, key: EntitlementKey): Promise<void> {
  // Kill-switch: when entitlements are disabled platform-wide, gates no-op.
  if (!getFeatureFlags().entitlementsEnabled) return;
  if (!(await hasEntitlement(uid, key))) {
    throw appError(
      "permission-denied",
      "Your OneNumbr plan doesn't include this yet. Activate the Global Plan or contact support.",
    );
  }
}

/**
 * Number-retention policy boundary (documentation-backed):
 * plan pause/cancel does NOT touch the number assignment. Number release stays
 * an explicit product action (existing releaseUserNumber flow). The OneNumbr
 * ID is permanent regardless of plan state.
 */

// ---------------------------------------------------------------------------
// Bounded usage reads (usage numbers only; never full-collection scans)
// ---------------------------------------------------------------------------

/** Bounded read of the user's primary number label (shared with connectivity). */
export async function getPrimaryNumberLabel(uid: string): Promise<string | null> {
  const snap = await getAdminDb()
    .collection("number_assignments")
    .where("uid", "==", uid)
    .where("status", "==", "active")
    .limit(1)
    .get();
  const first = snap.docs[0];
  return first ? String(first.data().onenumbrNumber ?? "") || null : null;
}

async function countActiveEndpoints(uid: string): Promise<number> {
  const snap = await getAdminDb()
    .collection("communication_endpoints")
    .where("uid", "==", uid)
    .where("status", "==", "active")
    .count()
    .get();
  return snap.data().count;
}

/** OneNumbr ID from the permanent identity doc (read-only; shared). */
export async function getOneNumbrIdLabel(uid: string): Promise<string | null> {
  const snap = await getAdminDb().collection("onenumbr_ids").doc(uid).get();
  return snap.exists ? String(snap.data()?.onenumbr ?? "") || null : null;
}

// Re-export for convenience of call sites composing plan + notes.
export { ENTITLEMENT_NOTES, findEntitlement };
