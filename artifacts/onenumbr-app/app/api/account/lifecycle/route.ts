// =============================================================================
// POST /api/account/lifecycle — account lifecycle transitions (server-
// authorized). Records (invoices, payments, KYC, audit) are NEVER destroyed;
// personal access is locked by revoking all sessions.
//   { action: "deactivate" }       → accountState = deactivated
//   { action: "request_deletion" } → accountState = deletion_requested
//   { action: "reactivate" }       → accountState = active
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import {
  deactivateAccount,
  reactivateAccount,
  requestAccountDeletion,
} from "@/lib/account-server";

const actionSchema = z.object({
  action: z.enum(["deactivate", "request_deletion", "reactivate"]),
});

export async function POST(req: Request) {
  try {
    const identity = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Unknown action." }, { status: 400 });
    }

    if (parsed.data.action === "deactivate") {
      await deactivateAccount({ uid: identity.uid, actorUid: identity.uid });
      return NextResponse.json({ ok: true, accountState: "deactivated" });
    }
    if (parsed.data.action === "request_deletion") {
      await requestAccountDeletion({ uid: identity.uid, actorUid: identity.uid });
      return NextResponse.json({ ok: true, accountState: "deletion_requested" });
    }
    await reactivateAccount({ uid: identity.uid, actorUid: identity.uid });
    return NextResponse.json({ ok: true, accountState: "active" });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
