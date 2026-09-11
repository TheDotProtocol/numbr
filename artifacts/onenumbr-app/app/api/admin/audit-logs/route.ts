// =============================================================================
// GET /api/admin/audit-logs — paginated audit trail (admin only).
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { getAdminDb } from "@/firebase/admin";
import { toAppError } from "@/lib/errors";

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 25) || 25, 100);

    let q = getAdminDb()
      .collection("audit_logs")
      .orderBy("createdAt", "desc")
      .limit(limit + 1);

    if (cursor) {
      const cursorSnap = await getAdminDb().collection("audit_logs").doc(cursor).get();
      if (cursorSnap.exists) q = q.startAfter(cursorSnap);
    }

    const snap = await q.get();
    const docs = snap.docs.slice(0, limit);
    const hasMore = snap.docs.length > limit;
    const nextCursor = hasMore ? docs[docs.length - 1].id : null;

    const logs = docs.map((d) => ({
      id: d.id,
      actorUid: String(d.data().actorUid ?? ""),
      action: String(d.data().action ?? ""),
      targetUid: d.data().targetUid ? String(d.data().targetUid) : null,
      metadata: (d.data().metadata ?? {}) as Record<string, unknown>,
      createdAt: d.data().createdAt?.toMillis?.() ?? null,
    }));

    return NextResponse.json({ logs, nextCursor });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
