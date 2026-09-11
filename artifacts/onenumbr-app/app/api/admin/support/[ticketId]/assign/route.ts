// =============================================================================
// POST /api/admin/support/[ticketId]/assign — assign / reassign / unassign.
// Body: { assignedTo: string | null }. Admin identity comes from the verified
// session — never from the body.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiIdentity, jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { requireStaff } from "@/lib/admin-server";
import { assignTicket } from "@/lib/support-server";

const bodySchema = z.object({
  assignedTo: z.string().trim().min(1).max(128).nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const identity = await requireStaff();
    const { ticketId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Invalid assignment." }, { status: 400 });
    }

    const ticket = await assignTicket({
      actorUid: identity.uid,
      ticketId,
      assignedTo: parsed.data.assignedTo,
    });
    return NextResponse.json({ ticket });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
