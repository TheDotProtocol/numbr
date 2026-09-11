// =============================================================================
// /api/communications/endpoints — endpoint manager (Prompt 12).
// GET   — list the caller's endpoints
// POST  — register an endpoint { type, name, platform?, deviceId?, metadata? }
// PATCH — { endpointId, action: "set_primary" | "set_presence", presence? }
//
// Identity, number ownership and uid are ALWAYS resolved server-side.
// Registration never mutates identity or number records.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { getFeatureFlags } from "@/lib/features";
import {
  listEndpointsForUser,
  registerEndpoint,
  setEndpointPresence,
  setPrimaryEndpoint,
  simulateInboundRouting,
} from "@/lib/endpoints-server";
import type { EndpointPresence, EndpointType } from "@/types/endpoints";

const registerSchema = z.object({
  type: z.enum(["web", "mobile_app", "tau_phone", "tau_talk", "verified_device"]),
  name: z.string().trim().min(1, "Endpoint name is required.").max(60),
  platform: z.string().trim().max(40).optional(),
  deviceId: z.string().trim().max(80).nullable().optional(),
  metadata: z.record(z.string(), z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).optional(),
});

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_primary"),
    endpointId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal("set_presence"),
    endpointId: z.string().trim().min(1),
    presence: z.enum(["online", "offline", "busy", "unavailable", "suspended"]),
  }),
]);

export async function GET() {
  try {
    const identity = await requireUser();
    if (!getFeatureFlags().endpointsEnabled) {
      return NextResponse.json(
        { code: "unavailable", message: "Endpoints aren't available in this environment yet." },
        { status: 503 },
      );
    }
    const endpoints = await listEndpointsForUser(identity.uid);
    return NextResponse.json({ endpoints });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

export async function POST(req: Request) {
  try {
    const identity = await requireUser();
    const flags = getFeatureFlags();
    if (!flags.endpointsEnabled) {
      return NextResponse.json(
        { code: "unavailable", message: "Endpoints aren't available in this environment yet." },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: parsed.error.issues[0]?.message ?? "Invalid endpoint registration." },
        { status: 400 },
      );
    }

    if (parsed.data.type === "tau_phone" && !flags.tauPhoneEndpointEnabled) {
      return NextResponse.json({ code: "unavailable", message: "TauPhone isn't available yet." }, { status: 503 });
    }
    if (parsed.data.type === "tau_talk" && !flags.tauTalkEndpointEnabled) {
      return NextResponse.json({ code: "unavailable", message: "TauTalk isn't available yet." }, { status: 503 });
    }

    await enforceUserRateLimit("endpoint_register", identity.uid);
    const endpoint = await registerEndpoint({
      uid: identity.uid,
      type: parsed.data.type as EndpointType,
      name: parsed.data.name,
      platform: parsed.data.platform,
      deviceId: parsed.data.deviceId ?? null,
      metadata: parsed.data.metadata,
    });
    return NextResponse.json({ endpoint });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

export async function PATCH(req: Request) {
  try {
    const identity = await requireUser();
    const flags = getFeatureFlags();
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Invalid endpoint update." }, { status: 400 });
    }

    if (parsed.data.action === "set_primary") {
      await enforceUserRateLimit("endpoint_activate", identity.uid);
      const endpoint = await setPrimaryEndpoint({ uid: identity.uid, endpointId: parsed.data.endpointId });
      return NextResponse.json({ endpoint });
    }

    if (!flags.endpointPresenceEnabled) {
      return NextResponse.json(
        { code: "unavailable", message: "Presence isn't available in this environment yet." },
        { status: 503 },
      );
    }
    await enforceUserRateLimit("endpoint_activate", identity.uid);
    const endpoint = await setEndpointPresence({
      uid: identity.uid,
      endpointId: parsed.data.endpointId,
      presence: parsed.data.presence as EndpointPresence,
    });
    return NextResponse.json({ endpoint });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

/** GET-like simulation endpoint for routing decisions (kept POST to avoid caching). */
export async function PUT(req: Request) {
  try {
    const identity = await requireUser();
    if (!getFeatureFlags().endpointRoutingEnabled) {
      return NextResponse.json(
        { code: "unavailable", message: "Routing simulation isn't available in this environment yet." },
        { status: 503 },
      );
    }
    const body = (await req.json().catch(() => ({}))) as { kind?: string };
    const kind = body.kind === "message" ? "message" : "call";
    await enforceUserRateLimit("endpoint_routing_update", identity.uid);
    const decision = await simulateInboundRouting({ uid: identity.uid, kind });
    return NextResponse.json({ decision });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
