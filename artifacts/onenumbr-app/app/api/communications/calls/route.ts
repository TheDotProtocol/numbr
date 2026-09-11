// =============================================================================
// /api/communications/calls — demo call lifecycle via the mock provider.
// GET  ?limit=25 — call history (owner-scoped)
// POST { action: "initiate", to } | { action: "update", callId, status, terminationReason? }
//
// Provider is mock-communications: every call is a clearly-labeled simulation.
// The client never sends uid, number ownership, or provider data.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { getFeatureFlags } from "@/lib/features";
import { initiateCall, listCalls, updateCall } from "@/lib/communications-server";
import type { CallStatus, CallTerminationReason } from "@/types/communications";

const updateSchema = z.object({
  action: z.literal("update"),
  callId: z.string().trim().min(1),
  status: z.enum(["ringing", "answered", "ended"]),
  terminationReason: z
    .enum(["hangup", "caller_hangup", "callee_hangup", "cancelled", "failed", "busy", "no_answer", "blocked"])
    .optional(),
});

const initiateSchema = z.object({
  action: z.literal("initiate"),
  numberId: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).max(60),
});

const bodySchema = z.discriminatedUnion("action", [initiateSchema, updateSchema]);

export async function GET(req: Request) {
  try {
    const identity = await requireUser();
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 25) || 25, 50);
    const calls = await listCalls(identity.uid, limit);
    return NextResponse.json({ calls });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

export async function POST(req: Request) {
  try {
    const identity = await requireUser();
    if (!getFeatureFlags().voiceEnabled) {
      return NextResponse.json(
        { code: "unavailable", message: "Voice isn't available in this environment yet." },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Invalid call request." }, { status: 400 });
    }

    if (parsed.data.action === "initiate") {
      await enforceUserRateLimit("comm_call", identity.uid);
      const call = await initiateCall({
        uid: identity.uid,
        numberId: parsed.data.numberId,
        to: parsed.data.to,
      });
      return NextResponse.json({ call });
    }

    await enforceUserRateLimit("comm_call", identity.uid);
    const call = await updateCall({
      uid: identity.uid,
      callId: parsed.data.callId,
      status: parsed.data.status as CallStatus,
      terminationReason: parsed.data.terminationReason as CallTerminationReason | undefined,
    });
    return NextResponse.json({ call });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
