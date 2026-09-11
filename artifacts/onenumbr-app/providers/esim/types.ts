// =============================================================================
// OneNumbr — Provider abstraction layer
//
// Every external vendor (eSIM providers, telecom carriers, identity/KYC
// vendors, payment processors) is reached through a provider interface.
// Application code depends on `getEsimProvider()` etc., never on a vendor
// SDK, so production providers can be swapped in without rewrites.
// =============================================================================

// ---------------------------------------------------------------------------
// eSIM provider (Prompt 3)
// ---------------------------------------------------------------------------
export interface EsimPlan {
  providerPlanId: string;
  name: string;
  countryIso: string | "GLOBAL";
  dataGb: number;
  validityDays: number;
  priceMinor: number;
  currency: string;
}

export interface EsimProvisionResult {
  providerOrderRef: string;
  /** LPA:1$<smdp>$<matchingId> activation string. */
  activationCode: string;
  /** Exact payload to encode as QR (normally the activation code). */
  qrPayload: string;
  iccid: string;
  activationDetailsUrl: string;
}

export interface EsimUsageSnapshot {
  usedMb: number;
  totalMb: number;
  expiresAt: number;
}

/** Methods a real eSIM provider adapter must implement (Prompt 3). */
export interface EsimProvider {
  readonly name: string;
  searchPlans(input: { countryIso: string }): Promise<EsimPlan[]>;
  getPlan(providerPlanId: string): Promise<EsimPlan>;
  createOrder(input: {
    uid: string;
    providerPlanId: string;
  }): Promise<{ providerOrderRef: string }>;
  provisionEsim(input: {
    providerOrderRef: string;
    /** Passed so providers can deterministically exercise failure paths. */
    providerPlanId?: string;
  }): Promise<EsimProvisionResult>;
  getActivationDetails(input: { providerOrderRef: string }): Promise<EsimProvisionResult>;
  getUsage(input: { iccid: string }): Promise<EsimUsageSnapshot>;
  suspendEsim(input: { iccid: string }): Promise<void>;
  cancelEsim(input: { iccid: string }): Promise<void>;
}

/**
 * Placeholder provider used until Prompt 3 wires a real vendor. Every method
 * fails honestly with a typed error — it never returns fake plans.
 */
export const placeholderEsimProvider: EsimProvider = {
  name: "placeholder",
  async searchPlans() {
    throw new Error("eSIM provider not configured yet (Prompt 3)");
  },
  async getPlan() {
    throw new Error("eSIM provider not configured yet (Prompt 3)");
  },
  async createOrder() {
    throw new Error("eSIM provider not configured yet (Prompt 3)");
  },
  async provisionEsim() {
    throw new Error("eSIM provider not configured yet (Prompt 3)");
  },
  async getActivationDetails() {
    throw new Error("eSIM provider not configured yet (Prompt 3)");
  },
  async getUsage() {
    throw new Error("eSIM provider not configured yet (Prompt 3)");
  },
  async suspendEsim() {
    throw new Error("eSIM provider not configured yet (Prompt 3)");
  },
  async cancelEsim() {
    throw new Error("eSIM provider not configured yet (Prompt 3)");
  },
};

// ---------------------------------------------------------------------------
// Telecom provider contract lives in providers/telecom/types.ts (Prompt 4).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Identity verification provider (Prompt 2 — manual first, later Sumsub)
// ---------------------------------------------------------------------------
export interface IdentityProvider {
  readonly name: string;
  createCase(input: { uid: string }): Promise<{ caseRef: string }>;
  uploadDocument(input: { caseRef: string; kind: string; file: Blob }): Promise<void>;
  getCaseStatus(input: { caseRef: string }): Promise<{
    status: "pending" | "approved" | "rejected";
  }>;
}

// ---------------------------------------------------------------------------
// Payment provider contract lives in providers/payment/types.ts (Prompt 3).
// ---------------------------------------------------------------------------
