// =============================================================================
// /api/communications/routing — routing rules + communication endpoints.
// GET    — routing rules for the primary number + endpoint list
// PUT    { steps, forwardEndpointId?, ringTimeoutSeconds? }
// POST   { kind, label, target? }            — add endpoint
// PATCH  { endpointId, label?, enabled? }    — rename / enable / disable
//
// Routing is architectural preparation (Prompt 11): it models the inbound
// evaluation order but performs no carrier forwarding.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import {
  addEndpoint,
  getOwnedNumberView,
  getRoutingRules,
  listEndpoints,
  updateEndpoint,
  updateRoutingRules,
} from "@/lib/communications-server";

const routingSchema = z.object({
  steps: z.array(z.enum(["app", "tau_phone", "verified_device", "forward", "voicemail"])).min(1).max(5),
  forwardEndpointId: z.string().trim().min(1).nullable().optional(),
  ringTimeoutSeconds: z.number().int().min(5).max(60).optional(),
});

const addEndpointSchema = z.object({
  kind: z.enum(["web", "mobile_app", "tau_phone", "verified_device", "forwarding_destination", "voicemail", "sip", "pstn"]),
  label: z.string().trim().min(1).max(60),
  target: z.string().trim().max(120).nullable().optional(),
});

const patchEndpointSchema = z.object({
  endpointId: z.string().trim().min(1),
  label: z.string().trim().min(1).max(60).optional(),
  enabled: z.boolean().optional(),
});

export async function GET() {
  try {
    const identity = await requireUser();
    const number = await getOwnedNumberView(identity.uid);
    const [routing, endpoints] = await Promise.all([
      getRoutingRules(identity.uid, number.numberId),
      listEndpoints(identity.uid),
    ]);
    return NextResponse.json({ number, routing, endpoints });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

export async function PUT(req: Request) {
  try {
    const identity = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = routingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: parsed.error.issues[0]?.message ?? "Invalid routing rules." },
        { status: 400 },
      );
    }
    await enforceUserRateLimit("comm_routing", identity.uid);
    const number = await getOwnedNumberView(identity.uid);
    const routing = await updateRoutingRules({
      uid: identity.uid,
      numberId: number.numberId,
      steps: parsed.data.steps,
      forwardEndpointId: parsed.data.forwardEndpointId ?? null,
      ringTimeoutSeconds: parsed.data.ringTimeoutSeconds,
    });
    return NextResponse.json({ routing });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

export async function POST(req: Request) {
  try {
    const identity = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = addEndpointSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Invalid endpoint." }, { status: 400 });
    }
    await enforceUserRateLimit("comm_endpoint", identity.uid);
    const endpoint = await addEndpoint({
      uid: identity.uid,
      kind: parsed.data.kind,
      label: parsed.data.label,
      target: parsed.data.target ?? null,
    });
    return NextResponse.json({ endpoint });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

export async function PATCH(req: Request) {
  try {
    const identity = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = patchEndpointSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Invalid endpoint update." }, { status: 400 });
    }
    await enforceUserRateLimit("comm_endpoint", identity.uid);
    const endpoint = await updateEndpoint({
      uid: identity.uid,
      endpointId: parsed.data.endpointId,
      label: parsed.data.label,
      enabled: parsed.data.enabled,
    });
    return NextResponse.json({ endpoint });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
