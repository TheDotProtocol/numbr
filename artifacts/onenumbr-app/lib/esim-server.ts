// =============================================================================
// OneNumbr — eSIM engine (server-side; Admin SDK)
//
// Order lifecycle (all transitions here, never from the client):
//   checkout  → CREATED + PAYMENT_PENDING (idempotent per key)
//   payment   → PAID            (provider.confirmPayment)
//   provision → PROVISIONING → READY  (EsimProvider.provisionEsim)
//                          ↘ FAILED (order keeps paymentStatus=PAID;
//                                   admin can retry)
// Price integrity: the client sends only { planId, idempotencyKey }. The
// server loads the plan, computes the total, and snapshots it onto the order.
// =============================================================================

import { randomUUID } from "crypto";
import { getAdminDb } from "@/firebase/admin";
import { getEsimProvider } from "@/providers";
import { appError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit-server";
import { createNotification } from "@/lib/kyc-server";
import { chargeOrder } from "@/lib/billing-server";
import type {
  EsimOrder,
  EsimPlan,
  EsimRecord,
  PlanSnapshot,
} from "@/types/esim";
import type { NotificationKind } from "@/types/notifications";

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

export function mapPlan(id: string, d: Record<string, unknown>): EsimPlan {
  return {
    id,
    providerPlanId: String(d.providerPlanId ?? ""),
    provider: String(d.provider ?? "mock"),
    countryCode: String(d.countryCode ?? ""),
    countryName: String(d.countryName ?? ""),
    region: String(d.region ?? ""),
    flag: String(d.flag ?? ""),
    planName: String(d.planName ?? ""),
    dataAmount: Number(d.dataAmount ?? 0),
    dataUnit: (d.dataUnit as "GB" | "MB") ?? "GB",
    durationDays: Number(d.durationDays ?? 0),
    speed: String(d.speed ?? "LTE"),
    networkType: String(d.networkType ?? "LTE"),
    coverage: String(d.coverage ?? ""),
    hotspot: Boolean(d.hotspot ?? false),
    activationPolicy: String(d.activationPolicy ?? ""),
    price: Number(d.price ?? 0),
    currency: String(d.currency ?? "USD"),
    wholesaleCost: Number(d.wholesaleCost ?? 0),
    margin: Number(d.margin ?? 0),
    status: (d.status as EsimPlan["status"]) ?? "active",
    featured: Boolean(d.featured ?? false),
    sortOrder: Number(d.sortOrder ?? 100),
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}

/** Customer-safe projection — wholesaleCost/margin never leave the server. */
export function toPublicPlan(p: EsimPlan) {
  const { wholesaleCost: _w, margin: _m, ...pub } = p;
  void _w;
  void _m;
  return pub;
}

export function mapOrder(id: string, d: Record<string, unknown>): EsimOrder {
  return {
    id,
    uid: String(d.uid ?? ""),
    planId: String(d.planId ?? ""),
    planSnapshot: (d.planSnapshot ?? {}) as PlanSnapshot,
    totalAmount: Number(d.totalAmount ?? 0),
    currency: String(d.currency ?? "USD"),
    paymentStatus: (d.paymentStatus as EsimOrder["paymentStatus"]) ?? "payment_pending",
    orderStatus: (d.orderStatus as EsimOrder["orderStatus"]) ?? "created",
    provisioningStatus:
      (d.provisioningStatus as EsimOrder["provisioningStatus"]) ?? "not_started",
    provisioningError: d.provisioningError ? String(d.provisioningError) : null,
    provider: String(d.provider ?? "mock"),
    providerOrderId: d.providerOrderRef ? String(d.providerOrderRef) : null,
    esimId: d.esimId ? String(d.esimId) : null,
    idempotencyKey: String(d.idempotencyKey ?? ""),
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}

export function mapEsim(id: string, d: Record<string, unknown>): EsimRecord {
  return {
    id,
    uid: String(d.uid ?? ""),
    orderId: String(d.orderId ?? ""),
    planId: String(d.planId ?? ""),
    provider: String(d.provider ?? "mock"),
    providerEsimId: String(d.providerEsimId ?? ""),
    status: (d.status as EsimRecord["status"]) ?? "ready",
    iccid: String(d.iccid ?? ""),
    activationCode: String(d.activationCode ?? ""),
    qrPayload: String(d.qrPayload ?? ""),
    countryCode: String(d.countryCode ?? ""),
    countryName: String(d.countryName ?? ""),
    flag: String(d.flag ?? ""),
    planName: String(d.planName ?? ""),
    dataAmount: Number(d.dataAmount ?? 0),
    dataUnit: String(d.dataUnit ?? "GB"),
    dataTotalMb: Number(d.dataTotalMb ?? 0),
    dataUsedMb: Number(d.dataUsedMb ?? 0),
    durationDays: Number(d.durationDays ?? 0),
    activatedAt: toMillis(d.activatedAt),
    expiresAt: toMillis(d.expiresAt),
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}

// ---------------------------------------------------------------------------
// Catalog (server)
// ---------------------------------------------------------------------------

export async function getPlanById(planId: string): Promise<EsimPlan> {
  const snap = await getAdminDb().collection("esim_plans").doc(planId).get();
  if (!snap.exists) throw appError("not-found", `plan ${planId} missing`);
  return mapPlan(snap.id, snap.data() ?? {});
}

// ---------------------------------------------------------------------------
// Checkout → order → payment → provisioning
// ---------------------------------------------------------------------------

export interface CheckoutResult {
  order: EsimOrder;
  alreadyExists: boolean;
}

/**
 * Create (idempotently) an order for a plan and run the mock payment +
 * provisioning pipeline. The client supplies only planId + idempotencyKey.
 */
export async function createOrderAndProvision(input: {
  uid: string;
  planId: string;
  idempotencyKey: string;
}): Promise<CheckoutResult> {
  if (!input.uid) throw appError("auth/unknown", "not authenticated");
  if (!input.idempotencyKey || input.idempotencyKey.length < 8) {
    throw appError("invalid-data", "missing idempotency key");
  }

  const db = getAdminDb();

  // -------- Idempotency: reuse an existing order for the same key --------
  const existing = await db
    .collection("esim_orders")
    .where("uid", "==", input.uid)
    .where("idempotencyKey", "==", input.idempotencyKey)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    const order = mapOrder(doc.id, doc.data());
    // Resume a paid-but-unprovisioned order instead of failing.
    if (order.orderStatus === "paid" || order.orderStatus === "failed") {
      const resumed = await provisionOrder(order.id, input.uid);
      return { order: resumed, alreadyExists: true };
    }
    return { order, alreadyExists: true };
  }

  // -------- Authoritative plan + pricing --------
  const plan = await getPlanById(input.planId);
  if (plan.status !== "active") {
    throw appError("invalid-data", "plan is not available for purchase");
  }
  const quantity = 1; // V1: single-SIM checkout
  const total = plan.price * quantity;

  const now = new Date();
  const orderRef = db.collection("esim_orders").doc();
  const snapshot: PlanSnapshot = {
    planId: plan.id,
    provider: plan.provider,
    countryCode: plan.countryCode,
    countryName: plan.countryName,
    flag: plan.flag,
    planName: plan.planName,
    dataAmount: plan.dataAmount,
    dataUnit: plan.dataUnit,
    durationDays: plan.durationDays,
    speed: plan.speed,
    networkType: plan.networkType,
    coverage: plan.coverage,
    hotspot: plan.hotspot,
    currency: plan.currency,
    unitPrice: plan.price,
    quantity,
    total,
  };

  const order: EsimOrder = {
    id: orderRef.id,
    uid: input.uid,
    planId: plan.id,
    planSnapshot: snapshot,
    totalAmount: total,
    currency: plan.currency,
    paymentStatus: "payment_pending",
    orderStatus: "payment_pending",
    provisioningStatus: "not_started",
    provisioningError: null,
    provider: plan.provider,
    providerOrderId: null,
    esimId: null,
    idempotencyKey: input.idempotencyKey,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };

  await orderRef.set({
    ...order,
    createdAt: now,
    updatedAt: now,
  });

  await writeAuditLog({
    actorUid: input.uid,
    action: "esim.order_created",
    targetUid: input.uid,
    metadata: { orderId: order.id, planId: plan.id, total, currency: plan.currency },
  });
  await notify(input.uid, "esim.order_created",
    "Order received", `Your ${plan.countryName} eSIM order was received and is being processed.`);

  // -------- Payment via the centralized billing engine (Prompt 5) --------
  // chargeOrder runs the PaymentProvider, records the payment + invoice and
  // is idempotent per idempotencyKey — the checkout can never charge twice.
  const { payment } = await chargeOrder({
    uid: input.uid,
    orderType: "esim",
    orderId: order.id,
    idempotencyKey: input.idempotencyKey,
    amountMinor: Math.round(total * 100),
    currency: plan.currency,
    description: `OneNumbr eSIM · ${plan.planName}`,
  });

  if (payment.status !== "paid") {
    await orderRef.update({
      paymentStatus: "failed",
      orderStatus: "failed",
      updatedAt: new Date(),
    });
    throw appError("server", "payment failed");
  }

  await orderRef.update({
    paymentStatus: "paid",
    orderStatus: "paid",
    providerOrderId: payment.providerPaymentId,
    updatedAt: new Date(),
  });
  await writeAuditLog({
    actorUid: input.uid,
    action: "esim.payment_confirmed",
    targetUid: input.uid,
    metadata: { orderId: order.id, providerPaymentId: payment.providerPaymentId },
  });
  await notify(input.uid, "esim.payment_successful",
    "Payment successful", `Payment for your ${plan.countryName} eSIM was confirmed.`);

  // -------- Provisioning --------
  const provisioned = await provisionOrder(order.id, input.uid);
  return { order: provisioned, alreadyExists: false };
}

/**
 * Run provisioning for a paid order. Idempotent: skips when the order
 * already has an eSIM, and asks the provider for existing activation
 * details when the provider order was already created.
 */
export async function provisionOrder(orderId: string, actorUid: string): Promise<EsimOrder> {
  const db = getAdminDb();
  const orderRef = db.collection("esim_orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw appError("not-found", `order ${orderId} missing`);
  const order = mapOrder(orderId, snap.data() ?? {});

  if (order.esimId) return order; // already provisioned
  if (order.paymentStatus !== "paid") {
    throw appError("invalid-data", "order is not paid");
  }

  const plan = await getPlanById(order.planId);
  const provider = getEsimProvider();

  await orderRef.update({
    orderStatus: "provisioning",
    provisioningStatus: "in_progress",
    updatedAt: new Date(),
  });
  await writeAuditLog({
    actorUid,
    action: "esim.provisioning_started",
    targetUid: order.uid,
    metadata: { orderId },
  });
  await notify(order.uid, "esim.provisioning_started",
    "Preparing your eSIM", `We're preparing your ${plan.countryName} eSIM.`);

  try {
    // Provider order ref (idempotent per order id).
    const providerOrderRef =
      order.providerOrderId ?? `MOCK-ORDER-${orderId.replace(/-/g, "").slice(0, 12).toUpperCase()}`;

    const provisioned = await provider.provisionEsim({
      providerOrderRef,
      // Deterministic sandbox hook: the seeded failure-test plan carries a
      // providerPlanId containing "FAIL" (MOCK-FAIL-PROVISION), letting
      // teams exercise the failure + retry path on demand.
      providerPlanId: plan.providerPlanId,
    });

    const esimId = randomUUID();
    const totalMb =
      plan.dataUnit === "GB" ? plan.dataAmount * 1024 : plan.dataAmount;
    const usage = provider.getUsage
      ? await provider.getUsage({ iccid: provisioned.iccid }).catch(() => null)
      : null;
    const usedMb = usage?.usedMb ?? 0;

    const esim: EsimRecord = {
      id: esimId,
      uid: order.uid,
      orderId: order.id,
      planId: plan.id,
      provider: provider.name,
      providerEsimId: provisioned.providerOrderRef,
      status: "ready",
      iccid: provisioned.iccid,
      activationCode: provisioned.activationCode,
      qrPayload: provisioned.qrPayload,
      countryCode: plan.countryCode,
      countryName: plan.countryName,
      flag: plan.flag,
      planName: plan.planName,
      dataAmount: plan.dataAmount,
      dataUnit: plan.dataUnit,
      dataTotalMb: totalMb,
      dataUsedMb: usedMb,
      durationDays: plan.durationDays,
      activatedAt: null,
      expiresAt: usage?.expiresAt ?? Date.now() + plan.durationDays * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const batch = db.batch();
    batch.set(db.collection("esims").doc(esimId), esim);
    batch.update(orderRef, {
      orderStatus: "ready",
      provisioningStatus: "succeeded",
      provisioningError: null,
      esimId,
      updatedAt: new Date(),
    });
    await batch.commit();

    await writeAuditLog({
      actorUid,
      action: "esim.provisioning_completed",
      targetUid: order.uid,
      metadata: { orderId, esimId },
    });
    await notify(order.uid, "esim.ready",
      `${plan.countryName} eSIM ready`,
      `Your ${plan.countryName} eSIM is ready to install. Open OneNumbr to view the QR code and installation guide.`);

    return mapOrder(orderId, (await orderRef.get()).data() ?? {});
  } catch (err) {
    // Failure recovery: the order and payment state persist; the user sees
    // an honest failure and admin can retry.
    const message = err instanceof Error ? err.message : String(err);
    await orderRef.update({
      orderStatus: "failed",
      provisioningStatus: "failed",
      provisioningError: message.slice(0, 500),
      updatedAt: new Date(),
    });
    await writeAuditLog({
      actorUid,
      action: "esim.provisioning_failed",
      targetUid: order.uid,
      metadata: { orderId },
    });
    await notify(order.uid, "esim.provisioning_failed",
      "We couldn't finish preparing your eSIM",
      `There was a problem preparing your ${plan.countryName} eSIM. Our team has been notified — you won't be charged again for a retry.`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listUserOrders(uid: string, limit = 25): Promise<EsimOrder[]> {
  const snap = await getAdminDb()
    .collection("esim_orders")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => mapOrder(d.id, d.data()));
}

export async function getUserOrder(uid: string, orderId: string): Promise<EsimOrder> {
  const snap = await getAdminDb().collection("esim_orders").doc(orderId).get();
  if (!snap.exists) throw appError("not-found", "order missing");
  const order = mapOrder(orderId, snap.data() ?? {});
  if (order.uid !== uid) throw appError("permission-denied", "not your order");
  return order;
}

export async function listUserEsims(uid: string): Promise<EsimRecord[]> {
  const snap = await getAdminDb()
    .collection("esims")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => mapEsim(d.id, d.data()));
}

export async function getUserEsim(uid: string, esimId: string): Promise<EsimRecord> {
  const snap = await getAdminDb().collection("esims").doc(esimId).get();
  if (!snap.exists) throw appError("not-found", "eSIM missing");
  const esim = mapEsim(esimId, snap.data() ?? {});
  if (esim.uid !== uid) throw appError("permission-denied", "not your eSIM");
  return esim;
}

// ---------------------------------------------------------------------------
// Admin plan management
// ---------------------------------------------------------------------------

export interface PlanEditorInput {
  countryCode: string;
  countryName: string;
  region: string;
  flag: string;
  planName: string;
  dataAmount: number;
  dataUnit: "GB" | "MB";
  durationDays: number;
  speed: string;
  networkType: string;
  coverage: string;
  hotspot: boolean;
  activationPolicy: string;
  price: number;
  currency: string;
  wholesaleCost: number;
  margin: number;
  status: "active" | "inactive" | "archived";
  featured: boolean;
  sortOrder: number;
}

export async function createPlan(adminUid: string, input: PlanEditorInput): Promise<EsimPlan> {
  const db = getAdminDb();
  const ref = db.collection("esim_plans").doc();
  const provider = getEsimProvider();
  const now = new Date();
  const plan: EsimPlan = {
    id: ref.id,
    providerPlanId: `${provider.name.toUpperCase()}-${ref.id.slice(0, 8).toUpperCase()}`,
    provider: provider.name,
    ...input,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };
  await ref.set({ ...plan, createdAt: now, updatedAt: now });
  await writeAuditLog({
    actorUid: adminUid,
    action: "esim.plan_created",
    metadata: { planId: ref.id, planName: plan.planName },
  });
  return plan;
}

export async function updatePlan(
  adminUid: string,
  planId: string,
  patch: Partial<PlanEditorInput>,
): Promise<EsimPlan> {
  const db = getAdminDb();
  const ref = db.collection("esim_plans").doc(planId);
  const snap = await ref.get();
  if (!snap.exists) throw appError("not-found", "plan missing");
  const before = mapPlan(planId, snap.data() ?? {});
  const updated = { ...before, ...patch, id: planId, updatedAt: Date.now() };
  await ref.update({ ...patch, updatedAt: new Date() });

  const disabled = before.status === "active" && patch.status && patch.status !== "active";
  await writeAuditLog({
    actorUid: adminUid,
    action: disabled ? "esim.plan_disabled" : "esim.plan_updated",
    metadata: { planId, planName: updated.planName, status: updated.status },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Admin queues
// ---------------------------------------------------------------------------

export async function listAllOrders(limit = 50): Promise<(EsimOrder & { email: string })[]> {
  const db = getAdminDb();
  const snap = await db.collection("esim_orders").orderBy("createdAt", "desc").limit(limit).get();
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
    ...mapOrder(d.id, d.data()),
    email: emails.get(String(d.data().uid ?? "")) ?? "",
  }));
}

export async function listAllEsims(limit = 50): Promise<(EsimRecord & { email: string })[]> {
  const db = getAdminDb();
  const snap = await db.collection("esims").orderBy("createdAt", "desc").limit(limit).get();
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
    ...mapEsim(d.id, d.data()),
    email: emails.get(String(d.data().uid ?? "")) ?? "",
  }));
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

async function notify(uid: string, kind: NotificationKind, title: string, message: string) {
  await createNotification({ uid, kind, title, message });
}
