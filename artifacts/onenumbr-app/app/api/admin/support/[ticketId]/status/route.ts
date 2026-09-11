// =============================================================================
// POST /api/admin/support/[ticketId]/status — change ticket status (staff).
// Body: { status: TicketStatus }
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiIdentity, jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { requireStaff } from "@/lib/admin-server";
import { adminSetTicketStatus } from "@/lib/support-server";

const bodySchema = z.object({
  status: z.enum(["open", "in_progress", "waiting_for_customer", "waiting_for_provider", "resolved", "closed"]),
});

export async function POST(req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const identity = await requireStaff();
    const { ticketId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Invalid status." }, { status: 400 });
    }

    const ticket = await adminSetTicketStatus({
      actorUid: identity.uid,
      ticketId,
      status: parsed.data.status,
    });
    return NextResponse.json({ ticket });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
