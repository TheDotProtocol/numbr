// =============================================================================
// OneNumbr — Number engine (server-side; Admin SDK; Prompt 4)
//
// OneNumbr ID (onenumbr_ids) = permanent identity. OneNumbr Number = public
// communications identity assigned here. Releasing a number NEVER touches the
// OneNumbr ID, and the schema supports multiple assignments per user over
// time (and in future, concurrently).
//
// All state transitions live here — never from the client:
//   search (inventory, TTL-aware) → reserve (15-min hold) → checkout
//   (idempotent; server-computed price) → mock payment → provisioning
//   (MockTelecomProvider) → assignment + ACTIVE number
//   release → assignment history preserved
//
// Price integrity: the client sends only { numberId, idempotencyKey }. The
// server loads the authoritative inventory record, computes the total and
// snapshots it onto the order.
// =============================================================================

import { getAdminDb } from "@/firebase/admin";
import { getTelecomProvider } from "@/providers";
import { appError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit-server";
import { createNotification, mapKycDoc } from "@/lib/kyc-server";
import { chargeOrder, createSubscription } from "@/lib/billing-server";
import { getDefaultGlobalPlan } from "@/lib/plan-catalog";
import { deriveIdentityState, type IdentityState } from "@/types/kyc";
import { MOCK_TTL_SECONDS } from "@/providers/telecom/mock";
import type {
  MyNumber,
  NumberAssignment,
  NumberCapability,
  NumberOrder,
  NumberRecord,
  NumberSnapshot,
  NumberType,
  PublicNumber,
} from "@/types/number";
import { formatNumber } from "@/types/number";
import type { NotificationKind } from "@/types/notifications";

const RESERVATION_TTL_MS = MOCK_TTL_SECONDS * 1000;

/**
 * Server-side KYC gate. Reads the user's kyc/{uid} case and derives the
 * identity state with the existing Prompt 2 logic — KYC logic itself is
 * never duplicated or modified here.
 */
async function getIdentityStateForUser(uid: string): Promise<IdentityState> {
  const snap = await getAdminDb().collection("kyc").doc(uid).get();
  return deriveIdentityState(snap.exists ? mapKycDoc(uid, snap.data() ?? {}) : null);
}

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

export function mapNumber(id: string, d: Record<string, unknown>): NumberRecord {
  return {
    id,
    onenumbrNumber: String(d.onenumbrNumber ?? ""),
    providerNumber: String(d.providerNumber ?? ""),
    provider: String(d.provider ?? "mock-telecom"),
    countryCode: String(d.countryCode ?? ""),
    region: String(d.region ?? ""),
    type: (d.type as NumberType) ?? "mobile",
    status: (d.status as NumberRecord["status"]) ?? "available",
    capabilities: (d.capabilities as NumberCapability[]) ?? ["SMS", "VOICE"],
    monthlyPrice: Number(d.monthlyPrice ?? 0),
    currency: String(d.currency ?? "USD"),
    uid: d.uid ? String(d.uid) : null,
    reservedBy: d.reservedBy ? String(d.reservedBy) : null,
    reservedAt: toMillis(d.reservedAt),
    reservationExpiresAt: toMillis(d.reservationExpiresAt),
    displayNumber: String(d.displayNumber ?? "") || formatNumber(String(d.onenumbrNumber ?? "")),
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}

function mapAssignment(id: string, d: Record<string, unknown>): NumberAssignment {
  return {
    id,
    uid: String(d.uid ?? ""),
    numberId: String(d.numberId ?? ""),
    onenumbrNumber: String(d.onenumbrNumber ?? ""),
    displayNumber: String(d.displayNumber ?? "") || formatNumber(String(d.onenumbrNumber ?? "")),
    status: (d.status as NumberAssignment["status"]) ?? "active",
    orderId: d.orderId ? String(d.orderId) : null,
    assignedAt: toMillis(d.assignedAt),
    releasedAt: toMillis(d.releasedAt),
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}

export function mapNumberOrder(id: string, d: Record<string, unknown>): NumberOrder {
  return {
    id,
    uid: String(d.uid ?? ""),
    numberId: String(d.numberId ?? ""),
    numberSnapshot: (d.numberSnapshot ?? {}) as NumberSnapshot,
    totalAmount: Number(d.totalAmount ?? 0),
    currency: String(d.currency ?? "USD"),
    paymentStatus: (d.paymentStatus as NumberOrder["paymentStatus"]) ?? "payment_pending",
    orderStatus: (d.orderStatus as NumberOrder["orderStatus"]) ?? "created",
    provisioningError: d.provisioningError ? String(d.provisioningError) : null,
    provider: String(d.provider ?? "mock-telecom"),
    providerOrderId: d.providerOrderId ? String(d.providerOrderId) : null,
    assignmentId: d.assignmentId ? String(d.assignmentId) : null,
    idempotencyKey: String(d.idempotencyKey ?? ""),
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}

/** Customer-safe inventory projection — reservation internals excluded. */
function toPublicNumber(n: NumberRecord): PublicNumber {
  return {
    id: n.id,
    displayNumber: n.displayNumber,
    countryCode: n.countryCode,
    region: n.region,
    type: n.type,
    capabilities: n.capabilities,
    monthlyPrice: n.monthlyPrice,
    currency: n.currency,
  };
}

// ---------------------------------------------------------------------------
// Search (server-side filtering; TTL-aware availability)
// ---------------------------------------------------------------------------

export interface SearchNumbersResult {
  numbers: PublicNumber[];
  nextCursor: string | null;
}

/**
 * Search available inventory. Filtering happens server-side; the client never
 * queries the collection directly. `contains` performs a normalized
 * digit-prefix/contains match against searchNumber (digits only).
 */
export async function searchAvailableNumbers(options: {
  q?: string;
  countryCode?: string;
  type?: NumberType;
  capability?: NumberCapability;
  maxPrice?: number;
  limit?: number;
  cursor?: string;
}): Promise<SearchNumbersResult> {
  const limit = Math.min(Math.max(options.limit ?? 24, 1), 50);

  // Expire stale reservations lazily on every search — no timers needed.
  await expireStaleReservations();

  const q = (options.q ?? "").replace(/\D/g, ""); // digits-only matching
  const filters: Array<[string, unknown]> = [];
  if (options.countryCode) filters.push(["countryCode", options.countryCode.toUpperCase()]);
  if (options.type) filters.push(["type", options.type]);
  if (options.capability) filters.push(["capabilities", options.capability]);
  if (options.maxPrice !== undefined) filters.push(["monthlyPrice", options.maxPrice]);

  let query = getAdminDb().collection("numbers").limit(limit * 4);
  for (const [field, value] of filters) {
    query = field === "capabilities"
      ? query.where(field, "array-contains", value)
      : query.where(field, "==", value);
  }
  query = query.orderBy("monthlyPrice", "asc");
  if (options.cursor) {
    const cursorDoc = await getAdminDb().collection("numbers").doc(options.cursor).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  const snap = await query.get();
  const numbers: PublicNumber[] = [];
  for (const doc of snap.docs) {
    const n = mapNumber(doc.id, doc.data());
    // Only available inventory is public.
    if (n.status !== "available") continue;
    if (q && !n.onenumbrNumber.replace(/\D/g, "").includes(q)) continue;
    numbers.push(toPublicNumber(n));
    if (numbers.length >= limit) break;
  }

  const hasMore = numbers.length >= limit && snap.docs.length >= limit;
  return { numbers, nextCursor: hasMore ? numbers[numbers.length - 1].id : null };
}

// ---------------------------------------------------------------------------
// Reservation lifecycle (AVAILABLE → RESERVED → …; expiry → AVAILABLE)
// ---------------------------------------------------------------------------

/** Expire reservations past their TTL (lazy, runs during search/checkout). */
export async function expireStaleReservations(): Promise<number> {
  const db = getAdminDb();
  const now = Date.now();
  const snap = await db
    .collection("numbers")
    .where("status", "==", "reserved")
    .limit(50)
    .get();

  // Filter expired ones in code — avoids a composite index on a dev dataset.
  const stale = snap.docs.filter((doc) => {
    const exp = doc.data().reservationExpiresAt;
    const ms = typeof exp === "number" ? exp : exp?.toMillis?.() ?? 0;
    return ms > 0 && ms < now;
  });
  if (stale.length === 0) return 0;
  const batch = db.batch();
  for (const doc of stale) {
    batch.update(doc.ref, {
      status: "available",
      reservedBy: null,
      reservedAt: null,
      reservationExpiresAt: null,
      updatedAt: new Date(),
    });
    const d = doc.data() as { reservedBy?: string; onenumbrNumber?: string };
    if (d.reservedBy) {
      await writeAuditLog({
        actorUid: "system",
        action: "number.reservation_expired",
        targetUid: d.reservedBy,
        metadata: { numberId: doc.id, onenumbrNumber: String(d.onenumbrNumber ?? "") },
      });
    }
  }
  await batch.commit();
  return snap.size;
}

export async function reserveNumber(input: {
  uid: string;
  numberId: string;
}): Promise<{ reservationExpiresAt: number }> {
  const db = getAdminDb();
  const ref = db.collection("numbers").doc(input.numberId);
  const expiresAt = Date.now() + RESERVATION_TTL_MS;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw appError("not-found", "number not found");
    const n = mapNumber(snap.id, snap.data() ?? {});

    const effectivelyAvailable =
      n.status === "available" ||
      // Re-reserving your own live reservation is idempotent.
      (n.status === "reserved" && n.reservedBy === input.uid);

    if (!effectivelyAvailable) {
      throw appError("already-exists", "number is no longer available");
    }

    const provider = getTelecomProvider();
    const reservation = await provider.reserveNumber({
      providerNumber: n.providerNumber,
      uid: input.uid,
      ttlSeconds: MOCK_TTL_SECONDS,
    });
    void reservation;

    tx.update(ref, {
      status: "reserved",
      reservedBy: input.uid,
      reservedAt: new Date(),
      reservationExpiresAt: new Date(expiresAt),
      updatedAt: new Date(),
    });
  });

  await writeAuditLog({
    actorUid: input.uid,
    action: "number.reserved",
    targetUid: input.uid,
    metadata: { numberId: input.numberId, ttlSeconds: MOCK_TTL_SECONDS },
  });

  return { reservationExpiresAt: expiresAt };
}

// ---------------------------------------------------------------------------
// Checkout → payment → provisioning → assignment (idempotent)
// ---------------------------------------------------------------------------

export interface CheckoutResult {
  order: NumberOrder;
  alreadyExists: boolean;
}

export async function checkoutNumber(input: {
  uid: string;
  numberId: string;
  idempotencyKey: string;
}): Promise<CheckoutResult> {
  if (!input.uid) throw appError("auth/unknown", "not authenticated");
  if (!input.idempotencyKey || input.idempotencyKey.length < 8) {
    throw appError("invalid-data", "missing idempotency key");
  }

  // ---- KYC gate: identity verification is REQUIRED for activation ----
  const identityState = await getIdentityStateForUser(input.uid);
  if (identityState !== "verified") {
    throw appError("permission-denied", "identity verification required");
  }

  const db = getAdminDb();

  // ---- Idempotency: reuse an existing order for the same key ----
  const existing = await db
    .collection("number_orders")
    .where("uid", "==", input.uid)
    .where("idempotencyKey", "==", input.idempotencyKey)
    .limit(1)
    .get();
  if (!existing.empty) {
    const order = mapNumberOrder(existing.docs[0].id, existing.docs[0].data());
    if (order.orderStatus === "paid" || order.orderStatus === "failed") {
      const resumed = await provisionNumberOrder(order.id, input.uid);
      return { order: resumed, alreadyExists: true };
    }
    return { order, alreadyExists: true };
  }

  // ---- Authoritative number + price (server-computed) ----
  const ref = db.collection("numbers").doc(input.numberId);
  const numberSnap = await ref.get();
  if (!numberSnap.exists) throw appError("not-found", "number not found");
  const n = mapNumber(numberSnap.id, numberSnap.data() ?? {});

  const reservationLive =
    n.status === "reserved" && n.reservedBy === input.uid &&
    (n.reservationExpiresAt ?? 0) > Date.now();
  if (!reservationLive) {
    throw appError("invalid-data", "number is not reserved for this checkout");
  }

  // ---- Create the order ----
  const now = new Date();
  const orderRef = db.collection("number_orders").doc();
  const snapshot: NumberSnapshot = {
    onenumbrNumber: n.onenumbrNumber,
    displayNumber: n.displayNumber,
    providerNumber: n.providerNumber,
    provider: n.provider,
    countryCode: n.countryCode,
    region: n.region,
    type: n.type,
    capabilities: n.capabilities,
    monthlyPrice: n.monthlyPrice,
    currency: n.currency,
  };
  const order: NumberOrder = {
    id: orderRef.id,
    uid: input.uid,
    numberId: n.id,
    numberSnapshot: snapshot,
    totalAmount: n.monthlyPrice, // first month; server-computed
    currency: n.currency,
    paymentStatus: "payment_pending",
    orderStatus: "payment_pending",
    provisioningError: null,
    provider: n.provider,
    providerOrderId: null,
    assignmentId: null,
    idempotencyKey: input.idempotencyKey,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };
  await orderRef.set({ ...order, createdAt: now, updatedAt: now });

  await writeAuditLog({
    actorUid: input.uid,
    action: "number.order_created",
    targetUid: input.uid,
    metadata: { orderId: order.id, numberId: n.id, total: order.totalAmount, currency: n.currency },
  });

  // ---- Payment via the centralized billing engine (Prompt 5) ----
  // chargeOrder is idempotent per idempotencyKey; the payment + invoice are
  // recorded once regardless of retries or double-clicks.
  const { payment } = await chargeOrder({
    uid: input.uid,
    orderType: "number",
    orderId: order.id,
    idempotencyKey: input.idempotencyKey,
    amountMinor: Math.round(order.totalAmount * 100),
    currency: n.currency,
    description: `OneNumbr Number · ${n.displayNumber}`,
  });

  if (payment.status !== "paid") {
    await orderRef.update({ paymentStatus: "failed", orderStatus: "failed", updatedAt: new Date() });
    await releaseReservationInternal(n.id, input.uid);
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
    action: "number.payment_confirmed",
    targetUid: input.uid,
    metadata: { orderId: order.id, providerPaymentId: payment.providerPaymentId },
  });

  // ---- Provisioning ----
  const provisioned = await provisionNumberOrder(order.id, input.uid);
  return { order: provisioned, alreadyExists: false };
}

async function releaseReservationInternal(numberId: string, uid: string): Promise<void> {
  const db = getAdminDb();
  await db.collection("numbers").doc(numberId).update({
    status: "available",
    reservedBy: null,
    reservedAt: null,
    reservationExpiresAt: null,
    updatedAt: new Date(),
  });
  await writeAuditLog({
    actorUid: uid,
    action: "number.reservation_expired",
    targetUid: uid,
    metadata: { numberId, reason: "checkout_failed" },
  });
}

// ---------------------------------------------------------------------------
// Provisioning (paid → provisioning → ACTIVE | failed; admin-retryable)
// ---------------------------------------------------------------------------

export async function provisionNumberOrder(orderId: string, actorUid: string): Promise<NumberOrder> {
  const db = getAdminDb();
  const orderRef = db.collection("number_orders").doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) throw appError("not-found", `order ${orderId} missing`);
  const order = mapNumberOrder(orderId, snap.data() ?? {});

  if (order.assignmentId) return order; // already provisioned (idempotent)
  if (order.paymentStatus !== "paid") {
    throw appError("invalid-data", "order is not paid");
  }

  const db2 = getAdminDb();
  const numberRef = db2.collection("numbers").doc(order.numberId);
  const numberSnap = await numberRef.get();
  const n = numberSnap.exists ? mapNumber(numberSnap.id, numberSnap.data() ?? {}) : null;
  const provider = getTelecomProvider();

  await orderRef.update({ orderStatus: "provisioning", updatedAt: new Date() });
  if (numberSnap.exists) {
    await numberRef.update({ status: "provisioning", updatedAt: new Date() });
  }
  await writeAuditLog({
    actorUid,
    action: "number.provisioning_started",
    targetUid: order.uid,
    metadata: { orderId, numberId: order.numberId },
  });
  await notify(
    order.uid,
    "number.activation_started",
    "Activating your number",
    `We're activating ${order.numberSnapshot.displayNumber} for you.`,
  );

  try {
    // 1. Purchase on the provider (mock; deterministic "fail" sandbox hook).
    const purchase = await provider.purchaseNumber({
      providerNumber: order.numberSnapshot.providerNumber,
      orderRef: order.id,
    });
    await orderRef.update({ providerOrderId: purchase.providerOrderId, updatedAt: new Date() });

    // 2. Assign on the provider.
    const assigned = await provider.assignNumber({
      providerNumber: order.numberSnapshot.providerNumber,
      uid: order.uid,
    });

    // 3. Create the assignment (history-preserving) + activate the number.
    const assignmentRef = db.collection("number_assignments").doc();
    const now = new Date();
    const assignment: NumberAssignment = {
      id: assignmentRef.id,
      uid: order.uid,
      numberId: order.numberId,
      onenumbrNumber: order.numberSnapshot.onenumbrNumber,
      displayNumber: order.numberSnapshot.displayNumber,
      status: "active",
      orderId: order.id,
      assignedAt: assigned.assignedAt,
      releasedAt: null,
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
    };

    const batch = db.batch();
    batch.set(assignmentRef, {
      ...assignment,
      assignedAt: assigned.assignedAt ? new Date(assigned.assignedAt) : now,
      createdAt: now,
      updatedAt: now,
    });
    if (numberSnap.exists) {
      batch.update(numberRef, {
        status: "active",
        uid: order.uid,
        reservedBy: null,
        reservedAt: null,
        reservationExpiresAt: null,
        updatedAt: now,
      });
    }
    batch.update(orderRef, {
      orderStatus: "active",
      assignmentId: assignmentRef.id,
      updatedAt: now,
    });
    await batch.commit();

    // ---- Global Plan (Prompt 13): the number subscription IS the plan ----
    // Started through the existing billing engine — createSubscription is the
    // single creation path (duplicate-guarded, planSnapshot-preserved); no new
    // payment flow and no automatic recurring charges (demo provider only).
    try {
      const plan = getDefaultGlobalPlan();
      await createSubscription({
        uid: order.uid,
        planId: plan.planId,
        planName: plan.name,
        description: plan.description,
        amountMinor: plan.priceMinor,
        currency: plan.currency,
        interval: plan.interval,
        source: "number",
        linkedEntityId: order.numberId,
        planVersion: plan.version,
      });
      await writeAuditLog({
        actorUid,
        action: "billing.plan_assigned",
        targetUid: order.uid,
        metadata: { planId: plan.planId, planVersion: plan.version, orderId },
      });
    } catch (planErr) {
      // Non-fatal: number activation already succeeded; plan bookkeeping can
      // be repaired (e.g. a second number for a user who already holds the
      // one plan — createSubscription's duplicate guard throws here).
      const m = planErr instanceof Error ? planErr.message : String(planErr);
      await writeAuditLog({
        actorUid,
        action: "billing.plan_assigned",
        targetUid: order.uid,
        metadata: { orderId, warning: m.slice(0, 200) },
      });
    }

    await writeAuditLog({
      actorUid,
      action: "number.assigned",
      targetUid: order.uid,
      metadata: { orderId, numberId: order.numberId, assignmentId: assignmentRef.id },
    });
    await writeAuditLog({
      actorUid,
      action: "number.provisioning_completed",
      targetUid: order.uid,
      metadata: { orderId, numberId: order.numberId },
    });
    await notify(
      order.uid,
      "number.activated",
      "Your OneNumbr number is active",
      `${order.numberSnapshot.displayNumber} is now active on your OneNumbr identity.`,
    );

    return mapNumberOrder(orderId, (await orderRef.get()).data() ?? {});
  } catch (err) {
    // Failure recovery: payment stays recorded; number returns to reserved
    // for the owner; admin can retry. Never silently cancel a paid order.
    const message = err instanceof Error ? err.message : String(err);
    await orderRef.update({
      orderStatus: "failed",
      provisioningError: message.slice(0, 500),
      updatedAt: new Date(),
    });
    if (numberSnap.exists) {
      await numberRef.update({
        status: "failed",
        updatedAt: new Date(),
      });
    }
    await writeAuditLog({
      actorUid,
      action: "number.provisioning_failed",
      targetUid: order.uid,
      metadata: { orderId, numberId: order.numberId },
    });
    await notify(
      order.uid,
      "number.activation_failed",
      "We couldn't activate your number",
      `Your payment for ${order.numberSnapshot.displayNumber} has been recorded and activation needs attention. Our team can retry it — you won't be charged again.`,
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Reads (owner-checked)
// ---------------------------------------------------------------------------

export async function getUserNumbers(uid: string): Promise<MyNumber[]> {
  const db = getAdminDb();
  const snap = await db
    .collection("number_assignments")
    .where("uid", "==", uid)
    .orderBy("assignedAt", "desc")
    .limit(50)
    .get();

  const result: MyNumber[] = [];
  for (const doc of snap.docs) {
    const a = mapAssignment(doc.id, doc.data());
    const numSnap = await db.collection("numbers").doc(a.numberId).get();
    const n = numSnap.exists ? mapNumber(numSnap.id, numSnap.data() ?? {}) : null;
    result.push({
      numberId: a.numberId,
      assignmentId: a.id,
      onenumbrNumber: a.onenumbrNumber,
      displayNumber: a.displayNumber,
      status: n?.status ?? (a.status === "released" ? "released" : "active"),
      capabilities: n?.capabilities ?? ["SMS", "VOICE"],
      monthlyPrice: n?.monthlyPrice ?? 0,
      currency: n?.currency ?? "USD",
      type: n?.type ?? "mobile",
      countryCode: n?.countryCode ?? "",
      provider: n?.provider ?? "mock-telecom",
      activatedAt: a.assignedAt,
      releasedAt: a.releasedAt,
      assignedAt: a.assignedAt,
    });
  }
  return result;
}

/** Owner-checked single number detail (uid must match the assignment). */
export async function getUserNumber(uid: string, numberId: string): Promise<MyNumber> {
  const db = getAdminDb();
  const snap = await db
    .collection("number_assignments")
    .where("uid", "==", uid)
    .where("numberId", "==", numberId)
    .limit(1)
    .get();
  if (snap.empty) throw appError("permission-denied", "not your number");
  const a = mapAssignment(snap.docs[0].id, snap.docs[0].data());
  const numSnap = await db.collection("numbers").doc(a.numberId).get();
  const n = numSnap.exists ? mapNumber(numSnap.id, numSnap.data() ?? {}) : null;
  return {
    numberId: a.numberId,
    assignmentId: a.id,
    onenumbrNumber: a.onenumbrNumber,
    displayNumber: a.displayNumber,
    status: n?.status ?? (a.status === "released" ? "released" : "active"),
    capabilities: n?.capabilities ?? ["SMS", "VOICE"],
    monthlyPrice: n?.monthlyPrice ?? 0,
    currency: n?.currency ?? "USD",
    type: n?.type ?? "mobile",
    countryCode: n?.countryCode ?? "",
    provider: n?.provider ?? "mock-telecom",
    activatedAt: a.assignedAt,
    releasedAt: a.releasedAt,
    assignedAt: a.assignedAt,
  };
}

// ---------------------------------------------------------------------------
// Release (user-initiated; assignment history preserved)
// ---------------------------------------------------------------------------

export async function releaseUserNumber(input: { uid: string; numberId: string }): Promise<void> {
  const db = getAdminDb();

  // Ownership check via the ACTIVE assignment (server-side authorization).
  const snap = await db
    .collection("number_assignments")
    .where("uid", "==", input.uid)
    .where("numberId", "==", input.numberId)
    .where("status", "==", "active")
    .limit(1)
    .get();
  if (snap.empty) throw appError("permission-denied", "not your number");
  const assignment = mapAssignment(snap.docs[0].id, snap.docs[0].data());

  const numberSnap = await db.collection("numbers").doc(input.numberId).get();
  if (!numberSnap.exists) throw appError("not-found", "number not found");
  const n = mapNumber(numberSnap.id, numberSnap.data() ?? {});
  if (n.uid !== input.uid) throw appError("permission-denied", "not your number");

  const provider = getTelecomProvider();
  await provider.releaseNumber({ providerNumber: n.providerNumber });

  const now = new Date();
  const batch = db.batch();
  batch.update(snap.docs[0].ref, {
    status: "released",
    releasedAt: now,
    updatedAt: now,
  });
  batch.update(numberSnap.ref, {
    status: "released",
    uid: null,
    updatedAt: now,
  });
  await batch.commit();

  await writeAuditLog({
    actorUid: input.uid,
    action: "number.released",
    targetUid: input.uid,
    metadata: { numberId: input.numberId, assignmentId: assignment.id },
  });
  await notify(
    input.uid,
    "number.released",
    "Number released",
    `${n.displayNumber} has been released. Your OneNumbr ID is unchanged and you can activate a new number anytime.`,
  );
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface NumberEditorInput {
  onenumbrNumber: string;
  providerNumber: string;
  countryCode: string;
  region: string;
  type: NumberType;
  capabilities: NumberCapability[];
  monthlyPrice: number;
  currency: string;
  provider: string;
  status: NumberRecord["status"];
}

export async function createInventoryNumber(
  adminUid: string,
  input: NumberEditorInput,
): Promise<NumberRecord> {
  const db = getAdminDb();
  // Uniqueness: OneNumbr number globally; provider number per provider.
  const dupApp = await db
    .collection("numbers")
    .where("onenumbrNumber", "==", input.onenumbrNumber)
    .limit(1)
    .get();
  if (!dupApp.empty) throw appError("already-exists", "OneNumbr number already exists in inventory");

  const dupProvider = await db
    .collection("numbers")
    .where("provider", "==", input.provider)
    .where("providerNumber", "==", input.providerNumber)
    .limit(1)
    .get();
  if (!dupProvider.empty) {
    throw appError("already-exists", "provider number already exists for this provider");
  }

  const ref = db.collection("numbers").doc();
  const now = new Date();
  const record: NumberRecord = {
    id: ref.id,
    onenumbrNumber: input.onenumbrNumber,
    providerNumber: input.providerNumber,
    provider: input.provider,
    countryCode: input.countryCode.toUpperCase(),
    region: input.region,
    type: input.type,
    status: input.status,
    capabilities: input.capabilities,
    monthlyPrice: input.monthlyPrice,
    currency: input.currency,
    uid: null,
    reservedBy: null,
    reservedAt: null,
    reservationExpiresAt: null,
    displayNumber: formatNumber(input.onenumbrNumber),
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  };
  await ref.set({ ...record, createdAt: now, updatedAt: now });

  await writeAuditLog({
    actorUid: adminUid,
    action: "number.order_created", // inventory creation is logged under number.*
    metadata: { numberId: ref.id, onenumbrNumber: record.onenumbrNumber, kind: "inventory_created" },
  });
  return record;
}

export async function updateInventoryNumber(
  adminUid: string,
  numberId: string,
  patch: Partial<NumberEditorInput>,
): Promise<NumberRecord> {
  const db = getAdminDb();
  const ref = db.collection("numbers").doc(numberId);
  const snap = await ref.get();
  if (!snap.exists) throw appError("not-found", "number not found");

  // Ownership/order fields are never editable through metadata updates.
  const forbidden = ["uid", "reservedBy", "reservedAt", "reservationExpiresAt"] as const;
  for (const key of forbidden) {
    if (key in patch) throw appError("permission-denied", `cannot modify ${key} directly`);
  }

  await ref.update({ ...patch, updatedAt: new Date() });
  await writeAuditLog({
    actorUid: adminUid,
    metadata: { numberId, patch: Object.keys(patch) },
    action: "number.order_created", // inventory metadata update
  });
  return mapNumber(numberId, (await ref.get()).data() ?? {});
}

export async function listAllNumbers(options: {
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ numbers: (NumberRecord & { email: string })[]; nextCursor: string | null }> {
  const db = getAdminDb();
  const limit = Math.min(options.limit ?? 50, 200);
  let query = db.collection("numbers").limit(limit);
  if (options.status) query = query.where("status", "==", options.status);
  query = query.orderBy("createdAt", "desc");
  if (options.cursor) {
    const c = await db.collection("numbers").doc(options.cursor).get();
    if (c.exists) query = query.startAfter(c);
  }
  const snap = await query.get();
  const emails = new Map<string, string>();
  await Promise.all(
    snap.docs.map(async (d) => {
      const uid = String(d.data().uid ?? "");
      if (!uid || emails.has(uid)) return;
      const u = await db.collection("users").doc(uid).get();
      emails.set(uid, String(u.data()?.email ?? ""));
    }),
  );
  const numbers = snap.docs.map((d) => ({
    ...mapNumber(d.id, d.data()),
    email: emails.get(String(d.data().uid ?? "")) ?? "",
  }));
  return { numbers, nextCursor: numbers.length >= limit ? numbers[numbers.length - 1].id : null };
}

export async function listAllNumberOrders(limit = 50): Promise<(NumberOrder & { email: string })[]> {
  const db = getAdminDb();
  const snap = await db.collection("number_orders").orderBy("createdAt", "desc").limit(limit).get();
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
    ...mapNumberOrder(d.id, d.data()),
    email: emails.get(String(d.data().uid ?? "")) ?? "",
  }));
}

export async function listAllAssignments(limit = 50): Promise<(NumberAssignment & { email: string })[]> {
  const db = getAdminDb();
  const snap = await db
    .collection("number_assignments")
    .orderBy("assignedAt", "desc")
    .limit(limit)
    .get();
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
    ...mapAssignment(d.id, d.data()),
    email: emails.get(String(d.data().uid ?? "")) ?? "",
  }));
}

/** Admin retry of a failed (but paid) number order. */
export async function adminRetryProvisioning(orderId: string, adminUid: string): Promise<NumberOrder> {
  const order = await provisionNumberOrder(orderId, adminUid);
  return order;
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

async function notify(uid: string, kind: NotificationKind, title: string, message: string) {
  await createNotification({ uid, kind, title, message });
}
