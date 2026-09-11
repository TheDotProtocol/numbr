// =============================================================================
// GET  /api/billing/subscriptions                → the user's subscriptions
// POST /api/billing/subscriptions { id, action } → cancel | pause | resume
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { getUserSubscriptions, setSubscriptionStatus } from "@/lib/billing-server";

export async function GET() {
  try {
    const identity = await requireUser();
    const subscriptions = await getUserSubscriptions(identity.uid);
    return NextResponse.json({ subscriptions });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

const actionSchema = z.object({
  id: z.string().trim().min(1),
  action: z.enum(["cancel", "pause", "resume"]),
});

export async function POST(req: Request) {
  try {
    const identity = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Unknown action." }, { status: 400 });
    }
    const status = parsed.data.action === "cancel" ? "cancelled" : parsed.data.action === "pause" ? "paused" : "active";
    const subscription = await setSubscriptionStatus(
      identity.uid,
      parsed.data.id,
      status,
      identity.uid,
    );
    return NextResponse.json({ ok: true, subscription });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
