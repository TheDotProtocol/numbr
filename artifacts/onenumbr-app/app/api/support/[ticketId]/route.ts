// =============================================================================
// GET /api/support/[ticketId] — one of the caller's cases (messages only;
// internal notes are never projected here).
// =============================================================================

import { NextResponse } from "next/server";
import { getApiIdentity, jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { getTicketForCustomer } from "@/lib/support-server";

export async function GET(_req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const identity = await getApiIdentity();
    if (!identity) return NextResponse.json({ code: "unauthorized", message: "Authentication required." }, { status: 401 });

    const { ticketId } = await params;
    const ticket = await getTicketForCustomer(identity.uid, ticketId);
    return NextResponse.json({ ticket });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
