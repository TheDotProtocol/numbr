// =============================================================================
// POST /api/onboarding/generate-id — allocate the permanent OneNumbr ID.
// Idempotent: re-requests return the already-issued ID.
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { getAdminDb } from "@/firebase/admin";
import { allocateOneNumbrId, getOneNumbrIdRecord } from "@/services/identityService";
import { writeAuditLog } from "@/lib/audit-server";
import { toAppError } from "@/lib/errors";

export async function POST() {
  try {
    const identity = await requireUser();
    if (!identity.emailVerified) {
      return NextResponse.json(
        { code: "email_unverified", message: "Verify your email before continuing." },
        { status: 403 },
      );
    }

    // Idempotency: return the existing ID if one was already issued.
    const existing = await getOneNumbrIdRecord(identity.uid);
    if (existing) {
      return NextResponse.json({ identity: existing, alreadyIssued: true });
    }

    const record = await allocateOneNumbrId(identity.uid);

    await writeAuditLog({
      actorUid: identity.uid,
      action: "identity.onenumbr_id_issued",
      targetUid: identity.uid,
      metadata: { onenumbr: record.onenumbr },
    });

    return NextResponse.json({ identity: record });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
