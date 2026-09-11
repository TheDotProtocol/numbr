// =============================================================================
// GET /api/billing/payment-methods — the user's payment methods.
// Prompt 5: a single lazily-created Demo Payment Method (mock provider).
// No card data exists anywhere; real provider-backed methods come later.
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { getOrCreateDefaultPaymentMethod } from "@/lib/billing-server";

export async function GET() {
  try {
    const identity = await requireUser();
    const methods = [await getOrCreateDefaultPaymentMethod(identity.uid)];
    return NextResponse.json({ methods });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
