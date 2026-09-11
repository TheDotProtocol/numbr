// =============================================================================
// OneNumbr — Connectivity engine (server-side; Admin SDK; Prompt 14)
//
// The service layer UNDERNEATH communications/endpoints. It answers:
// is connectivity enabled, what does this user have, which provider supplies
// it, what capabilities/status/mechanism — never leaking provider details.
//
// Invariants enforced here:
//   - connectivity NEVER writes onenumbr_ids / number_assignments /
//     subscriptions (reads only, for honest labels + entitlements)
//   - provider selection is server-side; clients send no provider ids
//   - demo connections never claim live; mechanism changes never touch
//     identity, number or plan
// =============================================================================

import { getAdminDb } from "@/firebase/admin";
import { appError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit-server";
import { createNotification } from "@/lib/kyc-server";
import { getFeatureFlags } from "@/lib/features";
import { requireEntitlement, getPlanSubscription } from "@/lib/entitlements-server";
import { getOneNumbrIdLabel, getPrimaryNumberLabel } from "@/lib/entitlements-server";
import { listConnectivityProviders, getConnectivityProvider, listFutureConnectivityBoundaries } from "@/providers";
import { CONNECTIVITY_MECHANISMS, type ConnectivityConnection, type ConnectivityMechanism, type ConnectivityStatus } from "@/types/connectivity";
import type { ConnectivityProvider } from "@/providers/connectivity/types";
import type { NotificationKind } from "@/types/notifications";

const COLLECTION = "connectivity_connections";

// ---------------------------------------------------------------------------
// Flags / entitlement gates
// ---------------------------------------------------------------------------

export function isConnectivityEnabled(): boolean {
  return getFeatureFlags().connectivityEnabled;
}

// ---------------------------------------------------------------------------
// Reads (owner-scoped)
// ---------------------------------------------------------------------------

export async function listConnections(uid: string, limit = 20): Promise<ConnectivityConnection[]> {
  const snap = await getAdminDb()
    .collection(COLLECTION)
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ConnectivityConnection, "id">) }));
}

async function getOwnedConnection(uid: string, connectionId: string): Promise<ConnectivityConnection> {
  const ref = getAdminDb().collection(COLLECTION).doc(connectionId);
  const snap = await ref.get();
  if (!snap.exists) throw appError("not-found", "connection not found");
  const conn = { id: snap.id, ...(snap.data() as Omit<ConnectivityConnection, "id">) };
  if (conn.uid !== uid) throw appError("permission-denied", "not your connection");
  return conn;
}

// ---------------------------------------------------------------------------
// Resolver — the one server-side answer for "what connectivity does X have?"
// ---------------------------------------------------------------------------

export type ConnectivityOverview = {
  enabled: boolean;
  entitlement: { entitled: boolean; key: string; availability: string };
  /** Current region label — product shows region, never country plans. */
  region: string | null;
  connection: ConnectivityConnection | null;
  /** Mechanisms visible to this user (honest availability + notes). */
  mechanisms: { mechanism: ConnectivityMechanism; label: string; availability: string; capabilities: string[]; note: string }[];
  /** Future boundaries — documentation/ops display only. */
  future: { id: string; name: string; requirement: string }[];
  provider: { id: string; name: string; demo: boolean } | null;
  identity: { oneNumbrId: string | null; primaryNumber: string | null };
  planActive: boolean;
};

export async function resolveConnectivity(uid: string): Promise<ConnectivityOverview> {
  const flags = getFeatureFlags();
  const [connections, entitlement, planSub, oneNumbrId, primaryNumber] = await Promise.all([
    listConnections(uid, 10),
    hasConnectivityEntitlementView(uid),
    getPlanSubscription(uid),
    getOneNumbrIdLabel(uid),
    getPrimaryNumberLabel(uid),
  ]);

  const current = connections[0] ?? null;
  const provider = current ? getConnectivityProvider(current.providerId) : null;

  const mechanisms = Object.values(CONNECTIVITY_MECHANISMS)
    // Hide eSIM mechanisms when the existing connectivity flag is off.
    .filter((m) => m.mechanism !== "esim" || flags.connectivityEnabled)
    .map((m) => ({
      mechanism: m.mechanism,
      label: m.label,
      availability: m.availability,
      capabilities: m.capabilities,
      note: m.note,
    }));

  return {
    enabled: flags.connectivityEnabled,
    entitlement,
    region: current?.region ?? null,
    connection: current,
    mechanisms,
    future: listFutureConnectivityBoundaries().map((b) => ({ id: b.id, name: b.name, requirement: b.requirement })),
    provider: provider ? { id: provider.id, name: provider.name, demo: provider.demo } : null,
    identity: { oneNumbrId, primaryNumber },
    planActive: planSub ? planSub.status === "active" || planSub.status === "trialing" : primaryNumber !== null,
  };
}

async function hasConnectivityEntitlementView(uid: string) {
  const view = await import("@/lib/entitlements-server").then((m) => m.resolveUserEntitlements(uid));
  const e = view.entitlements.find((x) => x.key === "connectivity.global");
  return {
    entitled: Boolean(e?.entitled),
    key: "connectivity.global",
    availability: e?.availability ?? "coming_soon",
  };
}

// ---------------------------------------------------------------------------
// Demo cloud connection lifecycle (the one mechanism operational now)
// ---------------------------------------------------------------------------

function pickProvider(mechanism: ConnectivityMechanism): ConnectivityProvider {
  const provider = listConnectivityProviders().find((p) => p.mechanism === mechanism);
  if (!provider) {
    throw appError("invalid-data", "That connectivity mechanism isn't available in this environment yet.");
  }
  return provider;
}

export async function requestConnection(input: {
  uid: string;
  mechanism?: ConnectivityMechanism;
  region?: string | null;
}): Promise<ConnectivityConnection> {
  if (!isConnectivityEnabled()) {
    throw appError("invalid-data", "Connectivity isn't available in this environment yet.");
  }
  // Entitlement gate: the Global Plan carries connectivity (Prompt 13/14).
  await requireEntitlement(input.uid, "connectivity.global");

  const mechanism = input.mechanism ?? "cloud";
  const provider = pickProvider(mechanism); // server-side selection only

  // One active connection per user in this release (calm, replaceable).
  const existing = await listConnections(input.uid, 10);
  const live = existing.find(
    (c) => c.status === "active" || c.status === "provisioning" || c.status === "requested" || c.status === "suspended",
  );
  if (live) throw appError("already-exists", "You already have an active connectivity connection.");

  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc();
  const now = Date.now();
  const conn: ConnectivityConnection = {
    id: ref.id,
    uid: input.uid,
    oneNumbrIdLabel: null,
    numberId: null,
    endpointId: null,
    mechanism,
    providerId: provider.id,
    status: "requested",
    environment: "demo",
    region: input.region ?? null,
    capabilities: provider.capabilities,
    refs: { providerReference: null, simReference: null, subscriberReference: null },
    note: CONNECTIVITY_MECHANISMS[mechanism].note,
    failureReason: null,
    createdAt: now,
    activatedAt: null,
    suspendedAt: null,
    terminatedAt: null,
    updatedAt: now,
  };
  await ref.set(conn);

  await writeAuditLog({
    actorUid: input.uid,
    action: "connectivity.requested",
    targetUid: input.uid,
    metadata: { connectionId: ref.id, mechanism, providerId: provider.id },
  });
  await writeAuditLog({
    actorUid: input.uid,
    action: "connectivity.provider_selected",
    targetUid: input.uid,
    metadata: { connectionId: ref.id, providerId: provider.id },
  });

  return conn;
}

export async function activateConnection(input: { uid: string; connectionId: string }): Promise<ConnectivityConnection> {
  await requireEntitlement(input.uid, "connectivity.global");
  const conn = await getOwnedConnection(input.uid, input.connectionId);
  if (conn.status !== "requested" && conn.status !== "suspended") {
    throw appError("invalid-data", "This connection can't be activated right now.");
  }
  const provider = getConnectivityProvider(conn.providerId);
  if (!provider) throw appError("server", "connectivity provider missing");

  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(conn.id);

  if (conn.status === "requested") {
    await ref.update({ status: "provisioning" as ConnectivityStatus, updatedAt: new Date() });
    await writeAuditLog({
      actorUid: input.uid,
      action: "connectivity.provisioning_started",
      targetUid: input.uid,
      metadata: { connectionId: conn.id },
    });
    const result = await provider.provision({ uid: input.uid, connectionId: conn.id, region: conn.region });
    await ref.update({
      status: result.status,
      "refs.providerReference": result.providerReference,
      updatedAt: new Date(),
    });
    const activated = await provider.activate({ connectionId: conn.id, providerReference: result.providerReference });
    const now = Date.now();
    await ref.update({
      status: activated.status,
      "refs.providerReference": activated.providerReference ?? result.providerReference,
      activatedAt: now,
      updatedAt: new Date(),
    });
    await writeAuditLog({
      actorUid: input.uid,
      action: "connectivity.activated",
      targetUid: input.uid,
      metadata: { connectionId: conn.id, providerId: provider.id },
    });
    await createNotification({
      uid: input.uid,
      kind: "connectivity.ready" as NotificationKind,
      title: "Your connectivity is ready",
      message: "Global connectivity is active underneath your OneNumbr (demo environment).",
    });
  } else {
    // suspended → resume
    const result = await provider.resume({ connectionId: conn.id, providerReference: conn.refs.providerReference });
    await ref.update({ status: result.status, updatedAt: new Date() });
    await writeAuditLog({
      actorUid: input.uid,
      action: "connectivity.resumed",
      targetUid: input.uid,
      metadata: { connectionId: conn.id },
    });
  }

  return { id: conn.id, ...(await ref.get()).data() } as ConnectivityConnection;
}

export async function suspendConnection(input: { uid: string; connectionId: string }): Promise<ConnectivityConnection> {
  await requireEntitlement(input.uid, "connectivity.global");
  const conn = await getOwnedConnection(input.uid, input.connectionId);
  if (conn.status !== "active") throw appError("invalid-data", "Only an active connection can be suspended.");
  const provider = getConnectivityProvider(conn.providerId);
  if (!provider) throw appError("server", "connectivity provider missing");
  const result = await provider.suspend({ connectionId: conn.id, providerReference: conn.refs.providerReference });
  const ref = getAdminDb().collection(COLLECTION).doc(conn.id);
  await ref.update({ status: result.status, suspendedAt: Date.now(), updatedAt: new Date() });
  await writeAuditLog({
    actorUid: input.uid,
    action: "connectivity.suspended",
    targetUid: input.uid,
    metadata: { connectionId: conn.id },
  });
  return { id: conn.id, ...(await ref.get()).data() } as ConnectivityConnection;
}

export async function terminateConnection(input: { uid: string; connectionId: string }): Promise<ConnectivityConnection> {
  await requireEntitlement(input.uid, "connectivity.global");
  const conn = await getOwnedConnection(input.uid, input.connectionId);
  if (conn.status === "terminated") throw appError("invalid-data", "This connection is already terminated.");
  const provider = getConnectivityProvider(conn.providerId);
  if (!provider) throw appError("server", "connectivity provider missing");
  const result = await provider.terminate({ connectionId: conn.id, providerReference: conn.refs.providerReference });
  const ref = getAdminDb().collection(COLLECTION).doc(conn.id);
  await ref.update({ status: result.status, terminatedAt: Date.now(), updatedAt: new Date() });
  await writeAuditLog({
    actorUid: input.uid,
    action: "connectivity.terminated",
    targetUid: input.uid,
    metadata: { connectionId: conn.id },
  });
  return { id: conn.id, ...(await ref.get()).data() } as ConnectivityConnection;
}
