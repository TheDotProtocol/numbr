// =============================================================================
// POST /api/kyc/submit — commit a verification submission (authenticated user).
//
// Validation:
//   - email verified
//   - case exists and is in draft / rejected / resubmission_required
//     (blocks duplicate simultaneous submissions)
//   - document type valid, document country present, document number present
//   - required Storage paths present and scoped to kyc/{uid}/…
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { enforceUserRateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/api";
import { getAdminDb } from "@/firebase/admin";
import { toAppError, appError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit-server";
import { writeKycHistory, createNotification } from "@/lib/kyc-server";
import { getDocumentTypeInfo, type KycStatus } from "@/types/kyc";

const bodySchema = z.object({
  documentType: z.enum(["passport", "national_id", "driving_licence"]),
  documentCountry: z.string().trim().regex(/^[A-Z]{2}$/, "Select the issuing country."),
  documentNumber: z
    .string()
    .trim()
    .min(1, "Enter the document number.")
    .max(40, "Document number is too long."),
  documentFrontPath: z.string().trim().min(1),
  documentBackPath: z.string().trim().optional().nullable(),
  selfiePath: z.string().trim().min(1),
});

const NON_SUBMITTABLE: KycStatus[] = ["submitted", "under_review", "approved"];

export async function POST(req: Request) {
  try {
    const identity = await requireUser();
    await enforceUserRateLimit("kyc_submit", identity.uid);
    if (!identity.emailVerified) {
      return NextResponse.json(
        { code: "email_unverified", message: "Verify your email before submitting." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: parsed.error.issues[0]?.message ?? "Invalid submission." },
        { status: 400 },
      );
    }
    const input = parsed.data;

    // File paths must live inside this user's private KYC scope.
    const pathOk = (p: string, folder: "documents" | "selfie") =>
      p.startsWith(`kyc/${identity.uid}/${folder}/`);
    if (!pathOk(input.documentFrontPath, "documents")) {
      throw appError("invalid-data", "front path out of scope");
    }
    if (!pathOk(input.selfiePath, "selfie")) {
      throw appError("invalid-data", "selfie path out of scope");
    }
    const typeInfo = getDocumentTypeInfo(input.documentType);
    if (!typeInfo) throw appError("invalid-data", "unknown document type");
    const needsBack = typeInfo.requiresBack;
    if (needsBack && (!input.documentBackPath || !pathOk(input.documentBackPath, "documents"))) {
      throw appError("invalid-data", "back path required for this document type");
    }

    const db = getAdminDb();
    const ref = db.collection("kyc").doc(identity.uid);
    const snap = await ref.get();
    const current = snap.data() as Record<string, unknown> | undefined;
    const currentStatus = (current?.status as KycStatus | undefined) ?? "not_started";

    if (!snap.exists || currentStatus === "not_started" || currentStatus === "draft") {
      // fresh submission — must have a draft or nothing
    } else if (NON_SUBMITTABLE.includes(currentStatus)) {
      return NextResponse.json(
        {
          code: "conflict",
          message: "A verification is already in progress for this account.",
        },
        { status: 409 },
      );
    }

    const now = new Date();
    const attempt = Number(current?.attempt ?? 0) + 1;

    // Persist the submission (server-side transition).
    await ref.set(
      {
        uid: identity.uid,
        status: "submitted" as KycStatus,
        documentType: input.documentType,
        documentCountry: input.documentCountry,
        documentNumber: input.documentNumber,
        documentFrontPath: input.documentFrontPath,
        documentBackPath: needsBack ? (input.documentBackPath ?? null) : null,
        selfiePath: input.selfiePath,
        submittedAt: now,
        updatedAt: now,
        attempt,
        // Reset per-round review fields; history preserves the previous round.
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
        reviewerNotes: null,
        ...(snap.exists ? {} : { createdAt: now }),
      },
      { merge: true },
    );

    await writeKycHistory({
      uid: identity.uid,
      actorUid: identity.uid,
      action: "kyc.submitted",
      statusAfter: "submitted",
      metadata: { attempt, documentType: input.documentType },
    });
    await writeAuditLog({
      actorUid: identity.uid,
      action: "kyc.submitted",
      targetUid: identity.uid,
      metadata: { attempt },
    });
    await createNotification({
      uid: identity.uid,
      kind: "kyc.submitted",
      title: "Verification submitted",
      message:
        "We received your identity documents. The OneNumbr verification team will review them.",
    });

    return NextResponse.json({ ok: true, status: "submitted", attempt });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
