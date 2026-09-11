// =============================================================================
// OneNumbr — Identity verification provider contract
//
// Manual review (V1) and future remote providers (Sumsub, etc.) both
// implement this interface. UI code must never know which is active.
// =============================================================================

export interface IdentityProvider {
  readonly name: string;
  createCase(input: { uid: string }): Promise<{ caseRef: string }>;
  uploadDocument(input: { caseRef: string; kind: string; file: Blob }): Promise<void>;
  getCaseStatus(input: {
    caseRef: string;
  }): Promise<{ status: "pending" | "approved" | "rejected" }>;
}
