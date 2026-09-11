// =============================================================================
// POST /api/esim/checkout — create order + mock payment + provisioning.
// Body: { planId, idempotencyKey }
//
// Price integrity: the client NEVER sends price/currency/plan data. The
// server loads the authoritative plan, computes the total, snapshots it and
// runs the pipeline. Duplicate submissions with the same idempotency key
// return the original order instead of creating a second one.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api";
import { toAppError, appError } from "@/lib/errors";
import { createOrderAndProvision } from "@/lib/esim-server";

const bodySchema = z.object({
  planId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(8).max(64),
});

export async function POST(req: Request) {
  try {
    const identity = await requireUser();
    await enforceUserRateLimit("checkout", identity.uid);
    if (!identity.emailVerified) {
      return NextResponse.json(
        { code: "email_unverified", message: "Verify your email before purchasing." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: parsed.error.issues[0]?.message ?? "Invalid checkout." },
        { status: 400 },
      );
    }

    const { order, alreadyExists } = await createOrderAndProvision({
      uid: identity.uid,
      planId: parsed.data.planId,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    return NextResponse.json({
      ok: true,
      alreadyExists,
      orderId: order.id,
      esimId: order.esimId,
      orderStatus: order.orderStatus,
    });
  } catch (err) {
    if (err instanceof Error && /not available for purchase/.test(err.message)) {
      return NextResponse.json(
        { code: "plan_unavailable", message: "This plan is no longer available." },
        { status: 409 },
      );
    }
    if (err instanceof Error && /payment failed/.test(err.message)) {
      return NextResponse.json(
        { code: "payment_failed", message: "Payment could not be completed. Please try again." },
        { status: 402 },
      );
    }
    return jsonError(toAppError(err));
  }
}
