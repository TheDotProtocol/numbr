// =============================================================================
// GET /api/billing/overview — user billing dashboard data (single call).
//   recent payments + invoices + subscriptions + default payment method
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { getBillingOverview } from "@/lib/billing-server";

export async function GET() {
  try {
    const identity = await requireUser();
    const overview = await getBillingOverview(identity.uid);
    return NextResponse.json(overview);
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
