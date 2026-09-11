// =============================================================================
// /api/connectivity — the connectivity service API (Prompt 14).
//
// GET  — resolveConnectivity(uid): honest overview (entitlement, connection,
//        mechanisms, future boundaries, provider label, identity labels).
// POST — connection lifecycle. Clients send an action + optionally a
//        MECHANISM (never a provider id); provider selection is server-side.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { getFeatureFlags } from "@/lib/features";
import {
  resolveConnectivity,
  requestConnection,
  activateConnection,
  suspendConnection,
  terminateConnection,
} from "@/lib/connectivity-server";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    mechanism: z.enum(["cloud", "esim"]).optional(), // only operational mechanisms
    region: z.string().trim().max(60).optional(),
  }),
  z.object({
    action: z.enum(["activate", "suspend", "terminate"]),
    connectionId: z.string().trim().min(1).max(64),
  }),
]);

export async function GET() {
  try {
    const identity = await requireUser();
    const overview = await resolveConnectivity(identity.uid);
    return NextResponse.json(overview);
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

export async function POST(req: Request) {
  try {
    const identity = await requireUser();

    if (!getFeatureFlags().connectivityEnabled) {
      return NextResponse.json(
        { code: "unavailable", message: "Connectivity isn't available in this environment yet." },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Invalid connectivity request." }, { status: 400 });
    }

    if (parsed.data.action === "request") {
      await enforceUserRateLimit("connectivity_provision", identity.uid);
      const connection = await requestConnection({
        uid: identity.uid,
        mechanism: parsed.data.mechanism,
        region: parsed.data.region ?? null,
      });
      // Activate immediately in the same request for the demo lifecycle.
      const activated = await activateConnection({ uid: identity.uid, connectionId: connection.id });
      return NextResponse.json({ connection: activated });
    }

    await enforceUserRateLimit("connectivity_lifecycle", identity.uid);
    if (parsed.data.action === "activate") {
      const connection = await activateConnection({ uid: identity.uid, connectionId: parsed.data.connectionId });
      return NextResponse.json({ connection });
    }
    if (parsed.data.action === "suspend") {
      const connection = await suspendConnection({ uid: identity.uid, connectionId: parsed.data.connectionId });
      return NextResponse.json({ connection });
    }
    const connection = await terminateConnection({ uid: identity.uid, connectionId: parsed.data.connectionId });
    return NextResponse.json({ connection });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
