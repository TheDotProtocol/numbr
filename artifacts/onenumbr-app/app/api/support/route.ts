// =============================================================================
// GET  /api/support           — the caller's support cases
// POST /api/support           — create a new case
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiIdentity, jsonError } from "@/lib/api";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { toAppError } from "@/lib/errors";
import { createTicket, listCustomerTickets } from "@/lib/support-server";
import { TICKET_CATEGORY_OPTIONS } from "@/types/support";

const createSchema = z.object({
  category: z.enum(TICKET_CATEGORY_OPTIONS.map((c) => c.value) as [string, ...string[]]),
  subject: z.string().trim().min(4).max(120),
  description: z.string().trim().min(10).max(5000),
  relatedEntityType: z.enum(["esim_order", "esim", "number_order", "number", "payment", "invoice", "none"]).optional(),
  relatedEntityId: z.string().trim().max(128).nullish(),
});

export async function GET() {
  try {
    const identity = await getApiIdentity();
        if (!identity) return NextResponse.json({ code: "unauthorized", message: "Authentication required." }, { status: 401 });

    const tickets = await listCustomerTickets(identity.uid, 50);
    return NextResponse.json({ tickets });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

export async function POST(req: Request) {
  try {
    const identity = await getApiIdentity();
    if (!identity) return NextResponse.json({ code: "unauthorized", message: "Authentication required." }, { status: 401 });
    await enforceUserRateLimit("support_create", identity.uid);

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: "Please complete the subject and description fields." },
        { status: 400 },
      );
    }

    const ticket = await createTicket({
      uid: identity.uid, // identity from the verified session — never the body
      category: parsed.data.category as Parameters<typeof createTicket>[0]["category"],
      subject: parsed.data.subject,
      description: parsed.data.description,
      relatedEntityType: parsed.data.relatedEntityType ?? "none",
      relatedEntityId: parsed.data.relatedEntityId ?? null,
    });
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
