// =============================================================================
// GET /api/account/activity — security activity timeline (paginated).
// GET?cursor=…&limit=25
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { listSecurityActivity } from "@/lib/account-server";

export async function GET(req: Request) {
  try {
    const identity = await requireUser();
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? 25);
    const result = await listSecurityActivity(
      identity.uid,
      Number.isFinite(limit) ? limit : 25,
      cursor,
    );
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
