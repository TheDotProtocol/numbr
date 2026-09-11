// =============================================================================
// GET   /api/account/preferences  → notification preferences
// PATCH /api/account/preferences  → update (securityNewLogin is mandatory
//                                   and can never be disabled)
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/account-server";

export async function GET() {
  try {
    const identity = await requireUser();
    const preferences = await getNotificationPreferences(identity.uid);
    return NextResponse.json({ preferences });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

const patchSchema = z
  .object({
    securitySessionChanges: z.boolean().optional(),
    securityChanges: z.boolean().optional(),
    identityKycUpdates: z.boolean().optional(),
    connectivityEsimActivation: z.boolean().optional(),
    connectivityEsimStatus: z.boolean().optional(),
    numberActivation: z.boolean().optional(),
    numberRelease: z.boolean().optional(),
    billingPayments: z.boolean().optional(),
    billingInvoices: z.boolean().optional(),
    billingRefunds: z.boolean().optional(),
    billingSubscriptionChanges: z.boolean().optional(),
    marketingProductNews: z.boolean().optional(),
  })
  .strict();

export async function PATCH(req: Request) {
  try {
    const identity = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: parsed.error.issues[0]?.message ?? "Invalid preferences." },
        { status: 400 },
      );
    }
    const preferences = await updateNotificationPreferences(identity.uid, parsed.data);
    return NextResponse.json({ preferences });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
