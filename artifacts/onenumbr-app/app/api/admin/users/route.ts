// =============================================================================
// GET /api/admin/users — paginated user list (admin claim required).
// Query params: ?cursor=<docId>&limit=25&q=<email prefix>
// =============================================================================

import type { Query } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { getAdminDb } from "@/firebase/admin";
import { toAppError } from "@/lib/errors";

const MAX_LIMIT = 100;

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const cursor = url.searchParams.get("cursor") ?? null;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 25) || 25, MAX_LIMIT);

    const db = getAdminDb();
    let base: Query = db.collection("users");

    // Search by email prefix (case-insensitive via stored lowercase emails).
    if (q) {
      base = base
        .where("email", ">=", q)
        .where("email", "<=", q + "\uf8ff");
    }
    if (cursor) {
      const cursorSnap = await db.collection("users").doc(cursor).get();
      if (cursorSnap.exists) {
        base = base.startAfter(cursorSnap);
      }
    }

    const snap = await base.orderBy("email").limit(limit + 1).get();
    const docs = snap.docs.slice(0, limit);
    const hasMore = snap.docs.length > limit;
    const nextCursor = hasMore ? docs[docs.length - 1].id : null;

    const users = docs.map((d) => ({
      uid: d.id,
      email: String(d.data().email ?? ""),
      role: String(d.data().role ?? "user"),
      status: String(d.data().status ?? "active"),
      createdAt: d.data().createdAt?.toMillis?.() ?? null,
      lastLoginAt: d.data().lastLoginAt?.toMillis?.() ?? null,
    }));

    return NextResponse.json({ users, nextCursor });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
