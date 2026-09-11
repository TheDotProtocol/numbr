// =============================================================================
// POST /api/admin/support/[ticketId]/notes — internal note (staff-authorized).
// Notes live in a subcollection the customer API never reads.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiIdentity, jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { requireStaff } from "@/lib/admin-server";
import { addInternalNote } from "@/lib/support-server";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(5000),
});

export async function POST(req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const identity = await requireStaff();
    const { ticketId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Note can't be empty." }, { status: 400 });
    }

    const note = await addInternalNote({
      actorUid: identity.uid,
      actorName: identity.email.split("@")[0] || "Staff",
      ticketId,
      message: parsed.data.message,
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
