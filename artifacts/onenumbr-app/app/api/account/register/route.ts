// =============================================================================
// POST /api/account/register — register/refresh the current session+device.
//
// Auth: Authorization: Bearer <ID token> (verified per request). The body's
// deviceId is only a correlation key — identity and ownership come from the
// token. Returns the server-issued sessionId the client stores in a cookie
// so every later read resolves "current session" server-side.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiIdentity } from "@/lib/api";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { registerSession } from "@/lib/account-server";

const bodySchema = z.object({
  deviceId: z.string().trim().min(8).max(64).optional(),
  userAgent: z.string().trim().max(300).default(""),
  platform: z.string().trim().max(40).optional(),
  browser: z.string().trim().max(40).optional(),
});

export async function POST(req: Request) {
  try {
    const identity = await getApiIdentity();
    if (!identity) {
      return NextResponse.json(
        { code: "unauthorized", message: "Authentication required." },
        { status: 401 },
      );
    }
    await enforceUserRateLimit("session_register", identity.uid);
    if (!identity.emailVerified) {
      return NextResponse.json(
        { code: "email_unverified", message: "Verify your email first." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Invalid registration." }, { status: 400 });
    }

    const { sessionId, deviceId } = await registerSession({
      uid: identity.uid,
      deviceId: parsed.data.deviceId,
      userAgent: parsed.data.userAgent,
    });
    return NextResponse.json({ ok: true, sessionId, deviceId });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
