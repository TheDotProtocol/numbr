// =============================================================================
// OneNumbr — Operations engine (server-side; Admin SDK; Prompt 7)
//
// Deterministic operational monitoring only — no fake anomaly detection.
//
// Sources of truth (read, never duplicated):
//   - esim_orders   (provisioning failures)
//   - number_orders (provisioning failures)
//   - payments      (failures, refunds)
//   - kyc           (pending review backlog)
//   - support_tickets (queue depth, urgent work)
//
// Every query is bounded (limit + status filters + time window) to stay
// Firebase free-tier friendly. Alert rows are cached in operational_alerts
// so the dashboard can read one document instead of re-fanning-out.
// =============================================================================

import { getAdminDb } from "@/firebase/admin";
import { writeAuditLog } from "@/lib/audit-server";
import { countOpenTickets } from "@/lib/support-server";
import type { OpsAlertKind, OpsAlertSeverity } from "@/types/support";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function toMillis(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toMillis" in v) return (v as { toMillis(): number }).toMillis();
  return 0;
}

// ---------------------------------------------------------------------------
// Targeted failure queries (bounded)
// ---------------------------------------------------------------------------

export type FailedOrderRow = {
  id: string;
  uid: string;
  ref: string; // order number / orderRef
  reason: string | null;
  createdAt: number;
};

export async function findFailedEsimOrders(limit = 10): Promise<FailedOrderRow[]> {
  const snap = await getAdminDb()
    .collection("esim_orders")
    .where("status", "==", "failed")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    uid: String(d.data().uid ?? ""),
    ref: String(d.data().orderRef ?? d.id),
    reason: d.data().provisioningError ? String(d.data().provisioningError) : null,
    createdAt: toMillis(d.data().createdAt),
  }));
}

export async function findFailedNumberOrders(limit = 10): Promise<FailedOrderRow[]> {
  const snap = await getAdminDb()
    .collection("number_orders")
    .where("orderStatus", "==", "failed")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    uid: String(d.data().uid ?? ""),
    ref: String(d.data().orderNumber ?? d.id),
    reason: d.data().provisioningError ? String(d.data().provisioningError) : null,
    createdAt: toMillis(d.data().createdAt),
  }));
}

export async function findFailedPayments(limit = 10): Promise<FailedOrderRow[]> {
  const snap = await getAdminDb()
    .collection("payments")
    .where("status", "==", "failed")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    uid: String(d.data().uid ?? ""),
    ref: String(d.data().providerPaymentId ?? d.id),
    reason: null,
    createdAt: toMillis(d.data().createdAt),
  }));
}

// ---------------------------------------------------------------------------
// Deterministic alert evaluation
// ---------------------------------------------------------------------------

export type OpsAlert = {
  kind: OpsAlertKind;
  severity: OpsAlertSeverity;
  count: number;
  message: string;
  needsAttention: boolean;
};

const ALERT_WINDOW_DAYS = 14;

export async function evaluateAlerts(): Promise<OpsAlert[]> {
  const db = getAdminDb();
  const since = new Date(Date.now() - ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const alerts: OpsAlert[] = [];

  // Failures within the window (bounded reads; counts are window counts).
  const [esimFail, numberFail, payFail] = await Promise.all([
    db.collection("esim_orders").where("status", "==", "failed").orderBy("createdAt", "desc").limit(100).get(),
    db.collection("number_orders").where("orderStatus", "==", "failed").orderBy("createdAt", "desc").limit(100).get(),
    db.collection("payments").where("status", "==", "failed").orderBy("createdAt", "desc").limit(100).get(),
  ]);
  const inWindow = (snap: FirebaseFirestore.QuerySnapshot) =>
    snap.docs.filter((d) => toMillis(d.data().createdAt) >= since.getTime()).length;

  const esimCount = inWindow(esimFail);
  const numberCount = inWindow(numberFail);
  const payCount = inWindow(payFail);

  alerts.push({
    kind: "esim_provisioning_failures",
    severity: esimCount >= 5 ? "critical" : esimCount >= 1 ? "warning" : "info",
    count: esimCount,
    message:
      esimCount === 0
        ? "No eSIM provisioning failures in the last 14 days."
        : `${esimCount} eSIM provisioning failure${esimCount === 1 ? "" : "s"} in the last 14 days. Retry is available from the eSIM admin console.`,
    needsAttention: esimCount > 0,
  });
  alerts.push({
    kind: "number_provisioning_failures",
    severity: numberCount >= 5 ? "critical" : numberCount >= 1 ? "warning" : "info",
    count: numberCount,
    message:
      numberCount === 0
        ? "No number activation failures in the last 14 days."
        : `${numberCount} number activation failure${numberCount === 1 ? "" : "s"} in the last 14 days. Retry is available from the Numbers admin console.`,
    needsAttention: numberCount > 0,
  });
  alerts.push({
    kind: "payment_failures",
    severity: payCount >= 5 ? "critical" : payCount >= 1 ? "warning" : "info",
    count: payCount,
    message:
      payCount === 0
        ? "No payment failures in the last 14 days."
        : `${payCount} failed payment${payCount === 1 ? "" : "s"} in the last 14 days. Customers can retry from checkout; payments remain recorded.`,
    needsAttention: payCount > 0,
  });

  // KYC backlog: cases waiting for review.
  const kycPending = await db.collection("kyc").where("status", "==", "submitted").limit(200).get();
  alerts.push({
    kind: "kyc_backlog",
    severity: kycPending.size >= 20 ? "critical" : kycPending.size >= 5 ? "warning" : "info",
    count: kycPending.size,
    message:
      kycPending.size === 0
        ? "No identity verifications waiting for review."
        : `${kycPending.size} identity verification${kycPending.size === 1 ? "" : "s"} waiting for review.`,
    needsAttention: kycPending.size > 0,
  });

  // Support queue depth + urgent tickets.
  const openTickets = await countOpenTickets();
  const urgent = await getAdminDb()
    .collection("support_tickets")
    .where("priority", "==", "urgent")
    .where("status", "in", ["open", "in_progress", "waiting_for_provider"])
    .limit(100)
    .get();

  alerts.push({
    kind: "support_backlog",
    severity: openTickets >= 30 ? "critical" : openTickets >= 10 ? "warning" : openTickets > 0 ? "warning" : "info",
    count: openTickets,
    message:
      openTickets === 0
        ? "No open support cases."
        : `${openTickets} open support case${openTickets === 1 ? "" : "s"}.`,
    needsAttention: openTickets > 0,
  });
  alerts.push({
    kind: "urgent_tickets",
    severity: urgent.size > 0 ? "critical" : "info",
    count: urgent.size,
    message:
      urgent.size === 0
        ? "No urgent support cases."
        : `${urgent.size} urgent support case${urgent.size === 1 ? "" : "s"} need${urgent.size === 1 ? "s" : ""} attention.`,
    needsAttention: urgent.size > 0,
  });

  return alerts;
}

/** Persist the latest alert snapshot (read model for the dashboard). */
export async function refreshOpsSnapshot(): Promise<{ alerts: OpsAlert[]; generatedAt: number }> {
  const alerts = await evaluateAlerts();
  const generatedAt = Date.now();
  await getAdminDb()
    .collection("operational_alerts")
    .doc("current")
    .set({ alerts, generatedAt: new Date(generatedAt) });
  await writeAuditLog({
    actorUid: "system",
    action: "operations.snapshot_refreshed",
    targetUid: null,
    metadata: { alerts: alerts.filter((a) => a.needsAttention).length },
  });
  return { alerts, generatedAt };
}

// ---------------------------------------------------------------------------
// Operations snapshot (dashboard payload)
// ---------------------------------------------------------------------------

export type OpsSnapshot = {
  alerts: OpsAlert[];
  needsAttention: OpsAlert[];
  counts: {
    openTickets: number;
    urgentTickets: number;
    kycPending: number;
    failedEsimOrders: number;
    failedNumberOrders: number;
    failedPayments: number;
  };
  recent: {
    failedEsimOrders: FailedOrderRow[];
    failedNumberOrders: FailedOrderRow[];
    failedPayments: FailedOrderRow[];
  };
  generatedAt: number;
};

export async function getOpsSnapshot(): Promise<OpsSnapshot> {
  const alerts = await evaluateAlerts();
  const [esim, number, payments] = await Promise.all([
    findFailedEsimOrders(8),
    findFailedNumberOrders(8),
    findFailedPayments(8),
  ]);

  const byKind = (k: OpsAlertKind) => alerts.find((a) => a.kind === k);
  return {
    alerts,
    needsAttention: alerts.filter((a) => a.needsAttention),
    counts: {
      openTickets: byKind("support_backlog")?.count ?? 0,
      urgentTickets: byKind("urgent_tickets")?.count ?? 0,
      kycPending: byKind("kyc_backlog")?.count ?? 0,
      failedEsimOrders: byKind("esim_provisioning_failures")?.count ?? 0,
      failedNumberOrders: byKind("number_provisioning_failures")?.count ?? 0,
      failedPayments: byKind("payment_failures")?.count ?? 0,
    },
    recent: {
      failedEsimOrders: esim,
      failedNumberOrders: number,
      failedPayments: payments,
    },
    generatedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Customer 360 — unified profile for support staff (bounded reads)
// ---------------------------------------------------------------------------

export type Customer360 = {
  uid: string;
  identity: {
    email: string;
    fullName: string;
    country: string;
    onenumbrId: string | null;
    kycState: string;
    accountStatus: string;
    role: string;
    createdAt: number | null;
  };
  number: {
    active: { id: string; onenumbrNumber: string; status: string }[];
    orders: { id: string; orderNumber: string; status: string; createdAt: number }[];
  };
  connectivity: {
    esims: { id: string; label: string; status: string; planName: string }[];
    orders: { id: string; orderRef: string; status: string; createdAt: number }[];
    /** Connectivity service layer (Prompt 14) — current connection metadata. */
    connection: { mechanism: string; status: string; providerId: string; environment: string } | null;
  };
  billing: {
    recentPayments: { id: string; amount: number; currency: string; status: string; createdAt: number; description: string }[];
    invoices: { id: string; invoiceNumber: string; total: number; currency: string; status: string }[];
    refunds: { id: string; paymentId: string; amount: number; currency: string; createdAt: number }[];
    subscriptions: { id: string; planName: string; status: string; nextBillingDate: number | null }[];
  };
  security: {
    currentDevice: string | null;
    activeSessions: number;
    recentSecurityActivity: { title: string; createdAt: number }[];
  };
  support: {
    openTickets: { id: string; ticketNumber: string; subject: string; status: string; priority: string }[];
    recentTickets: { id: string; ticketNumber: string; subject: string; status: string; updatedAt: number }[];
  };
  communications: {
    primaryNumber: string | null;
    calls: { id: string; direction: string; status: string; createdAt: number }[];
    messages: { id: string; direction: string; status: string; createdAt: number }[];
    voicemails: { id: string; caller: string; status: string; createdAt: number }[];
    endpoints: { id: string; name: string; type: string; status: string; isPrimary: boolean; lastActiveAt: number | null }[];
  };
  plan: {
    status: string;
    name: string;
    planId: string | null;
    planVersion: string | null;
    amountMinor: number | null;
    currency: string | null;
    interval: string | null;
    currentPeriodEnd: number | null;
    provider: string | null;
  };
  providerReadiness: {
    providers: {
      id: string;
      name: string;
      category: string;
      environment: string;
      availability: string;
      configState: string;
      note: string;
    }[];
    summary: {
      available: number;
      demo: number;
      disabled: number;
      configured: number;
      note: string;
    };
  };
  timeline: TimelineEntry[];
};

export type TimelineEntry = {
  at: number;
  source: "kyc" | "number" | "esim" | "billing" | "account" | "security" | "support" | "communications";
  title: string;
  detail?: string;
};

/**
 * Unified customer timeline — aggregates existing event sources with bounded
 * per-source queries. Audit data is not duplicated; support tickets come from
 * the ticket collection, security events from login_events, the rest from
 * their native collections' status/createdAt fields.
 */
async function buildTimeline(uid: string): Promise<TimelineEntry[]> {
  const db = getAdminDb();
  const entries: TimelineEntry[] = [];

  const [kycSnap, numSnap, numOrderSnap, esimSnap, esimOrderSnap, paySnap, invoiceSnap, ticketSnap, loginSnap, endpointSnap, callSnap] =
    await Promise.all([
      db.collection("kyc").doc(uid).get(),
      db.collection("number_assignments").where("uid", "==", uid).orderBy("createdAt", "desc").limit(6).get(),
      db.collection("number_orders").where("uid", "==", uid).orderBy("createdAt", "desc").limit(6).get(),
      db.collection("esims").where("uid", "==", uid).orderBy("createdAt", "desc").limit(6).get(),
      db.collection("esim_orders").where("uid", "==", uid).orderBy("createdAt", "desc").limit(6).get(),
      db.collection("payments").where("uid", "==", uid).orderBy("createdAt", "desc").limit(6).get(),
      db.collection("invoices").where("uid", "==", uid).orderBy("createdAt", "desc").limit(6).get(),
      db.collection("support_tickets").where("uid", "==", uid).orderBy("createdAt", "desc").limit(6).get(),
      db.collection("login_events").where("uid", "==", uid).orderBy("createdAt", "desc").limit(6).get(),
      db.collection("communication_endpoints").where("uid", "==", uid).orderBy("createdAt", "desc").limit(6).get(),
      db.collection("calls").where("uid", "==", uid).orderBy("createdAt", "desc").limit(6).get(),
    ]);

  if (kycSnap.exists) {
    const status = String(kycSnap.data()?.status ?? "");
    const reviewedAt = toMillis(kycSnap.data()?.reviewedAt);
    const submittedAt = toMillis(kycSnap.data()?.submittedAt);
    if (status === "approved" && reviewedAt) entries.push({ at: reviewedAt, source: "kyc", title: "Identity verification approved" });
    else if (status === "rejected" && reviewedAt) entries.push({ at: reviewedAt, source: "kyc", title: "Identity verification rejected", detail: String(kycSnap.data()?.rejectionReason ?? "") });
    else if (submittedAt) entries.push({ at: submittedAt, source: "kyc", title: "Identity documents submitted" });
  }
  numSnap.forEach((d) => {
    const data = d.data();
    const assignedAt = toMillis(data.assignedAt);
    if (assignedAt) entries.push({ at: assignedAt, source: "number", title: `Number assigned`, detail: String(data.onenumbrNumber ?? "") });
    const releasedAt = toMillis(data.releasedAt);
    if (releasedAt) entries.push({ at: releasedAt, source: "number", title: `Number released`, detail: String(data.onenumbrNumber ?? "") });
  });
  numOrderSnap.forEach((d) => {
    const data = d.data();
    entries.push({
      at: toMillis(data.createdAt),
      source: "number",
      title: `Number order ${String(data.orderStatus ?? "")}`,
      detail: String(data.orderNumber ?? d.id),
    });
  });
  esimSnap.forEach((d) => {
    const data = d.data();
    const activatedAt = toMillis(data.activatedAt);
    if (activatedAt) entries.push({ at: activatedAt, source: "esim", title: `eSIM activated`, detail: String(data.planName ?? data.label ?? "") });
  });
  esimOrderSnap.forEach((d) => {
    const data = d.data();
    entries.push({
      at: toMillis(data.createdAt),
      source: "esim",
      title: `eSIM order ${String(data.status ?? "")}`,
      detail: String(data.orderRef ?? d.id),
    });
  });
  paySnap.forEach((d) => {
    const data = d.data();
    entries.push({
      at: toMillis(data.createdAt),
      source: "billing",
      title: `Payment ${String(data.status ?? "")}`,
      detail: `${formatMinor(Number(data.amount ?? 0), String(data.currency ?? "USD"))} — ${String(data.description ?? "")}`,
    });
  });
  invoiceSnap.forEach((d) => {
    const data = d.data();
    entries.push({
      at: toMillis(data.createdAt),
      source: "billing",
      title: `Invoice ${String(data.invoiceNumber ?? "")} ${String(data.status ?? "")}`,
    });
  });
  ticketSnap.forEach((d) => {
    const data = d.data();
    entries.push({
      at: toMillis(data.createdAt),
      source: "support",
      title: `Support case opened`,
      detail: `${String(data.ticketNumber ?? "")} — ${String(data.subject ?? "")}`,
    });
  });
  loginSnap.forEach((d) => {
    const data = d.data();
    entries.push({ at: toMillis(data.createdAt), source: "security", title: String(data.title ?? "Security event") });
  });
  endpointSnap.forEach((d) => {
    const data = d.data();
    entries.push({
      at: toMillis(data.createdAt),
      source: "communications",
      title: `Endpoint connected: ${String(data.name ?? "Endpoint")}`,
      detail: String(data.type ?? "").replaceAll("_", " "),
    });
  });
  callSnap.forEach((d) => {
    const data = d.data();
    entries.push({
      at: toMillis(data.createdAt),
      source: "communications",
      title: `Demo call ${String(data.direction ?? "outbound")}`,
      detail: `Status: ${String(data.status ?? "")} (demo provider)`,
    });
  });

  return entries.sort((a, b) => b.at - a.at).slice(0, 30);
}

function formatMinor(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

/** Build the full Customer 360 with per-collection bounded queries. */
export async function getCustomer360(uid: string): Promise<Customer360> {
  const db = getAdminDb();

  const [userSnap, profileSnap, idSnap, kycSnap] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("profiles").doc(uid).get(),
    db.collection("onenumbr_ids").doc(uid).get(),
    db.collection("kyc").doc(uid).get(),
  ]);

  const [activeNum, numOrders, esims, esimOrders, payments, invoices, subs, tickets, sessions, devices, loginEvents, calls, messages, voicemails, endpoints, planSubs, cxConnections] =
    await Promise.all([
      db.collection("number_assignments").where("uid", "==", uid).where("status", "==", "active").limit(5).get(),
      db.collection("number_orders").where("uid", "==", uid).orderBy("createdAt", "desc").limit(5).get(),
      db.collection("esims").where("uid", "==", uid).orderBy("createdAt", "desc").limit(5).get(),
      db.collection("esim_orders").where("uid", "==", uid).orderBy("createdAt", "desc").limit(5).get(),
      db.collection("payments").where("uid", "==", uid).orderBy("createdAt", "desc").limit(5).get(),
      db.collection("invoices").where("uid", "==", uid).orderBy("createdAt", "desc").limit(5).get(),
      db.collection("subscriptions").where("uid", "==", uid).orderBy("createdAt", "desc").limit(5).get(),
      db.collection("support_tickets").where("uid", "==", uid).orderBy("lastMessageAt", "desc").limit(10).get(),
      db.collection("sessions").where("uid", "==", uid).where("revokedAt", "==", null).limit(20).get(),
      db.collection("devices").where("uid", "==", uid).orderBy("lastSeenAt", "desc").limit(3).get(),
      db.collection("login_events").where("uid", "==", uid).orderBy("createdAt", "desc").limit(6).get(),
      db.collection("calls").where("uid", "==", uid).orderBy("createdAt", "desc").limit(5).get(),
      db.collection("messages").where("uid", "==", uid).orderBy("createdAt", "desc").limit(5).get(),
      db.collection("voicemails").where("uid", "==", uid).orderBy("createdAt", "desc").limit(5).get(),
      db.collection("communication_endpoints").where("uid", "==", uid).orderBy("createdAt", "desc").limit(8).get(),
      db.collection("subscriptions").where("uid", "==", uid).where("source", "==", "number").limit(5).get(),
      db.collection("connectivity_connections").where("uid", "==", uid).orderBy("createdAt", "desc").limit(1).get(),
    ]);

  const now = Date.now();
  const liveSessions = sessions.docs.filter((d) => {
    const exp = toMillis(d.data().expiresAt);
    return exp === null || exp > now;
  });

  const openStatuses = ["open", "in_progress", "waiting_for_customer", "waiting_for_provider"];
  const allTickets = tickets.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }));
  const openTickets = allTickets.filter((t) => openStatuses.includes(String(t.status))).slice(0, 5);
  const recentTickets = allTickets.slice(0, 5);

  const timeline = await buildTimeline(uid);

  return {
    uid,
    identity: {
      email: String(userSnap.data()?.email ?? ""),
      fullName: String(profileSnap.data()?.fullName ?? ""),
      country: String(profileSnap.data()?.country ?? ""),
      onenumbrId: idSnap.exists ? String(idSnap.data()?.onenumbr ?? "") : null,
      kycState: kycSnap.exists ? String(kycSnap.data()?.status ?? "not_started") : "not_started",
      accountStatus: String(userSnap.data()?.status ?? "active"),
      role: String(userSnap.data()?.role ?? "user"),
      createdAt: toMillis(userSnap.data()?.createdAt) || null,
    },
    number: {
      active: activeNum.docs.map((d) => ({
        id: d.id,
        onenumbrNumber: String(d.data().onenumbrNumber ?? ""),
        status: String(d.data().status ?? ""),
      })),
      orders: numOrders.docs.map((d) => ({
        id: d.id,
        orderNumber: String(d.data().orderNumber ?? d.id),
        status: String(d.data().orderStatus ?? ""),
        createdAt: toMillis(d.data().createdAt),
      })),
    },
    connectivity: {
      esims: esims.docs.map((d) => ({
        id: d.id,
        label: String(d.data().label ?? d.data().planName ?? "eSIM"),
        status: String(d.data().status ?? ""),
        planName: String(d.data().planName ?? ""),
      })),
      orders: esimOrders.docs.map((d) => ({
        id: d.id,
        orderRef: String(d.data().orderRef ?? d.id),
        status: String(d.data().status ?? ""),
        createdAt: toMillis(d.data().createdAt),
      })),
      connection: (() => {
        const doc = cxConnections.docs[0];
        if (!doc) return null;
        const data = doc.data();
        return {
          mechanism: String(data.mechanism ?? ""),
          status: String(data.status ?? ""),
          providerId: String(data.providerId ?? ""),
          environment: String(data.environment ?? "demo"),
        };
      })(),
    },
    billing: {
      recentPayments: payments.docs.map((d) => ({
        id: d.id,
        amount: Number(d.data().amount ?? 0),
        currency: String(d.data().currency ?? "USD"),
        status: String(d.data().status ?? ""),
        createdAt: toMillis(d.data().createdAt),
        description: String(d.data().description ?? ""),
      })),
      invoices: invoices.docs.map((d) => ({
        id: d.id,
        invoiceNumber: String(d.data().invoiceNumber ?? ""),
        total: Number(d.data().total ?? 0),
        currency: String(d.data().currency ?? "USD"),
        status: String(d.data().status ?? ""),
      })),
      refunds: payments.docs
        .filter((d) => ["refunded", "partially_refunded"].includes(String(d.data().status ?? "")))
        .map((d) => ({
          id: d.id,
          paymentId: d.id,
          amount: Number(d.data().refundedAmount ?? d.data().amount ?? 0),
          currency: String(d.data().currency ?? "USD"),
          createdAt: toMillis(d.data().updatedAt),
        })),
      subscriptions: subs.docs.map((d) => ({
        id: d.id,
        planName: String(d.data()?.planSnapshot?.name ?? d.data().planId ?? "Plan"),
        status: String(d.data().status ?? ""),
        nextBillingDate: d.data().nextBillingDate ? toMillis(d.data().nextBillingDate) : null,
      })),
    },
    security: {
      currentDevice: devices.empty ? null : String(devices.docs[0].data().deviceName ?? devices.docs[0].data().platform ?? "Unknown device"),
      activeSessions: liveSessions.length,
      recentSecurityActivity: loginEvents.docs.map((d) => ({
        title: String(d.data().title ?? "Security event"),
        createdAt: toMillis(d.data().createdAt),
      })),
    },
    support: {
      openTickets: openTickets.map((t) => ({
        id: t.id,
        ticketNumber: String(t.ticketNumber ?? ""),
        subject: String(t.subject ?? ""),
        status: String(t.status ?? ""),
        priority: String(t.priority ?? "normal"),
      })),
      recentTickets: recentTickets.map((t) => ({
        id: t.id,
        ticketNumber: String(t.ticketNumber ?? ""),
        subject: String(t.subject ?? ""),
        status: String(t.status ?? ""),
        updatedAt: toMillis(t.lastMessageAt ?? t.updatedAt ?? t.createdAt),
      })),
    },
    communications: {
      // Operational metadata only — message bodies and call participants are not
      // projected into the admin view.
      primaryNumber:
        activeNum.docs[0] !== undefined ? String(activeNum.docs[0].data().onenumbrNumber ?? "") || null : null,
      calls: calls.docs.map((d) => ({
        id: d.id,
        direction: String(d.data().direction ?? ""),
        status: String(d.data().status ?? ""),
        createdAt: toMillis(d.data().createdAt),
      })),
      messages: messages.docs.map((d) => ({
        id: d.id,
        direction: String(d.data().direction ?? ""),
        status: String(d.data().status ?? ""),
        createdAt: toMillis(d.data().createdAt),
      })),
      voicemails: voicemails.docs.map((d) => ({
        id: d.id,
        caller: String(d.data().callerLabel ?? d.data().fromLabel ?? "Unknown caller"),
        status: String(d.data().status ?? ""),
        createdAt: toMillis(d.data().createdAt),
      })),
      endpoints: endpoints.docs.map((d) => ({
        id: d.id,
        name: String(d.data().name ?? "Endpoint"),
        type: String(d.data().type ?? ""),
        status: String(d.data().status ?? ""),
        isPrimary: Boolean(d.data().isPrimary),
        lastActiveAt: toMillis(d.data().lastActiveAt) ?? null,
      })),
    },
    plan: (() => {
      const latest = planSubs.docs
        .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
        .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))[0];
      if (!latest) {
        // Legacy bridge: number without subscription still carries the plan.
        return {
          status: activeNum.empty ? "none" : "active",
          name: "OneNumbr Global Plan",
          planId: null,
          planVersion: null,
          amountMinor: null,
          currency: null,
          interval: null,
          currentPeriodEnd: null,
          provider: null,
        };
      }
      const snapshot = (latest.planSnapshot ?? {}) as Record<string, unknown>;
      return {
        status: String(latest.status ?? "none"),
        name: String(snapshot.planName ?? "OneNumbr Global Plan"),
        planId: latest.planId ? String(latest.planId) : null,
        planVersion: latest.planVersion ? String(latest.planVersion) : null,
        amountMinor: snapshot.amountMinor !== undefined ? Number(snapshot.amountMinor) : null,
        currency: snapshot.currency !== undefined ? String(snapshot.currency) : null,
        interval: snapshot.interval !== undefined ? String(snapshot.interval) : null,
        currentPeriodEnd: toMillis(latest.currentPeriodEnd) ?? null,
        provider: latest.provider ? String(latest.provider) : null,
      };
    })(),
    providerReadiness: await getProviderReadinessFor360(),
    timeline,
  };
}

// ---------------------------------------------------------------------------
// Provider readiness for Customer 360 / admin (Prompt 15)
// ---------------------------------------------------------------------------

import { listProviderMetadata, providerAvailability, providerConfigState, providerHealthSummary } from "@/lib/provider-registry";

async function getProviderReadinessFor360() {
  const providers = listProviderMetadata();
  const summary = providerHealthSummary();
  return {
    providers: providers.map((p) => ({
      id: p.id,
      name: p.displayName,
      category: p.category,
      environment: p.environment,
      availability: providerAvailability(p),
      configState: providerConfigState(p),
      note: p.note,
    })),
    summary,
  };
}
