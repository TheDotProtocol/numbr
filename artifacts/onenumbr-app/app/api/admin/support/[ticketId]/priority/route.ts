// =============================================================================
// POST /api/admin/support/[ticketId]/priority — change ticket priority (staff).
// Body: { priority: TicketPriority }
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiIdentity, jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { requireStaff } from "@/lib/admin-server";
import { adminSetTicketPriority } from "@/lib/support-server";

const bodySchema = z.object({
  priority: z.enum(["low", "normal", "high", "urgent"]),
});

export async function POST(req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const identity = await requireStaff();
    const { ticketId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Invalid priority." }, { status: 400 });
    }

    const ticket = await adminSetTicketPriority({
      actorUid: identity.uid,
      ticketId,
      priority: parsed.data.priority,
    });
    return NextResponse.json({ ticket });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
