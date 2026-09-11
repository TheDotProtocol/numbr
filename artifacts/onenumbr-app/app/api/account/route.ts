// =============================================================================
// GET /api/account — unified account summary (one call for the dashboard).
// Identity is derived from the verified session; the client never supplies
// a uid. The current session is matched server-side.
// =============================================================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { getAccountSummary } from "@/lib/account-server";
import { SESSION_COOKIE } from "@/lib/api";

export async function GET() {
  try {
    const identity = await requireUser();
    const cookieStore = await cookies();
    const currentSessionId = cookieStore.get("onenumbr_client_session")?.value ?? null;
    const summary = await getAccountSummary(identity.uid, currentSessionId);
    return NextResponse.json(summary);
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
