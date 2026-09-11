// =============================================================================
// GET /api/admin/users/[uid] — full detail for one user (admin only).
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { getAdminDb, getAdminAuth } from "@/firebase/admin";
import { toAppError, appError } from "@/lib/errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    await requireAdmin();
    const { uid } = await params;

    const db = getAdminDb();
    const [userSnap, profileSnap, idSnap, authRecord] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db.collection("profiles").doc(uid).get(),
      db.collection("onenumbr_ids").doc(uid).get(),
      getAdminAuth().getUser(uid).catch(() => null),
    ]);

    if (!userSnap.exists && !authRecord) {
      throw appError("not-found", `user ${uid} not found`);
    }

    const toMillis = (v: unknown): number | null => {
      if (typeof v === "number") return v;
      if (v && typeof v === "object" && "toMillis" in v) {
        return (v as { toMillis(): number }).toMillis();
      }
      return null;
    };

    const userData = userSnap.data() ?? {};
    const profileData = profileSnap.data() ?? {};
    const idData = idSnap.data() ?? {};

    return NextResponse.json({
      uid,
      email: String(userData.email ?? authRecord?.email ?? ""),
      role: String(userData.role ?? "user"),
      status: String(userData.status ?? "active"),
      emailVerified: authRecord?.emailVerified ?? false,
      createdAt: toMillis(userData.createdAt),
      lastLoginAt: toMillis(userData.lastLoginAt),
      profile: profileSnap.exists
        ? {
            fullName: String(profileData.fullName ?? ""),
            country: String(profileData.country ?? ""),
            phone: String(profileData.phone ?? ""),
            timezone: String(profileData.timezone ?? ""),
            avatarUrl: String(profileData.avatarUrl ?? ""),
          }
        : null,
      identity: idSnap.exists
        ? {
            onenumbr: String(idData.onenumbr ?? ""),
            status: String(idData.status ?? "active"),
            createdAt: toMillis(idData.createdAt),
          }
        : null,
      // Account-support summary (Prompt 6) — derived counts/states only;
      // never credentials, tokens, or payment data.
      accountSupport: await (async () => {
        const [kycSnap, numSnap, esimSnap, secSnap, sessSnap] = await Promise.all([
          db.collection("kyc").doc(uid).get(),
          db.collection("number_assignments").where("uid", "==", uid).where("status", "==", "active").limit(5).get(),
          db.collection("esims").where("uid", "==", uid).where("status", "in", ["ready", "active"]).limit(5).get(),
          db.collection("account_security").doc(uid).get(),
          db.collection("sessions").where("uid", "==", uid).where("revokedAt", "==", null).limit(20).get(),
        ]);
        const now = Date.now();
        const liveSessions = sessSnap.docs.filter((d) => {
          const exp = toMillis(d.data().expiresAt);
          return exp === null || exp > now;
        }).length;
        return {
          kycState: kycSnap.exists ? String(kycSnap.data()?.status ?? "not_started") : "not_started",
          activeNumbers: numSnap.size,
          activeEsims: esimSnap.size,
          accountState: String(secSnap.data()?.accountState ?? "active"),
          twoFactorState: String(secSnap.data()?.twoFactorState ?? "unavailable"),
          activeSessions: liveSessions,
        };
      })(),
    });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
