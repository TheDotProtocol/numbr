// =============================================================================
// OneNumbr — Billing types (Payments & Billing Engine v1.0, Prompt 5)
//
// MONEY REPRESENTATION — IMPORTANT
// -------------------------------
// All monetary amounts are stored as INTEGER MINOR UNITS (e.g. $19.99 →
// 1999 with currency "USD"). Floating-point math is never used for money;
// conversion to major units happens only at the display edge.
//
// PAYMENT STATE MACHINE (server-side only)
//   pending → paid | failed | cancelled
//   paid → refunded | partially_refunded
//
// INVOICE STATE MACHINE (server-side only)
//   draft → issued → paid | void
//   issued/paid → refunded
//
// SUBSCRIPTION STATE MACHINE (mock; server-side only)
//   trialing → active → past_due → paused → cancelled | expired | failed
// =============================================================================

export type BillingSource = "esim" | "number" | "subscription" | "other";

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "cancelled";

/** payments/{paymentId} — the financial source of truth. */
export interface PaymentRecord {
  id: string;
  uid: string;
  /** e.g. esim_orders/{id} or number_orders/{id}; null for direct charges. */
  orderId: string | null;
  orderType: BillingSource;
  provider: string; // "mock"
  providerPaymentId: string;
  /** Integer minor units (cents). */
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  /** Cumulative refunded amount in minor units. */
  refundedAmountMinor: number;
  refundReason: string | null;
  /** Set when the order flow failed after a successful payment. */
  relatedOrderFailed: boolean;
  /** Idempotency key supplied by the calling flow. */
  idempotencyKey: string;
  createdAt: number | null;
  updatedAt: number | null;
}

export type InvoiceStatus = "draft" | "issued" | "paid" | "void" | "refunded";

/** invoices/{invoiceId} — customer-facing invoice with a human number. */
export interface InvoiceRecord {
  id: string;
  uid: string;
  /** Unique human number, e.g. "INV-2026-000001" (never the doc id). */
  invoiceNumber: string;
  invoiceDate: string; // "2026-09-10"
  source: BillingSource;
  orderId: string | null;
  paymentId: string | null;
  description: string;
  /** Integer minor units. */
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: number | null;
  paidAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
}

export type BillingInterval = "weekly" | "monthly" | "yearly" | "custom";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "cancelled"
  | "expired"
  | "failed";

/** subscriptions/{subscriptionId} — mock-recurring capable. */
export interface SubscriptionRecord {
  id: string;
  uid: string;
  planId: string;
  /**
   * Catalog version tag captured at creation (e.g. "ONE_GLOBAL_V1").
   * Historical subscriptions keep the version they were created against —
   * released plan versions are never mutated (Prompt 13 versioning rule).
   */
  planVersion: string | null;
  planSnapshot: {
    planName: string;
    description: string;
    /** Integer minor units per interval. */
    amountMinor: number;
    currency: string;
    interval: BillingInterval;
  };
  status: SubscriptionStatus;
  provider: string; // "mock"
  providerSubscriptionId: string | null;
  /** Source service this subscription bills for (e.g. a number). */
  source: BillingSource;
  /** e.g. numbers/{id} for a number plan. */
  linkedEntityId: string | null;
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
  nextBillingDate: number | null;
  createdAt: number | null;
  updatedAt: number | null;
}

/** billing_events/{eventId} — immutable financial lifecycle events. */
export type BillingEventKind =
  | "payment.created"
  | "payment.paid"
  | "payment.failed"
  | "payment.refunded"
  | "invoice.created"
  | "invoice.issued"
  | "invoice.paid"
  | "invoice.voided"
  | "subscription.created"
  | "subscription.activated"
  | "subscription.paused"
  | "subscription.cancelled"
  | "subscription.payment_failed";

export interface BillingEvent {
  id: string;
  uid: string;
  kind: BillingEventKind;
  /** Related record ids for traceability; never credentials. */
  paymentId: string | null;
  invoiceId: string | null;
  subscriptionId: string | null;
  orderId: string | null;
  /** Integer minor units where relevant. */
  amountMinor: number | null;
  currency: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: number | null;
}

/** payment_methods/{methodId} — provider-backed references only. */
export interface PaymentMethodRecord {
  id: string;
  uid: string;
  provider: string; // "mock"
  /** Provider token/reference — never raw card data. */
  providerMethodId: string;
  label: string; // "Demo Payment Method"
  isDefault: boolean;
  createdAt: number | null;
}

/** Customer-safe payment projection for lists. */
export interface PaymentSummary {
  id: string;
  orderType: BillingSource;
  description: string;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  invoiceNumber: string | null;
  invoiceId: string | null;
  createdAt: number | null;
}

/** Format integer minor units for display. */
export function formatMinor(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  const symbol =
    currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "";
  const formatted = major.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${formatted}` : `${formatted} ${currency}`;
}
