// =============================================================================
// GET /api/admin/support/[ticketId] — full ticket detail for staff: the
// conversation AND internal notes (staff-authorized; customers can never
// reach this route).
// =============================================================================

import { NextResponse } from "next/server";
import { getApiIdentity, jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { requireStaff } from "@/lib/admin-server";
import { getTicketForAdmin } from "@/lib/support-server";

export async function GET(_req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    await requireStaff();
    const { ticketId } = await params;
    const ticket = await getTicketForAdmin(ticketId);
    return NextResponse.json({ ticket });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
