// =============================================================================
// /api/communications/messages — demo messaging via the mock provider.
// GET  ?limit=25 — message history (owner-scoped)
// POST { action: "send", to, body }
//      { action: "simulate_inbound", from, body }   ← clearly-labeled demo
//      { action: "mark_read", messageId }
//
// OneNumbr messaging is APPLICATION messaging in this environment — it is not
// PSTN SMS and must never be presented as such.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { getFeatureFlags } from "@/lib/features";
import { listMessages, markMessageRead, receiveDemoMessage, sendMessage } from "@/lib/communications-server";

const sendSchema = z.object({
  action: z.literal("send"),
  numberId: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1, "Message can't be empty.").max(1000, "Message is too long."),
});

const inboundSchema = z.object({
  action: z.literal("simulate_inbound"),
  numberId: z.string().trim().min(1).optional(),
  from: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(1000),
});

const readSchema = z.object({
  action: z.literal("mark_read"),
  messageId: z.string().trim().min(1),
});

const bodySchema = z.discriminatedUnion("action", [sendSchema, inboundSchema, readSchema]);

export async function GET(req: Request) {
  try {
    const identity = await requireUser();
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 25) || 25, 50);
    const messages = await listMessages(identity.uid, limit);
    return NextResponse.json({ messages });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

export async function POST(req: Request) {
  try {
    const identity = await requireUser();
    if (!getFeatureFlags().messagingEnabled) {
      return NextResponse.json(
        { code: "unavailable", message: "Messaging isn't available in this environment yet." },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: parsed.error.issues[0]?.message ?? "Invalid message request." },
        { status: 400 },
      );
    }

    await enforceUserRateLimit("comm_message", identity.uid);

    if (parsed.data.action === "send") {
      const message = await sendMessage({
        uid: identity.uid,
        numberId: parsed.data.numberId,
        to: parsed.data.to,
        body: parsed.data.body,
      });
      return NextResponse.json({ message });
    }
    if (parsed.data.action === "simulate_inbound") {
      const message = await receiveDemoMessage({
        uid: identity.uid,
        numberId: parsed.data.numberId,
        from: parsed.data.from,
        body: parsed.data.body,
      });
      return NextResponse.json({ message });
    }
    const message = await markMessageRead(identity.uid, parsed.data.messageId);
    return NextResponse.json({ message });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
