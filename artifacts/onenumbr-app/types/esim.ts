// =============================================================================
// OneNumbr — eSIM types (Marketplace & Provisioning Engine v1.0)
//
// Order state machine:
//   CREATED → PAYMENT_PENDING → PAID → PROVISIONING → READY
//                                   ↘ FAILED (payment ok, provisioning failed)
//   CREATED/PAYMENT_PENDING → CANCELLED | EXPIRED
//
// eSIM state machine:
//   PENDING → READY → ACTIVE → SUSPENDED → EXPIRED | CANCELLED
//                   ↘ FAILED
// =============================================================================

/** Catalog plan (esim_plans/{planId}). wholesaleCost/margin are admin-only. */
export interface EsimPlan {
  id: string;
  providerPlanId: string;
  provider: string;
  countryCode: string; // ISO 3166-1 alpha-2, "XX" = regional/global in future
  countryName: string;
  region: string; // e.g. "Asia", "Europe", "Global"
  flag: string;
  planName: string;
  dataAmount: number;
  dataUnit: "GB" | "MB";
  durationDays: number;
  speed: string; // "5G / LTE", "LTE"
  networkType: string; // "5G / LTE", "LTE", "3G"
  coverage: string; // human-readable coverage note
  hotspot: boolean;
  activationPolicy: string; // "validity starts on activation"
  price: number; // major units
  currency: string; // "USD"
  /** Admin-only internal pricing — never serialized to normal users. */
  wholesaleCost: number;
  margin: number;
  status: "active" | "inactive" | "archived";
  featured: boolean;
  sortOrder: number;
  createdAt: number | null;
  updatedAt: number | null;
}

/** Customer-safe projection of a plan (no internal pricing). */
export type PublicPlan = Omit<EsimPlan, "wholesaleCost" | "margin">;

/** Immutable commercial snapshot stored on the order at purchase time. */
export interface PlanSnapshot {
  planId: string;
  provider: string;
  countryCode: string;
  countryName: string;
  flag: string;
  planName: string;
  dataAmount: number;
  dataUnit: string;
  durationDays: number;
  speed: string;
  networkType: string;
  coverage: string;
  hotspot: boolean;
  currency: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

/** Firestore esim_orders/{orderId}. All transitions server-side only. */
export interface EsimOrder {
  id: string;
  uid: string;
  planId: string;
  planSnapshot: PlanSnapshot;
  /** Server-computed authoritative pricing. */
  totalAmount: number;
  currency: string;
  paymentStatus: "payment_pending" | "paid" | "failed" | "refunded";
  orderStatus:
    | "created"
    | "payment_pending"
    | "paid"
    | "provisioning"
    | "ready"
    | "failed"
    | "cancelled"
    | "expired";
  provisioningStatus: "not_started" | "in_progress" | "succeeded" | "failed";
  provisioningError: string | null;
  provider: string;
  providerOrderId: string | null;
  esimId: string | null;
  idempotencyKey: string;
  createdAt: number | null;
  updatedAt: number | null;
}

/** Firestore esims/{esimId}. Activation values stay out of user queries. */
export interface EsimRecord {
  id: string;
  uid: string;
  orderId: string;
  planId: string;
  provider: string;
  providerEsimId: string;
  status: "pending" | "ready" | "active" | "suspended" | "expired" | "cancelled" | "failed";
  iccid: string;
  activationCode: string; // LPA:... string
  qrPayload: string;
  countryCode: string;
  countryName: string;
  flag: string;
  planName: string;
  dataAmount: number;
  dataUnit: string;
  dataTotalMb: number;
  dataUsedMb: number;
  durationDays: number;
  activatedAt: number | null;
  expiresAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
}

/** Checkout session for idempotency (esim_checkouts/{checkoutId}). */
export interface EsimCheckout {
  id: string;
  uid: string;
  planId: string;
  status: "pending" | "completed" | "expired";
  orderId: string | null;
  createdAt: number | null;
}

/** Admin queue DTO (joined data for display). */
export interface AdminOrderRow {
  id: string;
  uid: string;
  email: string;
  destination: string;
  planName: string;
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  provisioningStatus: string;
  orderStatus: string;
  createdAt: number | null;
}

export interface AdminEsimRow {
  id: string;
  uid: string;
  email: string;
  destination: string;
  planName: string;
  status: string;
  iccid: string;
  createdAt: number | null;
}

export function formatData(amount: number, unit: string): string {
  return unit === "GB" ? `${amount} GB` : `${amount} MB`;
}
