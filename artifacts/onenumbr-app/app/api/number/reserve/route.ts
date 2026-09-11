// =============================================================================
// POST /api/number/reserve — temporarily hold a number for checkout.
// Body: { numberId }
//
// Reservation lives 15 minutes (server-side TTL); expired holds are released
// lazily by the search/checkout paths. Idempotent for the same user.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { reserveNumber } from "@/lib/number-server";

const bodySchema = z.object({ numberId: z.string().trim().min(1) });

export async function POST(req: Request) {
  try {
    const identity = await requireUser();
    await enforceUserRateLimit("number_reserve", identity.uid);
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: "Invalid reservation request." },
        { status: 400 },
      );
    }

    const result = await reserveNumber({ uid: identity.uid, numberId: parsed.data.numberId });
    return NextResponse.json({ ok: true, reservationExpiresAt: result.reservationExpiresAt });
  } catch (err) {
    if (err instanceof Error && /no longer available/.test(err.message)) {
      return NextResponse.json(
        { code: "number_unavailable", message: "This number was just taken by someone else." },
        { status: 409 },
      );
    }
    return jsonError(toAppError(err));
  }
}
