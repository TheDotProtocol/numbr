// =============================================================================
// POST /api/number/checkout — reserve→pay→provision pipeline for a number.
// Body: { numberId, idempotencyKey }
//
// Price integrity: the client sends ONLY the number id + idempotency key.
// The server loads the authoritative inventory record, computes the total,
// snapshots it onto the order and runs the pipeline. Duplicate submissions
// with the same key return the original order. KYC-verified users only.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { checkoutNumber } from "@/lib/number-server";

const bodySchema = z.object({
  numberId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(8).max(64),
});

export async function POST(req: Request) {
  try {
    const identity = await requireUser();
    await enforceUserRateLimit("checkout", identity.uid);

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: "Invalid checkout request." },
        { status: 400 },
      );
    }

    const { order, alreadyExists } = await checkoutNumber({
      uid: identity.uid,
      numberId: parsed.data.numberId,
      idempotencyKey: parsed.data.idempotencyKey,
    });

    return NextResponse.json({
      ok: true,
      alreadyExists,
      orderId: order.id,
      numberId: order.numberId,
      orderStatus: order.orderStatus,
    });
  } catch (err) {
    if (err instanceof Error) {
      if (/identity verification required/.test(err.message)) {
        return NextResponse.json(
          { code: "kyc_required", message: "Complete identity verification to activate a number." },
          { status: 403 },
        );
      }
      if (/not reserved for this checkout/.test(err.message)) {
        return NextResponse.json(
          {
            code: "reservation_expired",
            message: "Your reservation expired or was not found. Please select the number again.",
          },
          { status: 409 },
        );
      }
    }
    return jsonError(toAppError(err));
  }
}
