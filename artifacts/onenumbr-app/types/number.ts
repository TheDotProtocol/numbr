// =============================================================================
// OneNumbr — Number types (Number Engine v1.0, Prompt 4)
//
// OneNumbr ID    (ON-284739)      = permanent identity identifier, never changes.
// OneNumbr Number (+1739 284739)  = public communications identity, assigned
// through the number engine. A user may hold multiple numbers over time (and
// in future, several at once); the OneNumbr ID always remains stable.
//
// Number status machine (server-side only):
//   available → reserved → provisioning → active → suspended → released
//                                     ↘ failed   (paid; admin retry)
//   reserved → available (reservation expired/released before payment)
//
// Order state machine (server-side only):
//   created → payment_pending → paid → provisioning → active
//                                        ↘ failed    (payment kept)
//   created/payment_pending → cancelled
// =============================================================================

/** Lifecycle of an inventory number. Mirrors future provider states. */
export type NumberStatus =
  | "available"
  | "reserved"
  | "provisioning"
  | "active"
  | "suspended"
  | "released"
  | "failed";

/** Number order lifecycle — created/advanced only by the server. */
export type NumberOrderStatus =
  | "created"
  | "payment_pending"
  | "paid"
  | "provisioning"
  | "active"
  | "failed"
  | "cancelled"
  | "released";

/** Assignment lifecycle (history-preserving; release never deletes rows). */
export type AssignmentStatus = "active" | "released" | "suspended";

/** Capabilities the platform models today (SMS/VOICE shown; MMS/SIP reserved). */
export type NumberCapability = "SMS" | "VOICE" | "MMS" | "SIP";

export type NumberType = "mobile" | "local" | "toll_free" | "international";

/** Inventory record: numbers/{numberId}. */
export interface NumberRecord {
  id: string;
  /** Application-level OneNumbr number, e.g. "+1739284739". */
  onenumbrNumber: string;
  /** Provider-side number reference (mock: MOCK-TELECOM format). */
  providerNumber: string;
  provider: string; // "mock-telecom"
  countryCode: string; // "US" (application grouping, not routing truth)
  region: string;
  type: NumberType;
  status: NumberStatus;
  capabilities: NumberCapability[];
  monthlyPrice: number; // major units
  currency: string; // "USD"
  /** Set when assigned/active; null while in inventory. */
  uid: string | null;
  /** Reservation metadata — availability is time-limited. */
  reservedBy: string | null;
  reservedAt: number | null;
  reservationExpiresAt: number | null;
  /** Display formatting, e.g. "+1739 284739". */
  displayNumber: string;
  createdAt: number | null;
  updatedAt: number | null;
}

/** Immutable commercial snapshot stored on the order at checkout. */
export interface NumberSnapshot {
  onenumbrNumber: string;
  displayNumber: string;
  providerNumber: string;
  provider: string;
  countryCode: string;
  region: string;
  type: NumberType;
  capabilities: NumberCapability[];
  monthlyPrice: number;
  currency: string;
}

/** number_assignments/{assignmentId} — append-only history. */
export interface NumberAssignment {
  id: string;
  uid: string;
  numberId: string;
  onenumbrNumber: string;
  displayNumber: string;
  status: AssignmentStatus;
  orderId: string | null;
  assignedAt: number | null;
  releasedAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
}

/** number_orders/{orderId} — server-computed, server-advanced. */
export interface NumberOrder {
  id: string;
  uid: string;
  numberId: string;
  numberSnapshot: NumberSnapshot;
  /** First month charge, server-computed from the inventory record. */
  totalAmount: number;
  currency: string;
  paymentStatus: "payment_pending" | "paid" | "failed" | "refunded";
  orderStatus: NumberOrderStatus;
  provisioningError: string | null;
  provider: string;
  providerOrderId: string | null;
  assignmentId: string | null;
  idempotencyKey: string;
  createdAt: number | null;
  updatedAt: number | null;
}

/** Customer-safe inventory projection (no reservation internals / provider refs). */
export interface PublicNumber {
  id: string;
  displayNumber: string;
  countryCode: string;
  region: string;
  type: NumberType;
  capabilities: NumberCapability[];
  monthlyPrice: number;
  currency: string;
}

/** Owner-safe projection of an active/released assignment joined with its number. */
export interface MyNumber {
  numberId: string;
  assignmentId: string;
  onenumbrNumber: string;
  displayNumber: string;
  status: NumberStatus;
  capabilities: NumberCapability[];
  monthlyPrice: number;
  currency: string;
  type: NumberType;
  countryCode: string;
  provider: string;
  activatedAt: number | null;
  releasedAt: number | null;
  assignedAt: number | null;
}

/** Format an E.164-style application number into display form. */
export function formatNumber(onenumbrNumber: string): string {
  // +1739284739 → +1739 284739 (3-digit "country/group" + 6 digits)
  const m = /^\+(\d{3,4})(\d{6})$/.exec(onenumbrNumber);
  return m ? `+${m[1]} ${m[2]}` : onenumbrNumber;
}
