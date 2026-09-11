// =============================================================================
// GET /api/billing/invoices        → the user's invoices
// GET /api/billing/invoices?id=…   → one invoice (owner-checked; 403 otherwise)
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { getUserInvoice, getUserInvoices } from "@/lib/billing-server";

export async function GET(req: Request) {
  try {
    const identity = await requireUser();
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (id) {
      const invoice = await getUserInvoice(identity.uid, id);
      return NextResponse.json({ invoice });
    }

    const invoices = await getUserInvoices(identity.uid);
    return NextResponse.json({ invoices });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
