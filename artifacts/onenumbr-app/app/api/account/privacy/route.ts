// =============================================================================
// GET   /api/account/privacy  → privacy settings
// PATCH /api/account/privacy  → update (only real, enforced controls)
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { getPrivacySettings, updatePrivacySettings } from "@/lib/account-server";

export async function GET() {
  try {
    const identity = await requireUser();
    const settings = await getPrivacySettings(identity.uid);
    return NextResponse.json({ settings });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

const patchSchema = z
  .object({
    productCommunications: z.boolean().optional(),
    marketingCommunications: z.boolean().optional(),
  })
  .strict();

export async function PATCH(req: Request) {
  try {
    const identity = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: parsed.error.issues[0]?.message ?? "Invalid settings." },
        { status: 400 },
      );
    }
    const settings = await updatePrivacySettings(identity.uid, parsed.data);
    return NextResponse.json({ settings });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
