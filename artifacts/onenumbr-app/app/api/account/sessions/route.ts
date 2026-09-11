// =============================================================================
// GET  /api/account/sessions                → active sessions (server-side
//                                             current-session resolution)
// POST /api/account/sessions  { action }    → "revoke" { sessionId }
//                                             | "revoke_others"
//                                             | "revoke_all"
// Ownership is verified server-side; a client can never revoke another
// user's session by supplying arbitrary ids.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { listSessions, revokeAllSessions, revokeSession } from "@/lib/account-server";
import { SESSION_COOKIE } from "@/lib/api";

export async function GET() {
  try {
    const identity = await requireUser();
    const cookieStore = await cookies();
    const currentSessionId = cookieStore.get("onenumbr_client_session")?.value ?? null;
    const sessions = await listSessions(identity.uid, currentSessionId);
    return NextResponse.json({ sessions });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("revoke"), sessionId: z.string().trim().min(1) }),
  z.object({ action: z.literal("revoke_others") }),
  z.object({ action: z.literal("revoke_all") }),
]);

export async function POST(req: Request) {
  try {
    const identity = await requireUser();
    const cookieStore = await cookies();
    const currentSessionId = cookieStore.get("onenumbr_client_session")?.value ?? null;

    const body = await req.json().catch(() => ({}));
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Unknown action." }, { status: 400 });
    }

    if (parsed.data.action === "revoke") {
      await revokeSession({
        uid: identity.uid,
        sessionId: parsed.data.sessionId,
        actorUid: identity.uid,
      });
      return NextResponse.json({ ok: true });
    }

    const count = await revokeAllSessions({
      uid: identity.uid,
      exceptSessionId: parsed.data.action === "revoke_others" ? currentSessionId : null,
      actorUid: identity.uid,
    });
    return NextResponse.json({ ok: true, revoked: count });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
