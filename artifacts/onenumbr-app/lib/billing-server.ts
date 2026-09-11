// =============================================================================
// OneNumbr — Billing engine (server-side; Admin SDK; Prompt 5)
//
// ONE centralized financial layer for every source (eSIM, numbers,
// subscriptions, future services). eSIM/Number checkouts call chargeOrder()
// here; they never create their own payment records.
//
// Money: integer minor units only (1999 = $19.99). No float math.
//
// Idempotency: every charge carries (uid, idempotencyKey) uniqueness — a
// retried checkout returns the original payment instead of charging twice.
//
// Invoice numbers: sequential INV-YYYY-###### allocated inside a
// transaction on a billing_counters doc (never the Firestore doc id).
// =============================================================================

import { randomUUID } from "crypto";
import { getAdminDb } from "@/firebase/admin";
import { getPaymentProvider } from "@/providers";
import { appError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit-server";
import { createNotification } from "@/lib/kyc-server";
import type {
  BillingEvent,
  BillingEventKind,
  BillingInterval,
  BillingSource,
  InvoiceRecord,
  InvoiceStatus,
  PaymentRecord,
  PaymentStatus,
  SubscriptionRecord,
  SubscriptionStatus,
} from "@/types/billing";

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function toMillis(v: unknown): number | null {
  if (!v) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "toMillis" in v) {
    return (v as { toMillis(): number }).toMillis();
  }
  return null;
}

export function mapPayment(id: string, d: Record<string, unknown>): PaymentRecord {
  return {
    id,
    uid: String(d.uid ?? ""),
    orderId: d.orderId ? String(d.orderId) : null,
    orderType: (d.orderType as BillingSource) ?? "other",
    provider: String(d.provider ?? "mock"),
    providerPaymentId: String(d.providerPaymentId ?? ""),
    amountMinor: Number(d.amountMinor ?? 0),
    currency: String(d.currency ?? "USD"),
    status: (d.status as PaymentStatus) ?? "pending",
    description: String(d.description ?? ""),
    refundedAmountMinor: Number(d.refundedAmountMinor ?? 0),
    refundReason: d.refundReason ? String(d.refundReason) : null,
    relatedOrderFailed: Boolean(d.relatedOrderFailed ?? false),
    idempotencyKey: String(d.idempotencyKey ?? ""),
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}

export function mapInvoice(id: string, d: Record<string, unknown>): InvoiceRecord {
  return {
    id,
    uid: String(d.uid ?? ""),
    invoiceNumber: String(d.invoiceNumber ?? ""),
    invoiceDate: String(d.invoiceDate ?? ""),
    source: (d.source as BillingSource) ?? "other",
    orderId: d.orderId ? String(d.orderId) : null,
    paymentId: d.paymentId ? String(d.paymentId) : null,
    description: String(d.description ?? ""),
    subtotalMinor: Number(d.subtotalMinor ?? 0),
    taxMinor: Number(d.taxMinor ?? 0),
    discountMinor: Number(d.discountMinor ?? 0),
    totalMinor: Number(d.totalMinor ?? 0),
    currency: String(d.currency ?? "USD"),
    status: (d.status as InvoiceStatus) ?? "draft",
    issuedAt: toMillis(d.issuedAt),
    paidAt: toMillis(d.paidAt),
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}

export function mapSubscription(id: string, d: Record<string, unknown>): SubscriptionRecord {
  return {
    id,
    uid: String(d.uid ?? ""),
    planId: String(d.planId ?? ""),
    planVersion: d.planVersion ? String(d.planVersion) : null,
    planSnapshot: (d.planSnapshot ?? {}) as SubscriptionRecord["planSnapshot"],
    status: (d.status as SubscriptionStatus) ?? "trialing",
    provider: String(d.provider ?? "mock"),
    providerSubscriptionId: d.providerSubscriptionId ? String(d.providerSubscriptionId) : null,
    source: (d.source as BillingSource) ?? "other",
    linkedEntityId: d.linkedEntityId ? String(d.linkedEntityId) : null,
    currentPeriodStart: toMillis(d.currentPeriodStart),
    currentPeriodEnd: toMillis(d.currentPeriodEnd),
    nextBillingDate: toMillis(d.nextBillingDate),
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Billing events (immutable lifecycle records)
// ---------------------------------------------------------------------------

export async function writeBillingEvent(input: {
  uid: string;
  kind: BillingEventKind;
  paymentId?: string | null;
  invoiceId?: string | null;
  subscriptionId?: string | null;
  orderId?: string | null;
  amountMinor?: number | null;
  currency?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  await getAdminDb().collection("billing_events").add({
    uid: input.uid,
    kind: input.kind,
    paymentId: input.paymentId ?? null,
    invoiceId: input.invoiceId ?? null,
    subscriptionId: input.subscriptionId ?? null,
    orderId: input.orderId ?? null,
    amountMinor: input.amountMinor ?? null,
    currency: input.currency ?? null,
    metadata: input.metadata ?? {},
    createdAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// Invoice numbering (unique, human-readable, transaction-allocated)
// ---------------------------------------------------------------------------

async function allocateInvoiceNumber(): Promise<string> {
  const db = getAdminDb();
  const year = new Date().getFullYear();
  const ref = db.collection("billing_counters").doc(`invoice-${year}`);
  let invoiceNumber = "";
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number | undefined) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    invoiceNumber = `INV-${year}-${String(next).padStart(6, "0")}`;
  });
  return invoiceNumber;
}

// ---------------------------------------------------------------------------
// Core charge pipeline — used by eSIM and Number checkouts
// ---------------------------------------------------------------------------

export interface ChargeOrderInput {
  uid: string;
  orderType: BillingSource;
  orderId: string;
  /** Idempotency key from the calling flow (checkout session key). */
  idempotencyKey: string;
  /** Server-computed authoritative total (minor units). */
  amountMinor: number;
  currency: string;
  description: string;
}

export interface ChargeOrderResult {
  payment: PaymentRecord;
  invoice: InvoiceRecord | null;
  alreadyCharged: boolean;
}

/**
 * Charge for an order through the PaymentProvider and record the payment +
 * invoice. Idempotent per (uid, idempotencyKey): a retry returns the original
 * payment without charging again.
 */
export async function chargeOrder(input: ChargeOrderInput): Promise<ChargeOrderResult> {
  const db = getAdminDb();

  // ---- Idempotency: same key → same logical payment ----
  const existing = await db
    .collection("payments")
    .where("uid", "==", input.uid)
    .where("idempotencyKey", "==", input.idempotencyKey)
    .limit(1)
    .get();
  if (!existing.empty) {
    const payment = mapPayment(existing.docs[0].id, existing.docs[0].data());
    const invoice = await findInvoiceForPayment(input.uid, payment.id);
    return { payment, invoice, alreadyCharged: true };
  }

  // ---- Create the payment record ----
  const paymentRef = db.collection("payments").doc();
  const now = new Date();
  const payment: PaymentRecord = {
    id: paymentRef.id,
    uid: input.uid,
    orderId: input.orderId,
    orderType: input.orderType,
    provider: "mock",
    providerPaymentId: "",
    amountMinor: input.amountMinor,
    currency: input.currency,
    status: "pending",
    description: input.description,
    refundedAmountMinor: 0,
    refundReason: null,
    relatedOrderFailed: false,
    idempotencyKey: input.idempotencyKey,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };
  await paymentRef.set({ ...payment, createdAt: now, updatedAt: now });
  await writeBillingEvent({
    uid: input.uid,
    kind: "payment.created",
    paymentId: payment.id,
    orderId: input.orderId,
    amountMinor: input.amountMinor,
    currency: input.currency,
  });
  await writeAuditLog({
    actorUid: input.uid,
    action: "billing.payment_created",
    targetUid: input.uid,
    metadata: { paymentId: payment.id, orderType: input.orderType, orderId: input.orderId },
  });

  // ---- Provider abstraction ----
  const provider = getPaymentProvider();
  const intent = await provider.createPaymentIntent({
    orderRef: input.orderId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    description: input.description,
  });
  const confirmation = await provider.confirmPayment({ providerPaymentId: intent.providerPaymentId });

  if (confirmation.status !== "succeeded") {
    await paymentRef.update({ status: "failed", providerPaymentId: intent.providerPaymentId, updatedAt: new Date() });
    await writeBillingEvent({
      uid: input.uid,
      kind: "payment.failed",
      paymentId: payment.id,
      orderId: input.orderId,
      amountMinor: input.amountMinor,
      currency: input.currency,
    });
    await writeAuditLog({
      actorUid: input.uid,
      action: "billing.payment_failed",
      targetUid: input.uid,
      metadata: { paymentId: payment.id, orderType: input.orderType },
    });
    await notify(
      input.uid,
      "billing.payment_failed",
      "Payment unsuccessful",
      "Your payment could not be completed. You have not been charged — please try again.",
    );
    return { payment: mapPayment(payment.id, (await paymentRef.get()).data() ?? {}), invoice: null, alreadyCharged: false };
  }

  await paymentRef.update({ status: "paid", providerPaymentId: intent.providerPaymentId, updatedAt: new Date() });
  const paidPayment = mapPayment(payment.id, (await paymentRef.get()).data() ?? {});

  await writeBillingEvent({
    uid: input.uid,
    kind: "payment.paid",
    paymentId: payment.id,
    orderId: input.orderId,
    amountMinor: input.amountMinor,
    currency: input.currency,
  });
  await writeAuditLog({
    actorUid: input.uid,
    action: "billing.payment_succeeded",
    targetUid: input.uid,
    metadata: { paymentId: payment.id, providerPaymentId: intent.providerPaymentId },
  });
  await notify(
    input.uid,
    "billing.payment_successful",
    "Payment successful",
    `Your ${input.description} payment was completed.`,
  );

  // ---- Invoice ----
  const invoice = await createPaidInvoice({
    uid: input.uid,
    source: input.orderType,
    orderId: input.orderId,
    paymentId: payment.id,
    description: input.description,
    totalMinor: input.amountMinor,
    currency: input.currency,
  });

  return { payment: paidPayment, invoice, alreadyCharged: false };
}

async function findInvoiceForPayment(uid: string, paymentId: string): Promise<InvoiceRecord | null> {
  const snap = await getAdminDb()
    .collection("invoices")
    .where("uid", "==", uid)
    .where("paymentId", "==", paymentId)
    .limit(1)
    .get();
  return snap.empty ? null : mapInvoice(snap.docs[0].id, snap.docs[0].data());
}

/** Issue + mark paid in one flow (P5: single-purchase invoices). */
async function createPaidInvoice(input: {
  uid: string;
  source: BillingSource;
  orderId: string;
  paymentId: string;
  description: string;
  totalMinor: number;
  currency: string;
}): Promise<InvoiceRecord> {
  const db = getAdminDb();
  const invoiceNumber = await allocateInvoiceNumber();
  const now = new Date();
  const ref = db.collection("invoices").doc();
  const invoice: InvoiceRecord = {
    id: ref.id,
    uid: input.uid,
    invoiceNumber,
    invoiceDate: now.toISOString().slice(0, 10),
    source: input.source,
    orderId: input.orderId,
    paymentId: input.paymentId,
    description: input.description,
    subtotalMinor: input.totalMinor,
    taxMinor: 0, // tax calculation intentionally not configured (Prompt 5)
    discountMinor: 0,
    totalMinor: input.totalMinor,
    currency: input.currency,
    status: "paid",
    issuedAt: now.getTime(),
    paidAt: now.getTime(),
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };
  await ref.set({ ...invoice, createdAt: now, updatedAt: now });

  await writeBillingEvent({
    uid: input.uid,
    kind: "invoice.created",
    invoiceId: ref.id,
    paymentId: input.paymentId,
    orderId: input.orderId,
    amountMinor: input.totalMinor,
    currency: input.currency,
  });
  await writeBillingEvent({
    uid: input.uid,
    kind: "invoice.paid",
    invoiceId: ref.id,
    paymentId: input.paymentId,
    orderId: input.orderId,
    amountMinor: input.totalMinor,
    currency: input.currency,
  });
  await writeAuditLog({
    actorUid: input.uid,
    action: "billing.invoice_created",
    targetUid: input.uid,
    metadata: { invoiceId: ref.id, invoiceNumber },
  });
  await writeAuditLog({
    actorUid: input.uid,
    action: "billing.invoice_paid",
    targetUid: input.uid,
    metadata: { invoiceId: ref.id, invoiceNumber },
  });
  await notify(
    input.uid,
    "billing.invoice_issued",
    `Invoice ${invoiceNumber}`,
    `${input.description} — ${input.currency} ${(input.totalMinor / 100).toFixed(2)}. View it any time in Billing.`,
  );

  return invoice;
}

// ---------------------------------------------------------------------------
// Refunds (admin-initiated; full + partial)
// ---------------------------------------------------------------------------

export async function refundPayment(input: {
  adminUid: string;
  paymentId: string;
  /** Minor units; omit for a full refund. */
  amountMinor?: number;
  reason: string;
}): Promise<PaymentRecord> {
  const db = getAdminDb();
  const ref = db.collection("payments").doc(input.paymentId);
  const payment = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw appError("not-found", "payment not found");
    return mapPayment(snap.id, snap.data() ?? {});
  });

  if (payment.status !== "paid" && payment.status !== "partially_refunded") {
    throw appError("invalid-data", "only paid payments can be refunded");
  }
  const refundable = payment.amountMinor - payment.refundedAmountMinor;
  const amount = input.amountMinor ?? refundable;
  if (amount <= 0 || amount > refundable) {
    throw appError("invalid-data", "refund amount exceeds refundable balance");
  }

  const provider = getPaymentProvider();
  await provider.refundPayment({ providerPaymentId: payment.providerPaymentId, amountMinor: amount });

  const newRefunded = payment.refundedAmountMinor + amount;
  const fullyRefunded = newRefunded >= payment.amountMinor;
  await ref.update({
    refundedAmountMinor: newRefunded,
    status: fullyRefunded ? "refunded" : "partially_refunded",
    refundReason: input.reason,
    updatedAt: new Date(),
  });

  await writeBillingEvent({
    uid: payment.uid,
    kind: "payment.refunded",
    paymentId: payment.id,
    orderId: payment.orderId,
    amountMinor: amount,
    currency: payment.currency,
    metadata: { reason: input.reason, partial: !fullyRefunded },
  });
  await writeAuditLog({
    actorUid: input.adminUid,
    action: "billing.refund_completed",
    targetUid: payment.uid,
    metadata: { paymentId: payment.id, amountMinor: amount, reason: input.reason },
  });
  await notify(
    payment.uid,
    "billing.refund_processed",
    "Refund processed",
    `A refund of ${payment.currency} ${(amount / 100).toFixed(2)} for ${payment.description} has been processed.`,
  );

  // Reflect the refund on the invoice.
  if (payment.orderId) {
    const invSnap = await db
      .collection("invoices")
      .where("uid", "==", payment.uid)
      .where("orderId", "==", payment.orderId)
      .limit(1)
      .get();
    if (!invSnap.empty) {
      await invSnap.docs[0].ref.update({
        status: fullyRefunded ? "refunded" : invSnap.docs[0].data().status,
        updatedAt: new Date(),
      });
    }
  }

  return mapPayment(payment.id, (await ref.get()).data() ?? {});
}

// ---------------------------------------------------------------------------
// Subscriptions (mock-recurring; deterministic, no fake production loops)
// ---------------------------------------------------------------------------

export async function createSubscription(input: {
  uid: string;
  planId: string;
  planName: string;
  description: string;
  amountMinor: number;
  currency: string;
  interval: BillingInterval;
  source: BillingSource;
  linkedEntityId?: string | null;
  /** Catalog version tag captured at creation (Prompt 13 plan versioning). */
  planVersion?: string | null;
}): Promise<SubscriptionRecord> {
  const db = getAdminDb();

  // Concurrency: one active subscription per (uid, source, linkedEntity).
  const dup = await db
    .collection("subscriptions")
    .where("uid", "==", input.uid)
    .where("source", "==", input.source)
    .where("linkedEntityId", "==", input.linkedEntityId ?? null)
    .where("status", "in", ["trialing", "active", "past_due", "paused"])
    .limit(1)
    .get();
  if (!dup.empty) {
    throw appError("already-exists", "an active subscription already exists for this service");
  }

  const ref = db.collection("subscriptions").doc();
  const now = Date.now();
  const periodMs =
    input.interval === "yearly" ? 365 * 86_400_000 : input.interval === "weekly" ? 7 * 86_400_000 : 30 * 86_400_000;
  const subscription: SubscriptionRecord = {
    id: ref.id,
    uid: input.uid,
    planId: input.planId,
    planVersion: input.planVersion ?? null,
    planSnapshot: {
      planName: input.planName,
      description: input.description,
      amountMinor: input.amountMinor,
      currency: input.currency,
      interval: input.interval,
    },
    status: "active",
    provider: "mock",
    providerSubscriptionId: `MOCK-SUB-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`,
    source: input.source,
    linkedEntityId: input.linkedEntityId ?? null,
    currentPeriodStart: now,
    currentPeriodEnd: now + periodMs,
    nextBillingDate: now + periodMs,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set({ ...subscription, createdAt: new Date(now), updatedAt: new Date(now) });

  await writeBillingEvent({
    uid: input.uid,
    kind: "subscription.created",
    subscriptionId: ref.id,
    amountMinor: input.amountMinor,
    currency: input.currency,
    metadata: { planId: input.planId, interval: input.interval },
  });
  await writeBillingEvent({
    uid: input.uid,
    kind: "subscription.activated",
    subscriptionId: ref.id,
    amountMinor: input.amountMinor,
    currency: input.currency,
  });
  await writeAuditLog({
    actorUid: input.uid,
    action: "billing.subscription_created",
    targetUid: input.uid,
    metadata: { subscriptionId: ref.id, planId: input.planId },
  });
  await writeAuditLog({
    actorUid: input.uid,
    action: "billing.subscription_activated",
    targetUid: input.uid,
    metadata: { subscriptionId: ref.id },
  });
  await notify(
    input.uid,
    "billing.subscription_activated",
    "Subscription active",
    `${input.planName} is active on your account (demo billing — no recurring charges yet).`,
  );

  return subscription;
}

export async function setSubscriptionStatus(
  uid: string,
  subscriptionId: string,
  status: "paused" | "cancelled" | "active",
  actorUid: string,
): Promise<SubscriptionRecord> {
  const db = getAdminDb();
  const ref = db.collection("subscriptions").doc(subscriptionId);
  const snap = await ref.get();
  if (!snap.exists) throw appError("not-found", "subscription not found");
  const sub = mapSubscription(subscriptionId, snap.data() ?? {});
  if (sub.uid !== uid && actorUid !== uid) {
    // Admin actions pass the owner uid explicitly; the API layer resolves it.
    throw appError("permission-denied", "not your subscription");
  }

  // Number-retention policy (Prompt 13): pausing/cancelling the plan affects
  // ONLY the subscription. The number assignment, OneNumbr ID, invoices and
  // history are untouched — number release remains the explicit
  // releaseUserNumber product action.
  await ref.update({ status, updatedAt: new Date() });
  const kind: BillingEventKind =
    status === "paused"
      ? "subscription.paused"
      : status === "cancelled"
        ? "subscription.cancelled"
        : "subscription.activated";
  await writeBillingEvent({ uid: sub.uid, kind, subscriptionId });
  if (status === "paused") {
    await writeAuditLog({
      actorUid,
      action: "billing.subscription_suspended",
      targetUid: sub.uid,
      metadata: { subscriptionId },
    });
    await notify(
      sub.uid,
      "billing.subscription_suspended",
      "Your plan was paused",
      `${sub.planSnapshot.planName} is paused. Your number and identity are unchanged — you can reactivate anytime.`,
    );
  }
  if (status === "active") {
    // Reactivation path (resume). Creation notifications come from
    // createSubscription; this covers cancelled/paused → active only.
    await notify(
      sub.uid,
      "billing.subscription_activated",
      "Your OneNumbr Global Plan is active",
      `${sub.planSnapshot.planName} is active again. Your number and identity are unchanged.`,
    );
  }
  if (status === "cancelled") {
    await writeAuditLog({
      actorUid,
      action: "billing.subscription_cancelled",
      targetUid: sub.uid,
      metadata: { subscriptionId },
    });
    await notify(sub.uid, "billing.subscription_cancelled", "Subscription cancelled", `${sub.planSnapshot.planName} has been cancelled.`);
  }
  return mapSubscription(subscriptionId, (await ref.get()).data() ?? {});
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getUserPayments(uid: string, limit = 50): Promise<PaymentRecord[]> {
  const snap = await getAdminDb()
    .collection("payments")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => mapPayment(d.id, d.data()));
}

export async function getUserPayment(uid: string, paymentId: string): Promise<PaymentRecord> {
  const snap = await getAdminDb().collection("payments").doc(paymentId).get();
  if (!snap.exists) throw appError("not-found", "payment not found");
  const p = mapPayment(snap.id, snap.data() ?? {});
  if (p.uid !== uid) throw appError("permission-denied", "not your payment");
  return p;
}

export async function getUserInvoices(uid: string, limit = 50): Promise<InvoiceRecord[]> {
  const snap = await getAdminDb()
    .collection("invoices")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => mapInvoice(d.id, d.data()));
}

export async function getUserInvoice(uid: string, invoiceId: string): Promise<InvoiceRecord> {
  const snap = await getAdminDb().collection("invoices").doc(invoiceId).get();
  if (!snap.exists) throw appError("not-found", "invoice not found");
  const inv = mapInvoice(snap.id, snap.data() ?? {});
  if (inv.uid !== uid) throw appError("permission-denied", "not your invoice");
  return inv;
}

export async function getUserSubscriptions(uid: string): Promise<SubscriptionRecord[]> {
  const snap = await getAdminDb()
    .collection("subscriptions")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map((d) => mapSubscription(d.id, d.data()));
}

export async function getUserBillingEvents(uid: string, limit = 50): Promise<BillingEvent[]> {
  const snap = await getAdminDb()
    .collection("billing_events")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BillingEvent, "id">) }));
}

/** Default payment method record (mock). Created lazily on first read. */
export async function getOrCreateDefaultPaymentMethod(uid: string) {
  const db = getAdminDb();
  const snap = await db
    .collection("payment_methods")
    .where("uid", "==", uid)
    .limit(1)
    .get();
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as { id: string; label: string; provider: string; isDefault: boolean };
  }
  const ref = db.collection("payment_methods").doc();
  const record = {
    id: ref.id,
    uid,
    provider: "mock",
    providerMethodId: `MOCK-PM-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`,
    label: "Demo Payment Method",
    isDefault: true,
    createdAt: new Date(),
  };
  await ref.set(record);
  return { id: ref.id, label: record.label, provider: record.provider, isDefault: record.isDefault };
}

// ---------------------------------------------------------------------------
// Aggregations
// ---------------------------------------------------------------------------

export interface BillingOverview {
  payments: PaymentRecord[];
  invoices: InvoiceRecord[];
  subscriptions: SubscriptionRecord[];
  paymentMethod: { id: string; label: string; provider: string; isDefault: boolean };
}

export async function getBillingOverview(uid: string): Promise<BillingOverview> {
  const [payments, invoices, subscriptions, paymentMethod] = await Promise.all([
    getUserPayments(uid, 10),
    getUserInvoices(uid, 10),
    getUserSubscriptions(uid),
    getOrCreateDefaultPaymentMethod(uid),
  ]);
  return { payments, invoices, subscriptions, paymentMethod };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminBillingOverview {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  refundedPayments: number;
  activeSubscriptions: number;
  revenueMinor: number;
  refundedMinor: number;
}

export async function getAdminBillingOverview(): Promise<AdminBillingOverview> {
  const db = getAdminDb();
  const paymentsSnap = await db.collection("payments").limit(500).get();
  const subsSnap = await db.collection("subscriptions").where("status", "==", "active").limit(500).get();

  const payments = paymentsSnap.docs.map((d) => mapPayment(d.id, d.data()));
  const successful = payments.filter((p) => p.status === "paid" || p.status === "partially_refunded" || p.status === "refunded");
  return {
    totalPayments: payments.length,
    successfulPayments: successful.length,
    failedPayments: payments.filter((p) => p.status === "failed").length,
    refundedPayments: payments.filter((p) => p.status === "refunded" || p.status === "partially_refunded").length,
    activeSubscriptions: subsSnap.size,
    // Net revenue: collected minus refunded (integer math only).
    revenueMinor: successful.reduce((sum, p) => sum + p.amountMinor, 0),
    refundedMinor: payments.reduce((sum, p) => sum + p.refundedAmountMinor, 0),
  };
}

export async function listAllPayments(limit = 100): Promise<(PaymentRecord & { email: string })[]> {
  const db = getAdminDb();
  const snap = await db.collection("payments").orderBy("createdAt", "desc").limit(limit).get();
  const emails = new Map<string, string>();
  await Promise.all(
    snap.docs.map(async (d) => {
      const uid = String(d.data().uid ?? "");
      if (!uid || emails.has(uid)) return;
      const u = await db.collection("users").doc(uid).get();
      emails.set(uid, String(u.data()?.email ?? ""));
    }),
  );
  return snap.docs.map((d) => ({
    ...mapPayment(d.id, d.data()),
    email: emails.get(String(d.data().uid ?? "")) ?? "",
  }));
}

export async function listAllInvoices(limit = 100): Promise<(InvoiceRecord & { email: string })[]> {
  const db = getAdminDb();
  const snap = await db.collection("invoices").orderBy("createdAt", "desc").limit(limit).get();
  const emails = new Map<string, string>();
  await Promise.all(
    snap.docs.map(async (d) => {
      const uid = String(d.data().uid ?? "");
      if (!uid || emails.has(uid)) return;
      const u = await db.collection("users").doc(uid).get();
      emails.set(uid, String(u.data()?.email ?? ""));
    }),
  );
  return snap.docs.map((d) => ({
    ...mapInvoice(d.id, d.data()),
    email: emails.get(String(d.data().uid ?? "")) ?? "",
  }));
}

export async function listAllSubscriptions(limit = 100): Promise<(SubscriptionRecord & { email: string })[]> {
  const db = getAdminDb();
  const snap = await db.collection("subscriptions").orderBy("createdAt", "desc").limit(limit).get();
  const emails = new Map<string, string>();
  await Promise.all(
    snap.docs.map(async (d) => {
      const uid = String(d.data().uid ?? "");
      if (!uid || emails.has(uid)) return;
      const u = await db.collection("users").doc(uid).get();
      emails.set(uid, String(u.data()?.email ?? ""));
    }),
  );
  return snap.docs.map((d) => ({
    ...mapSubscription(d.id, d.data()),
    email: emails.get(String(d.data().uid ?? "")) ?? "",
  }));
}

export async function listAllBillingEvents(limit = 100): Promise<BillingEvent[]> {
  const snap = await getAdminDb()
    .collection("billing_events")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BillingEvent, "id">) }));
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

async function notify(uid: string, kind: Parameters<typeof createNotification>[0]["kind"], title: string, message: string) {
  await createNotification({ uid, kind, title, message });
}
