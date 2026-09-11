// =============================================================================
// /api/number/me — the signed-in user's numbers + identity gate state.
//   GET                → assignments joined with number records (owner-checked)
//   GET?numberId=…     → one number (owner-checked; 403 otherwise)
// Also returns the derived identity state so the UI can gate activation
// without duplicating KYC logic client-side.
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { getAdminDb } from "@/firebase/admin";
import { mapKycDoc } from "@/lib/kyc-server";
import { deriveIdentityState } from "@/types/kyc";
import { getUserNumber, getUserNumbers } from "@/lib/number-server";

export async function GET(req: Request) {
  try {
    const identity = await requireUser();
    const url = new URL(req.url);
    const numberId = url.searchParams.get("numberId");

    // Derived identity state for the activation gate.
    const kycSnap = await getAdminDb().collection("kyc").doc(identity.uid).get();
    const identityState = deriveIdentityState(
      kycSnap.exists ? mapKycDoc(identity.uid, kycSnap.data() ?? {}) : null,
    );

    if (numberId) {
      const number = await getUserNumber(identity.uid, numberId);
      return NextResponse.json({ number, identityState });
    }

    const numbers = await getUserNumbers(identity.uid);
    return NextResponse.json({ numbers, identityState });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
