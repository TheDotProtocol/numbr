// =============================================================================
// /api/communications/voicemails — demo voicemail via the mock provider.
// GET  ?limit=25
// POST { action: "simulate", caller, durationSeconds, transcript }
//      { action: "mark_read", voicemailId }
//
// Demo transcripts only — no audio is stored in this environment.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { getFeatureFlags } from "@/lib/features";
import { createDemoVoicemail, listVoicemails, markVoicemailRead } from "@/lib/communications-server";

const simulateSchema = z.object({
  action: z.literal("simulate"),
  numberId: z.string().trim().min(1).optional(),
  caller: z.string().trim().min(1).max(60),
  durationSeconds: z.number().int().min(1).max(600),
  transcript: z.string().trim().min(1).max(1000),
});

const readSchema = z.object({
  action: z.literal("mark_read"),
  voicemailId: z.string().trim().min(1),
});

const bodySchema = z.discriminatedUnion("action", [simulateSchema, readSchema]);

export async function GET(req: Request) {
  try {
    const identity = await requireUser();
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 25) || 25, 50);
    const voicemails = await listVoicemails(identity.uid, limit);
    return NextResponse.json({ voicemails });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

export async function POST(req: Request) {
  try {
    const identity = await requireUser();
    if (!getFeatureFlags().voicemailEnabled) {
      return NextResponse.json(
        { code: "unavailable", message: "Voicemail isn't available in this environment yet." },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: parsed.error.issues[0]?.message ?? "Invalid voicemail request." },
        { status: 400 },
      );
    }

    await enforceUserRateLimit("comm_message", identity.uid);

    if (parsed.data.action === "simulate") {
      const voicemail = await createDemoVoicemail({
        uid: identity.uid,
        numberId: parsed.data.numberId,
        caller: parsed.data.caller,
        durationSeconds: parsed.data.durationSeconds,
        transcript: parsed.data.transcript,
      });
      return NextResponse.json({ voicemail });
    }
    const voicemail = await markVoicemailRead(identity.uid, parsed.data.voicemailId);
    return NextResponse.json({ voicemail });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
