// =============================================================================
// POST /api/admin/users/[uid]/status — suspend/reactivate an account.
// Body: { status: "active" | "suspended" }
// Audit-logged. Role changes are NOT possible through this route.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { getAdminDb } from "@/firebase/admin";
import { writeAuditLog } from "@/lib/audit-server";
import { toAppError, appError } from "@/lib/errors";

const bodySchema = z.object({
  status: z.enum(["active", "suspended"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { uid } = await params;

    if (uid === admin.uid) {
      return NextResponse.json(
        { code: "invalid_data", message: "You cannot change your own account status." },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: "Invalid status value." },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) throw appError("not-found", `user ${uid} not found`);

    await ref.update({
      status: parsed.data.status,
      updatedAt: new Date(),
    });

    await writeAuditLog({
      actorUid: admin.uid,
      action: "user.status_changed",
      targetUid: uid,
      metadata: { from: snap.data()?.status, to: parsed.data.status },
    });

    return NextResponse.json({ ok: true, status: parsed.data.status });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
