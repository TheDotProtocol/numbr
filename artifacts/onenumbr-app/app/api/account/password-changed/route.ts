// =============================================================================
// POST /api/account/password-changed — called by the client AFTER Firebase
// Auth reports a successful password change. Records the security timeline
// event, audit log and notification server-side. Never receives or stores
// the password itself.
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { recordPasswordChanged } from "@/lib/account-server";

export async function POST() {
  try {
    const identity = await requireUser();
    await recordPasswordChanged(identity.uid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
