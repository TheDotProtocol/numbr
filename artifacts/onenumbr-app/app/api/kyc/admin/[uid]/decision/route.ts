// =============================================================================
// POST /api/kyc/admin/[uid]/decision — commit a review decision (admin only).
// Body: { decision: "approve" | "reject" | "resubmission", reason?, notes? }
// Rejection/resubmission require a reason. Every decision is audit-logged,
// written to kyc_history, and notifies the user.
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError, appError } from "@/lib/errors";
import { decideKyc } from "@/lib/kyc-server";
import {
  KYC_REJECTION_REASONS,
  REJECTION_REASON_COPY,
  type KycRejectionReason,
} from "@/types/kyc";

const bodySchema = z.object({
  decision: z.enum(["approve", "reject", "resubmission"]),
  reason: z.string().trim().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const admin = await requireAdmin();
    const { uid } = await params;

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: parsed.error.issues[0]?.message ?? "Invalid decision payload." },
        { status: 400 },
      );
    }
    const { decision, reason, notes } = parsed.data;

    let rejectionReason: KycRejectionReason | undefined;
    let userFacingMessage: string | undefined;

    if (decision !== "approve") {
      if (!reason || !(KYC_REJECTION_REASONS as readonly string[]).includes(reason)) {
        return NextResponse.json(
          { code: "invalid_data", message: "A valid reason is required." },
          { status: 400 },
        );
      }
      rejectionReason = reason as KycRejectionReason;
      userFacingMessage = REJECTION_REASON_COPY[rejectionReason];
      if (decision === "resubmission" && rejectionReason === "other") {
        return NextResponse.json(
          { code: "invalid_data", message: "Choose a specific reason for resubmission." },
          { status: 400 },
        );
      }
    }

    const updated = await decideKyc({
      uid,
      adminUid: admin.uid,
      decision,
      rejectionReason,
      userFacingMessage,
      reviewerNotes: notes || undefined,
    });

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    if (err instanceof Error && /not reviewable/.test(err.message)) {
      return NextResponse.json(
        { code: "conflict", message: "This case has already been decided." },
        { status: 409 },
      );
    }
    return jsonError(toAppError(err));
  }
}
