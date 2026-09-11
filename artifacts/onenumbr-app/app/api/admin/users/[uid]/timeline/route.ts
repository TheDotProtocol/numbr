// =============================================================================
// GET /api/admin/users/[uid]/timeline — unified customer activity timeline
// for the Customer 360 view (staff-authorized, bounded per-source reads).
// =============================================================================

import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { requireStaff } from "@/lib/admin-server";
import { getCustomer360 } from "@/lib/operations-server";

export async function GET(_req: Request, { params }: { params: Promise<{ uid: string }> }) {
  try {
    await requireStaff();
    const { uid } = await params;
    const snapshot = await getCustomer360(uid);
    return NextResponse.json(snapshot);
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
