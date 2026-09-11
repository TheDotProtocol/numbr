// =============================================================================
// /api/communications/endpoints/[endpointId] — endpoint detail + lifecycle.
// GET    — owner-only detail
// POST   — { action: "revoke" | "activate" | "suspend", reason? }
//
// Revocation is terminal: the record is preserved (history), the endpoint is
// immediately unusable, and re-access requires a fresh registration.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { activateEndpoint, getEndpointForUser, revokeEndpoint, suspendEndpoint } from "@/lib/endpoints-server";

const actionSchema = z.object({
  action: z.enum(["revoke", "activate", "suspend"]),
  reason: z.string().trim().max(120).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ endpointId: string }> }) {
  try {
    const identity = await requireUser();
    const { endpointId } = await params;
    const endpoint = await getEndpointForUser(identity.uid, endpointId);
    return NextResponse.json({ endpoint });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ endpointId: string }> }) {
  try {
    const identity = await requireUser();
    const { endpointId } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Invalid endpoint action." }, { status: 400 });
    }

    if (parsed.data.action === "revoke") {
      await enforceUserRateLimit("endpoint_revoke", identity.uid);
      const endpoint = await revokeEndpoint({
        uid: identity.uid,
        endpointId,
        reason: parsed.data.reason,
      });
      return NextResponse.json({ endpoint });
    }
    if (parsed.data.action === "activate") {
      await enforceUserRateLimit("endpoint_activate", identity.uid);
      const endpoint = await activateEndpoint({ uid: identity.uid, endpointId });
      return NextResponse.json({ endpoint });
    }
    await enforceUserRateLimit("endpoint_revoke", identity.uid);
    const endpoint = await suspendEndpoint({ uid: identity.uid, endpointId });
    return NextResponse.json({ endpoint });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
