// =============================================================================
// OneNumbr — ManualIdentityProvider (V1 verification implementation)
//
// Implements the IdentityProvider contract where a human admin is the
// verification mechanism. Documents flow through the platform's own secure
// pipeline (Storage + Firestore review queue). A future Sumsub adapter can
// replace this file without touching UI or page code.
// =============================================================================

import type { IdentityProvider } from "./types";

export const manualIdentityProvider: IdentityProvider = {
  name: "manual",

  /** V1: a case is the kyc/{uid} document created by the user's draft. */
  async createCase(input) {
    // The platform records the case itself; the provider surface exists so a
    // remote provider (Sumsub) can later own case creation.
    return { caseRef: `onenumbr:kyc:${input.uid}` };
  },

  /**
   * V1: documents upload directly to the applicant's private Storage scope
   * via services/kycService.uploadKycFile, not through this method. This
   * method exists for remote-provider parity and intentionally fails honest.
   */
  async uploadDocument() {
    throw new Error(
      "manual provider stores documents in OneNumbr Storage — use kycService.uploadKycFile",
    );
  },

  /** V1: status is derived from the kyc/{uid} document reviewed by admins. */
  async getCaseStatus(input) {
    const caseRef = input.caseRef;
    if (!caseRef.startsWith("onenumbr:kyc:")) {
      throw new Error("unknown case reference");
    }
    // Real status resolution happens via kycService.observeKycStatus; this
    // method remains for provider parity.
    return { status: "pending" as const };
  },
};
