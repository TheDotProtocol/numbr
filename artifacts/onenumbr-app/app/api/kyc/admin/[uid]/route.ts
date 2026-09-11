// =============================================================================
// GET /api/kyc/admin/[uid] — full verification workspace payload (admin only).
// Returns applicant info, the case record (with reviewerNotes — internal),
// short-lived signed URLs for documents/selfie, and the review history.
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { getAdminDb } from "@/firebase/admin";
import { toAppError, appError } from "@/lib/errors";
import {
  getKycFileUrl,
  getKycHistory,
  mapKycDoc,
  startReview,
} from "@/lib/kyc-server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { uid } = await params;

    const db = getAdminDb();
    const kycSnap = await db.collection("kyc").doc(uid).get();
    if (!kycSnap.exists) throw appError("not-found", "no KYC case for this user");

    const [userSnap, profileSnap, idSnap, history] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db.collection("profiles").doc(uid).get(),
      db.collection("onenumbr_ids").doc(uid).get(),
      getKycHistory(uid),
    ]);

    const kyc = mapKycDoc(uid, kycSnap.data() ?? {});

    // First admin open moves submitted → under_review (audit + history).
    if (kyc.status === "submitted") {
      const started = await startReview(uid, admin.uid);
      kyc.status = started.status;
    }

    // Signed URLs are generated fresh per view and expire quickly.
    const fileUrls: { front?: string; back?: string; selfie?: string } = {};

    if (kyc.documentFrontPath) {
      fileUrls.front = await getKycFileUrl(uid, kyc.documentFrontPath).catch(() => undefined);
    }
    if (kyc.documentBackPath) {
      fileUrls.back = await getKycFileUrl(uid, kyc.documentBackPath).catch(() => undefined);
    }
    if (kyc.selfiePath) {
      fileUrls.selfie = await getKycFileUrl(uid, kyc.selfiePath).catch(() => undefined);
    }

    const toM = (v: unknown): number | null => {
      if (typeof v === "number") return v;
      if (v && typeof v === "object" && "toMillis" in v) return (v as { toMillis(): number }).toMillis();
      return null;
    };

    const userData = userSnap.data() ?? {};
    const profileData = profileSnap.data() ?? {};
    const idData = idSnap.data() ?? {};

    return NextResponse.json({
      kyc,
      applicant: {
        uid,
        email: String(userData.email ?? ""),
        fullName: String(profileData.fullName ?? ""),
        country: String(profileData.country ?? ""),
        onenumbr: idSnap.exists ? String(idData.onenumbr ?? "") : null,
        accountCreatedAt: toM(userData.createdAt),
      },
      fileUrls,
      history,
    });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
