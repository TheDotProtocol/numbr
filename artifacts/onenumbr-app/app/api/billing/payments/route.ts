// =============================================================================
// GET /api/billing/payments        → the user's payment history
// GET /api/billing/payments?id=…   → one payment (owner-checked; 403 otherwise)
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { getUserPayment, getUserPayments } from "@/lib/billing-server";

export async function GET(req: Request) {
  try {
    const identity = await requireUser();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (id) {
      const payment = await getUserPayment(identity.uid, id);
      return NextResponse.json({ payment });
    }

    const payments = await getUserPayments(identity.uid);
    return NextResponse.json({ payments });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
