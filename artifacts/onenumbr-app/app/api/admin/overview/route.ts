// =============================================================================
// GET /api/admin/overview — platform stats for the admin dashboard.
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { getAdminDb } from "@/firebase/admin";
import { toAppError } from "@/lib/errors";

export async function GET() {
  try {
    const identity = await requireAdmin();

    const db = getAdminDb();
    const [users, ids, audit] = await Promise.all([
      db.collection("users").count().get(),
      db.collection("onenumbr_ids").count().get(),
      db.collection("audit_logs").orderBy("createdAt", "desc").limit(10).get(),
    ]);

    const recentLogs = audit.docs.map((d) => {
      const data = d.data();
      const createdAt = data.createdAt?.toMillis?.() ?? null;
      return {
        id: d.id,
        actorUid: String(data.actorUid ?? ""),
        action: String(data.action ?? ""),
        targetUid: data.targetUid ? String(data.targetUid) : null,
        createdAt,
      };
    });

    return NextResponse.json({
      totals: {
        users: users.data().count,
        identitiesIssued: ids.data().count,
      },
      recentAuditLogs: recentLogs,
      viewer: { uid: identity.uid },
    });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
