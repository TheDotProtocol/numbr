// =============================================================================
// GET /api/billing/plan — safe Global Plan + entitlements view for the owner.
// POST /api/billing/plan — reactivate a paused/cancelled plan (status only;
//   no prices, plan ids or entitlements are ever accepted from the client).
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { resolveUserEntitlements, getPlanSubscription } from "@/lib/entitlements-server";
import { setSubscriptionStatus } from "@/lib/billing-server";
import { getFeatureFlags } from "@/lib/features";

export async function GET() {
  try {
    const identity = await requireUser();
    const view = await resolveUserEntitlements(identity.uid);
    return NextResponse.json(view);
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

export async function POST() {
  try {
    const identity = await requireUser();
    await enforceUserRateLimit("plan_reactivate", identity.uid);

    if (!getFeatureFlags().globalPlanEnabled) {
      return NextResponse.json(
        { code: "unavailable", message: "Plan management isn't available right now." },
        { status: 503 },
      );
    }

    const sub = await getPlanSubscription(identity.uid);
    if (!sub) {
      return NextResponse.json(
        { code: "not_found", message: "You don't have a plan to reactivate yet." },
        { status: 404 },
      );
    }
    if (sub.status === "active" || sub.status === "trialing") {
      return NextResponse.json(
        { code: "invalid_state", message: "Your plan is already active." },
        { status: 400 },
      );
    }
    if (sub.status === "expired" || sub.status === "failed") {
      return NextResponse.json(
        { code: "invalid_state", message: "This plan can't be reactivated. Contact support." },
        { status: 400 },
      );
    }

    await setSubscriptionStatus(identity.uid, sub.id, "active", identity.uid);
    const view = await resolveUserEntitlements(identity.uid);
    return NextResponse.json({ ok: true, plan: view.plan });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
