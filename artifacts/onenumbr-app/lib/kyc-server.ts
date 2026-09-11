// =============================================================================
// OneNumbr — KYC server operations (Admin SDK; server-side only)
//
// All privileged KYC transitions live here and are exposed exclusively via
// /api/kyc/admin/* routes that verify the admin claim per request.
// =============================================================================

import type { Query } from "firebase-admin/firestore";
import { getAdminDb, getAdminApp } from "@/firebase/admin";
import { getStorage } from "firebase-admin/storage";
import { appError } from "@/lib/errors";
import { writeAuditLog, type AuditAction } from "@/lib/audit-server";
import type {
  KycRecord,
  KycStatus,
  KycHistoryEntry,
  KycRejectionReason,
} from "@/types/kyc";
import type { NotificationKind } from "@/types/notifications";

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  return null;
}

export function mapKycDoc(uid: string, data: Record<string, unknown>): KycRecord {
  return {
    uid,
    status: (data.status as KycStatus) ?? "draft",
    documentType: (data.documentType as KycRecord["documentType"]) ?? null,
    documentCountry: String(data.documentCountry ?? ""),
    documentNumber: String(data.documentNumber ?? ""),
    documentFrontPath: data.documentFrontPath ? String(data.documentFrontPath) : null,
    documentBackPath: data.documentBackPath ? String(data.documentBackPath) : null,
    selfiePath: data.selfiePath ? String(data.selfiePath) : null,
    submittedAt: toMillis(data.submittedAt),
    reviewedAt: toMillis(data.reviewedAt),
    reviewedBy: data.reviewedBy ? String(data.reviewedBy) : null,
    rejectionReason: data.rejectionReason ? String(data.rejectionReason) : null,
    reviewerNotes: data.reviewerNotes ? String(data.reviewerNotes) : null,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    attempt: Number(data.attempt ?? 1),
  };
}

/** Append an immutable entry to kyc_history/{uid}/entries. */
export async function writeKycHistory(input: {
  uid: string;
  actorUid: string;
  action: KycHistoryEntry["action"];
  statusAfter: KycStatus;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await getAdminDb()
      .collection("kyc_history")
      .doc(input.uid)
      .collection("entries")
      .add({
        actorUid: input.actorUid,
        action: input.action,
        statusAfter: input.statusAfter,
        metadata: input.metadata ?? {},
        createdAt: new Date(),
      });
  } catch (err) {
    console.error("[OneNumbr] kyc_history write failed:", err);
  }
}

/** Create a user notification (notifications/{uid}/items). */
export async function createNotification(input: {
  uid: string;
  kind: NotificationKind;
  title: string;
  message: string;
}): Promise<void> {
  try {
    await getAdminDb()
      .collection("notifications")
      .doc(input.uid)
      .collection("items")
      .add({
        uid: input.uid,
        kind: input.kind,
        title: input.title,
        message: input.message,
        read: false,
        createdAt: new Date(),
      });
  } catch (err) {
    console.error("[OneNumbr] notification write failed:", err);
  }
}

/** Mark the case under review by an admin (first open). */
export async function startReview(uid: string, adminUid: string): Promise<KycRecord> {
  const db = getAdminDb();
  const ref = db.collection("kyc").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw appError("not-found", `kyc/{${uid}} missing`);
  const current = mapKycDoc(uid, snap.data() ?? {});

  if (current.status === "submitted") {
    await ref.update({
      status: "under_review" as KycStatus,
      updatedAt: new Date(),
    });
    await writeKycHistory({
      uid,
      actorUid: adminUid,
      action: "kyc.review_started",
      statusAfter: "under_review",
    });
    await writeAuditLog({
      actorUid: adminUid,
      action: "kyc.review_started",
      targetUid: uid,
    });
    return { ...current, status: "under_review" };
  }
  return current;
}

export type KycDecision = "approve" | "reject" | "resubmission";

/**
 * Commit a review decision atomically. The decision is applied only if the
 * case is still in a reviewable state (submitted/under_review), preventing
 * double-processing and user-side races.
 */
export async function decideKyc(input: {
  uid: string;
  adminUid: string;
  decision: KycDecision;
  rejectionReason?: KycRejectionReason;
  userFacingMessage?: string;
  reviewerNotes?: string;
}): Promise<KycRecord> {
  const db = getAdminDb();
  const ref = db.collection("kyc").doc(input.uid);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw appError("not-found", `kyc/{${input.uid}} missing`);
    const current = mapKycDoc(input.uid, snap.data() ?? {});

    if (current.status !== "submitted" && current.status !== "under_review") {
      throw appError(
        "invalid-data",
        `case not reviewable (status=${current.status})`,
      );
    }

    const now = new Date();
    let nextStatus: KycStatus;
    let auditAction: AuditAction;
    let historyAction: KycHistoryEntry["action"];
    let notification: { kind: NotificationKind; title: string; message: string } | null = null;

    if (input.decision === "approve") {
      nextStatus = "approved";
      auditAction = "kyc.approved";
      historyAction = "kyc.approved";
      notification = {
        kind: "kyc.approved",
        title: "Identity verified",
        message: "Your OneNumbr identity has been successfully verified.",
      };
    } else if (input.decision === "reject") {
      nextStatus = "rejected";
      auditAction = "kyc.rejected";
      historyAction = "kyc.rejected";
      notification = {
        kind: "kyc.rejected",
        title: "Verification unsuccessful",
        message:
          input.userFacingMessage ??
          "We couldn't verify the submitted information. Open OneNumbr for details and next steps.",
      };
    } else {
      nextStatus = "resubmission_required";
      auditAction = "kyc.resubmission_requested";
      historyAction = "kyc.resubmission_requested";
      notification = {
        kind: "kyc.resubmission_requested",
        title: "Action required on your verification",
        message:
          input.userFacingMessage ??
          "The verification team needs a corrected submission. Open OneNumbr for details.",
      };
    }

    tx.update(ref, {
      status: nextStatus,
      reviewedAt: now,
      reviewedBy: input.adminUid,
      reviewerNotes: input.reviewerNotes ?? null,
      rejectionReason:
        input.decision === "approve"
          ? null
          : (input.rejectionReason ?? "other"),
      updatedAt: now,
    });

    return { nextStatus, auditAction, historyAction, notification, previous: current };
  });

  const { nextStatus, auditAction, historyAction, notification, previous } = result;

  await writeKycHistory({
    uid: input.uid,
    actorUid: input.adminUid,
    action: historyAction,
    statusAfter: nextStatus,
    metadata: {
      decision: input.decision,
      reason: input.rejectionReason ?? null,
      attempt: previous.attempt,
      // Intentionally NO document data here.
    },
  });

  await writeAuditLog({
    actorUid: input.adminUid,
    action: auditAction,
    targetUid: input.uid,
    metadata: { decision: input.decision, reason: input.rejectionReason ?? null },
  });

  if (notification) {
    await createNotification({ uid: input.uid, ...notification });
  }

  return {
    ...previous,
    status: nextStatus,
    reviewedAt: Date.now(),
    reviewedBy: input.adminUid,
    rejectionReason: input.decision === "approve" ? null : (input.rejectionReason ?? "other"),
    reviewerNotes: input.reviewerNotes ?? null,
  };
}

/** List KYC cases for the admin queue, optionally filtered by status. */
export async function listKycQueue(options: {
  status?: string | null;
  limit?: number;
  cursor?: string | null;
}): Promise<{ cases: (KycRecord & { email: string; onenumbr: string | null })[]; nextCursor: string | null }> {
  const db = getAdminDb();
  const limit = Math.min(options.limit ?? 25, 100);

  let q: Query = db.collection("kyc");

  if (options.status) q = q.where("status", "==", options.status);
  q = q.orderBy("submittedAt", "desc").limit(limit + 1);

  if (options.cursor) {
    const cursorSnap = await db.collection("kyc").doc(options.cursor).get();
    if (cursorSnap.exists) q = q.startAfter(cursorSnap);
  }

  const snap = await q.get();
  const docs = snap.docs.slice(0, limit);
  const hasMore = snap.docs.length > limit;

  // Batch-fetch user emails and identity IDs for display (2 extra reads per
  // page, not per row, via doc map lookups).
  const uids = docs.map((d) => d.id);
  const emails = new Map<string, string>();
  const ids = new Map<string, string | null>();
  await Promise.all(
    uids.map(async (uid) => {
      const [u, i] = await Promise.all([
        db.collection("users").doc(uid).get(),
        db.collection("onenumbr_ids").doc(uid).get(),
      ]);
      emails.set(uid, String(u.data()?.email ?? ""));
      ids.set(uid, i.exists ? String(i.data()?.onenumbr ?? "") : null);
    }),
  );

  return {
    cases: docs.map((d) => ({
      ...mapKycDoc(d.id, d.data()),
      email: emails.get(d.id) ?? "",
      onenumbr: ids.get(d.id) ?? null,
    })),
    nextCursor: hasMore ? docs[docs.length - 1].id : null,
  };
}

/**
 * Generate a short-lived read URL for a private KYC file. Used ONLY by
 * claim-verified admin routes — never exposed as a public link.
 */
export async function getKycFileUrl(
  uid: string,
  path: string,
  expiresMinutes = 10,
): Promise<string> {
  if (!path.startsWith(`kyc/${uid}/`)) {
    throw appError("permission-denied", "path does not belong to this user");
  }
  const bucket = getStorage(getAdminApp()).bucket();
  const file = bucket.file(path);
  const [exists] = await file.exists();
  if (!exists) throw appError("not-found", "file missing in storage");
  const expires = Date.now() + expiresMinutes * 60 * 1000;
  const [url] = await file.getSignedUrl({
    action: "read",
    expires,
  });
  return url;
}

/** Read full review history for a user (staff/admin only). */
export async function getKycHistory(uid: string): Promise<KycHistoryEntry[]> {
  const snap = await getAdminDb()
    .collection("kyc_history")
    .doc(uid)
    .collection("entries")
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      actorUid: String(data.actorUid ?? ""),
      action: data.action as KycHistoryEntry["action"],
      statusAfter: data.statusAfter as KycStatus,
      metadata: (data.metadata ?? {}) as Record<string, unknown>,
      createdAt: toMillis(data.createdAt),
    };
  });
}
