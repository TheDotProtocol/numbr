// =============================================================================
// GET /api/kyc/admin/queue — KYC queue for the admin workstation.
// Query: ?status=<kycStatus>&cursor=<uid>&limit=25&q=<email/onenumbr substring>
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { listKycQueue } from "@/lib/kyc-server";
import { toAppError } from "@/lib/errors";

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 25) || 25, 100);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

    const { cases, nextCursor } = await listKycQueue({ status, cursor, limit });

    // Page-level search across the denormalized display fields. For V1 the
    // queue is small; a dedicated search index can replace this later.
    const filtered = q
      ? cases.filter(
          (c) =>
            c.email.toLowerCase().includes(q) ||
            (c.onenumbr ?? "").toLowerCase().includes(q),
        )
      : cases;

    return NextResponse.json({ cases: filtered, nextCursor });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
