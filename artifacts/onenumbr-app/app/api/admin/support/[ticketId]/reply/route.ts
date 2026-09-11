// =============================================================================
// POST /api/admin/support/[ticketId]/reply — agent reply (staff-authorized).
// Body: { message, setWaitingForCustomer? }
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiIdentity, jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { requireStaff } from "@/lib/admin-server";
import { addAgentReply } from "@/lib/support-server";

const bodySchema = z.object({
  message: z.string().trim().min(1).max(5000),
  setWaitingForCustomer: z.boolean().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const identity = await requireStaff();
    const { ticketId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Message can't be empty (max 5000 characters)." }, { status: 400 });
    }

    const message = await addAgentReply({
      actorUid: identity.uid, // admin identity from the verified session
      actorName: identity.email.split("@")[0] || "Support",
      ticketId,
      message: parsed.data.message,
      setWaitingForCustomer: parsed.data.setWaitingForCustomer ?? false,
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
