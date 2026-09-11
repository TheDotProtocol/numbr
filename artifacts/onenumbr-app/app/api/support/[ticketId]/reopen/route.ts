// =============================================================================
// POST /api/support/[ticketId]/reopen — customer reopens a closed case.
// =============================================================================

import { NextResponse } from "next/server";
import { getApiIdentity, jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { customerSetStatus } from "@/lib/support-server";

export async function POST(_req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const identity = await getApiIdentity();
    if (!identity) return NextResponse.json({ code: "unauthorized", message: "Authentication required." }, { status: 401 });

    const { ticketId } = await params;
    const ticket = await customerSetStatus({ uid: identity.uid, ticketId, action: "reopen" });
    return NextResponse.json({ ticket });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
