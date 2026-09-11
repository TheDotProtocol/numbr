// =============================================================================
// GET /api/admin/operations — operational snapshot for the ops dashboard.
// Deterministic, bounded queries over existing systems. Optional
// ?refresh=1 re-evaluates and persists the alert snapshot first.
// =============================================================================

import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { requireStaff } from "@/lib/admin-server";
import { getOpsSnapshot, refreshOpsSnapshot } from "@/lib/operations-server";

export async function GET(req: Request) {
  try {
    await requireStaff();
    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    if (refresh) await refreshOpsSnapshot();
    const snapshot = await getOpsSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
