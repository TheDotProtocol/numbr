// =============================================================================
// OneNumbr — KYC types (Manual Identity Verification v1.0)
//
// Lifecycle:
//   not_started → draft → submitted → under_review → approved
//                                                 → rejected
//                                                 → resubmission_required
// =============================================================================

/** KYC case status. Server-managed after submission; users cannot set it. */
export type KycStatus =
  | "not_started"
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "resubmission_required";

/** Identity document types accepted in V1. Extensible later. */
export type KycDocumentType = "passport" | "national_id" | "driving_licence";

/** Media roles inside a submission. */
export type KycFileRole = "document_front" | "document_back" | "selfie";

/**
 * Firestore `kyc/{uid}` — one live verification case per user.
 * Files live in Storage; this record holds metadata + safe paths only.
 * Review fields (status after submission, reviewedAt/By, decisions) are
 * server-managed and immutable from clients (enforced by security rules).
 */
export interface KycRecord {
  uid: string;
  status: KycStatus;
  documentType: KycDocumentType | null;
  documentCountry: string; // ISO 3166-1 alpha-2
  documentNumber: string;
  documentFrontPath: string | null; // Storage path (gs:// bucket path)
  documentBackPath: string | null;
  selfiePath: string | null;
  submittedAt: number | null;
  reviewedAt: number | null;
  reviewedBy: string | null; // admin uid — never shown to the user
  rejectionReason: string | null; // user-facing reason code/text
  reviewerNotes: string | null; // internal-only, never sent to the user
  createdAt: number | null;
  updatedAt: number | null;
  attempt: number; // increments on each resubmission
}

/** Immutable per-decision review record: kyc_history/{uid}/entries/{autoId}. */
export interface KycHistoryEntry {
  id: string;
  actorUid: string; // submitting user or reviewing admin
  action:
    | "kyc.submitted"
    | "kyc.review_started"
    | "kyc.approved"
    | "kyc.rejected"
    | "kyc.resubmission_requested"
    | "kyc.draft_saved";
  statusAfter: KycStatus;
  metadata: Record<string, unknown>; // reason codes etc. — never document data
  createdAt: number | null;
}

/** Predefined rejection reasons (user-facing copy generated from these). */
export const KYC_REJECTION_REASONS = [
  "document_unclear",
  "document_expired",
  "information_mismatch",
  "invalid_document",
  "selfie_unclear",
  "document_unsupported",
  "other",
] as const;

export type KycRejectionReason = (typeof KYC_REJECTION_REASONS)[number];

/** User-facing copy for each rejection reason. */
export const REJECTION_REASON_COPY: Record<KycRejectionReason, string> = {
  document_unclear: "The document image was unclear. Please upload a sharper photo or scan.",
  document_expired: "The document appears to be expired. Please submit a valid document.",
  information_mismatch: "The information on the document did not match your profile.",
  invalid_document: "The submitted document is not an accepted identity document.",
  selfie_unclear: "The selfie was unclear. Please upload a clear photo of your face.",
  document_unsupported: "This document type is not supported. Please use a passport, national ID or driving licence.",
  other: "The verification team could not confirm your identity from this submission.",
};

/** Document type metadata for UI rendering. */
export interface DocumentTypeInfo {
  value: KycDocumentType;
  label: string;
  description: string;
  requiresBack: boolean;
  accept: string[];
}

export const DOCUMENT_TYPES: DocumentTypeInfo[] = [
  {
    value: "passport",
    label: "Passport",
    description: "The photo page of your valid passport.",
    requiresBack: false,
    accept: ["image/png", "image/jpeg", "application/pdf"],
  },
  {
    value: "national_id",
    label: "National ID",
    description: "Both sides of your national identity card.",
    requiresBack: true,
    accept: ["image/png", "image/jpeg", "application/pdf"],
  },
  {
    value: "driving_licence",
    label: "Driving Licence",
    description: "Both sides of your valid driving licence.",
    requiresBack: true,
    accept: ["image/png", "image/jpeg", "application/pdf"],
  },
];

export function getDocumentTypeInfo(value: KycDocumentType): DocumentTypeInfo | undefined {
  return DOCUMENT_TYPES.find((d) => d.value === value);
}

/** Identity state derived from KYC status (single source of truth). */
export type IdentityState = "not_verified" | "pending" | "verified" | "rejected" | "resubmission_required";

export function deriveIdentityState(kyc: KycRecord | null | undefined): IdentityState {
  switch (kyc?.status) {
    case "submitted":
    case "under_review":
      return "pending";
    case "approved":
      return "verified";
    case "rejected":
      return "rejected";
    case "resubmission_required":
      return "resubmission_required";
    case "draft":
      return "not_verified";
    default:
      return "not_verified";
  }
}
