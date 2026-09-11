// =============================================================================
// POST /api/onboarding/profile — persist profile setup (server-validated)
// =============================================================================

import { NextResponse } from "next/server";
import { profileSetupSchema } from "@/lib/validation";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { getAdminDb } from "@/firebase/admin";
import { toAppError } from "@/lib/errors";

export async function POST(req: Request) {
  try {
    const identity = await requireUser();
    if (!identity.emailVerified) {
      return NextResponse.json(
        { code: "email_unverified", message: "Verify your email before continuing." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = profileSetupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          code: "invalid_data",
          message: parsed.error.issues[0]?.message ?? "Invalid profile data.",
        },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const ref = db.collection("profiles").doc(identity.uid);
    const snap = await ref.get();
    const now = new Date();

    if (snap.exists) {
      await ref.update({
        fullName: parsed.data.fullName,
        country: parsed.data.country,
        phone: parsed.data.phone ?? "",
        timezone: parsed.data.timezone ?? "",
        updatedAt: now,
      });
    } else {
      await ref.set({
        uid: identity.uid,
        fullName: parsed.data.fullName,
        country: parsed.data.country,
        phone: parsed.data.phone ?? "",
        avatarUrl: "",
        timezone: parsed.data.timezone ?? "",
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
