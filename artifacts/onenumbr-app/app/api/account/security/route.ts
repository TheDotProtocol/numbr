// =============================================================================
// GET /api/account/security — security center data.
// Returns the account security record + sessions + devices with the current
// session/device resolved SERVER-side (via the client session cookie).
// =============================================================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import {
  getOrCreateAccountSecurity,
  listDevices,
  listSessions,
} from "@/lib/account-server";
import { getTwoFactorProvider } from "@/providers";
import { SESSION_COOKIE } from "@/lib/api";

export async function GET() {
  try {
    const identity = await requireUser();
    const cookieStore = await cookies();
    const currentSessionId = cookieStore.get("onenumbr_client_session")?.value ?? null;
    const currentDeviceId = cookieStore.get("onenumbr_client_device")?.value ?? null;

    const [security, sessions, devices] = await Promise.all([
      getOrCreateAccountSecurity(identity.uid),
      listSessions(identity.uid, currentSessionId),
      listDevices(identity.uid, currentDeviceId),
    ]);

    return NextResponse.json({
      security,
      sessions,
      devices,
      twoFactorAvailable: getTwoFactorProvider().available,
    });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
