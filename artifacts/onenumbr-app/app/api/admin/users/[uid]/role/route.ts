// =============================================================================
// POST /api/admin/users/[uid]/role — set a user's role (admin only).
// Body: { role: "user" | "admin" | "support" }
// Sets BOTH the Firestore field and the Auth custom claim (the claim is what
// security rules check). Audit-logged. Self-demotion is blocked.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { getAdminDb, getAdminAuth } from "@/firebase/admin";
import { setUserRoleClaim } from "@/lib/auth-server";
import { writeAuditLog } from "@/lib/audit-server";
import { toAppError, appError } from "@/lib/errors";

const bodySchema = z.object({
  role: z.enum(["user", "admin", "support"]),
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
        { code: "invalid_data", message: "You cannot change your own role." },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: "Invalid role value." },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) throw appError("not-found", `user ${uid} not found`);

    const previousRole = String(snap.data()?.role ?? "user");

    // 1. Custom claim (what rules actually check).
    await setUserRoleClaim(uid, parsed.data.role);
    // 2. Firestore mirror for listing/display.
    await ref.update({ role: parsed.data.role, updatedAt: new Date() });

    await writeAuditLog({
      actorUid: admin.uid,
      action: "user.role_changed",
      targetUid: uid,
      metadata: { from: previousRole, to: parsed.data.role },
    });

    return NextResponse.json({ ok: true, role: parsed.data.role });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
