// =============================================================================
// POST /api/number/release — release a number (owner only).
// Body: { numberId }
//
// Ownership is verified server-side against the active assignment AND the
// number record; URL parameters alone are never trusted. The assignment
// history is preserved (releasedAt stamped, row never deleted).
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { releaseUserNumber } from "@/lib/number-server";

const bodySchema = z.object({ numberId: z.string().trim().min(1) });

export async function POST(req: Request) {
  try {
    const identity = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: "Invalid release request." },
        { status: 400 },
      );
    }

    await releaseUserNumber({ uid: identity.uid, numberId: parsed.data.numberId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
