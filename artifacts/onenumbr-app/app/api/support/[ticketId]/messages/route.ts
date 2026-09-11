// =============================================================================
// POST /api/support/[ticketId]/messages — customer reply with optional
// attachments. Attachments must already be uploaded to the caller's private
// support/{uid}/ Storage scope; paths are re-validated server-side.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiIdentity, jsonError } from "@/lib/api";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { toAppError } from "@/lib/errors";
import { addCustomerMessage, validateAttachmentPaths } from "@/lib/support-server";

const attachmentSchema = z.object({
  path: z.string().trim().min(1).max(512),
  name: z.string().trim().min(1).max(200),
  size: z.number().int().positive().max(10 * 1024 * 1024),
  contentType: z.enum(["image/png", "image/jpeg", "application/pdf"]),
});

const bodySchema = z.object({
  message: z.string().trim().min(1).max(5000),
  attachments: z.array(attachmentSchema).max(5).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  try {
    const identity = await getApiIdentity();
    if (!identity) return NextResponse.json({ code: "unauthorized", message: "Authentication required." }, { status: 401 });
    await enforceUserRateLimit("support_reply", identity.uid);

    const { ticketId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Message can't be empty (max 5000 characters)." }, { status: 400 });
    }

    // Defense in depth: every attachment path must live inside the caller's
    // private scope and actually exist in Storage.
    const attachments = parsed.data.attachments ?? [];
    await validateAttachmentPaths(identity.uid, attachments);

    const message = await addCustomerMessage({
      uid: identity.uid,
      ticketId,
      message: parsed.data.message,
      attachments,
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
