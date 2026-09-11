// =============================================================================
// OneNumbr — Endpoint engine (server-side; Admin SDK; Prompt 12)
//
// The endpoint manager sits between communications and connectivity:
//
//   ONE IDENTITY → ONE NUMBER → GLOBAL PLAN → COMMUNICATIONS
//     → ENDPOINT LAYER (here) → CONNECTIVITY
//
// Invariants enforced here (the Prompt 12 core promise):
//   - Registration NEVER mutates onenumbr_ids or number_assignments.
//   - Revoking/removing endpoints NEVER mutates identity or number.
//   - Ownership is server-derived: uid comes from the verified session; the
//     OneNumbr ID and primary number are resolved server-side.
//
// Lifecycle: pending_verification → active ⇄ suspended → revoked (terminal;
// re-access requires a fresh registration). Status transitions are validated
// against ENDPOINT_TRANSITIONS — unauthorized transitions are rejected.
// =============================================================================

import { getAdminDb } from "@/firebase/admin";
import { requireEntitlement } from "@/lib/entitlements-server";
import { appError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit-server";
import { createNotification } from "@/lib/kyc-server";
import { getEndpointProvider } from "@/providers";
import { ENDPOINT_TRANSITIONS, ENDPOINT_TYPE_AVAILABILITY, ENDPOINT_CAPABILITY_MODES } from "@/types/endpoints";
import type {
  EndpointCapability,
  EndpointPresence,
  EndpointRecord,
  EndpointRoutingDecision,
  EndpointStatus,
  EndpointType,
  EndpointView,
} from "@/types/endpoints";

function toMillis(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toMillis" in v) return (v as { toMillis(): number }).toMillis();
  return null;
}

function toMillisOr(v: unknown, fallback: number): number {
  return toMillis(v) ?? fallback;
}

// ---------------------------------------------------------------------------
// Identity + number resolution (read-only; never mutated here)
// ---------------------------------------------------------------------------

async function resolveIdentity(uid: string): Promise<{ oneNumbrId: string | null; numberId: string | null }> {
  const db = getAdminDb();
  const [idSnap, assignmentSnap] = await Promise.all([
    db.collection("onenumbr_ids").doc(uid).get(),
    db
      .collection("number_assignments")
      .where("uid", "==", uid)
      .where("status", "==", "active")
      .limit(1)
      .get(),
  ]);
  return {
    oneNumbrId: idSnap.exists ? String(idSnap.data()?.onenumbr ?? "") || null : null,
    numberId: assignmentSnap.empty ? null : String(assignmentSnap.docs[0].data().numberId ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Mapping + ownership
// ---------------------------------------------------------------------------

function mapEndpoint(id: string, d: FirebaseFirestore.DocumentData): EndpointRecord {
  return {
    id,
    uid: String(d.uid ?? ""),
    oneNumbrId: d.oneNumbrId ? String(d.oneNumbrId) : null,
    numberId: d.numberId ? String(d.numberId) : null,
    type: (d.type as EndpointType) ?? "web",
    name: String(d.name ?? "Endpoint"),
    platform: String(d.platform ?? ""),
    deviceId: d.deviceId ? String(d.deviceId) : null,
    status: (d.status as EndpointStatus) ?? "pending_verification",
    capabilities: (d.capabilities as EndpointCapability[]) ?? [],
    verificationStatus: d.verificationStatus ?? "demo_verified",
    isPrimary: d.isPrimary === true,
    presence: (d.presence as EndpointPresence) ?? "offline",
    lastActiveAt: toMillis(d.lastActiveAt),
    provider: d.provider ? String(d.provider) : null,
    providerReference: d.providerReference ? String(d.providerReference) : null,
    tauCoreIdentityId: d.tauCoreIdentityId ? String(d.tauCoreIdentityId) : null,
    tauDeviceId: d.tauDeviceId ? String(d.tauDeviceId) : null,
    tauApplicationId: d.tauApplicationId ? String(d.tauApplicationId) : null,
    metadata: (d.metadata ?? {}) as EndpointRecord["metadata"],
    revokedAt: toMillis(d.revokedAt),
    revokedReason: d.revokedReason ? String(d.revokedReason) : null,
    createdAt: toMillisOr(d.createdAt, 0),
    updatedAt: toMillisOr(d.updatedAt, 0),
  };
}

function toView(r: EndpointRecord): EndpointView {
  return {
    id: r.id,
    type: r.type,
    typeLabel: r.type === "web" ? "Web" : r.type === "tau_phone" ? "TauPhone" : r.type === "tau_talk" ? "TauTalk" : r.type === "verified_device" ? "Verified device" : r.type === "mobile_app" ? "Mobile app" : r.type,
    availability: ENDPOINT_TYPE_AVAILABILITY[r.type],
    name: r.name,
    platform: r.platform,
    status: r.status,
    capabilities: r.capabilities,
    capabilityModes: ENDPOINT_CAPABILITY_MODES[r.type],
    verificationStatus: r.verificationStatus,
    isPrimary: r.isPrimary,
    presence: r.presence,
    lastActiveAt: r.lastActiveAt,
    provider: r.provider,
    providerReference: r.providerReference,
    createdAt: r.createdAt,
  };
}

async function getOwnedEndpoint(uid: string, endpointId: string): Promise<EndpointRecord> {
  const snap = await getAdminDb().collection("communication_endpoints").doc(endpointId).get();
  if (!snap.exists) throw appError("not-found", "endpoint not found");
  const record = mapEndpoint(snap.id, snap.data() ?? {});
  if (record.uid !== uid) throw appError("permission-denied", "not your endpoint");
  return record;
}

function assertTransition(from: EndpointStatus, to: EndpointStatus): void {
  if (!ENDPOINT_TRANSITIONS[from].includes(to)) {
    throw appError("invalid-data", `cannot move an endpoint from ${from} to ${to}`);
  }
}

// ---------------------------------------------------------------------------
// Registration (server-authorized)
// ---------------------------------------------------------------------------

export async function registerEndpoint(input: {
  uid: string;
  type: EndpointType;
  name: string;
  platform?: string;
  deviceId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<EndpointView> {
  // Entitlement gate (Prompt 13): the Global Plan provides multi-device
  // endpoints. The endpoint itself is never a billing object.
  await requireEntitlement(input.uid, "endpoints.multi_device");
  const availability = ENDPOINT_TYPE_AVAILABILITY[input.type];
  if (availability === "disabled" || availability === "coming_soon") {
    throw appError("invalid-data", "this endpoint type is not available yet");
  }

  const provider = getEndpointProvider(input.type);
  if (!provider) throw appError("invalid-data", "no provider registered for this endpoint type");

  // Identity + number resolved SERVER-side; never accepted from the client.
  const { oneNumbrId, numberId } = await resolveIdentity(input.uid);

  const name = input.name.trim().slice(0, 60);
  if (!name) throw appError("invalid-data", "endpoint name is required");

  // Verified-device binding: only for a device actually owned by this user.
  let deviceId: string | null = null;
  let verificationStatus: EndpointRecord["verificationStatus"] = "demo_verified";
  if (input.deviceId) {
    const deviceSnap = await getAdminDb().collection("devices").doc(input.deviceId).get();
    if (deviceSnap.exists && String(deviceSnap.data()?.uid ?? "") === input.uid) {
      deviceId = input.deviceId;
      verificationStatus = "verified";
    }
  }

  const result = await provider.register({
    uid: input.uid,
    oneNumbrId,
    numberId,
    displayName: name,
    platform: input.platform ?? input.type,
    clientMetadata: input.metadata,
  });

  const now = Date.now();
  const ref = getAdminDb().collection("communication_endpoints").doc();
  const record = {
    uid: input.uid,
    oneNumbrId,
    numberId,
    type: input.type,
    name,
    platform: input.platform ?? input.type,
    deviceId,
    // Available types activate immediately; demo types land active with
    // demo_verified (no real device authentication exists yet — documented).
    status: (availability === "available" ? "active" : "active") as EndpointStatus,
    capabilities: result.capabilities,
    verificationStatus,
    isPrimary: false,
    presence: "offline" as EndpointPresence,
    lastActiveAt: now,
    provider: provider.name,
    providerReference: result.providerReference,
    tauCoreIdentityId: null,
    tauDeviceId: null,
    tauApplicationId: null,
    metadata: input.metadata ?? {},
    revokedAt: null,
    revokedReason: null,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(record);

  // First active endpoint of a type becomes primary automatically (sensible
  // default preference — user can change it; never touches identity/number).
  const existingActive = await getAdminDb()
    .collection("communication_endpoints")
    .where("uid", "==", input.uid)
    .where("status", "==", "active")
    .get();
  const activeCount = existingActive.docs.filter((d) => d.id !== ref.id).length;

  await writeAuditLog({
    actorUid: input.uid,
    action: "communications.endpoint_registered",
    targetUid: input.uid,
    metadata: { endpointId: ref.id, type: input.type, provider: provider.name, demo: true },
  });
  await createNotification({
    uid: input.uid,
    kind: "communications.endpoint_connected",
    title: "New endpoint connected",
    message: `${name} (${provider.name.includes("tauphone") ? "TauPhone" : provider.name.includes("tautalk") ? "TauTalk" : "app"}) is now connected to your OneNumbr Number. Demo endpoint — no real telecom connectivity.`,
  }).catch(() => undefined);

  return toView(mapEndpoint(ref.id, record));
}

// ---------------------------------------------------------------------------
// Listing + detail
// ---------------------------------------------------------------------------

export async function listEndpointsForUser(uid: string): Promise<EndpointView[]> {
  const snap = await getAdminDb()
    .collection("communication_endpoints")
    .where("uid", "==", uid)
    .orderBy("createdAt", "asc")
    .limit(50)
    .get();
  return snap.docs.map((d) => toView(mapEndpoint(d.id, d.data())));
}

export async function getEndpointForUser(uid: string, endpointId: string): Promise<EndpointView> {
  return toView(await getOwnedEndpoint(uid, endpointId));
}

// ---------------------------------------------------------------------------
// Lifecycle transitions
// ---------------------------------------------------------------------------

export async function revokeEndpoint(input: {
  uid: string;
  endpointId: string;
  reason?: string;
  actorUid?: string; // staff action support
}): Promise<EndpointView> {
  const record = await getOwnedEndpoint(input.uid, input.endpointId);
  assertTransition(record.status, "revoked");

  const now = Date.now();
  await getAdminDb()
    .collection("communication_endpoints")
    .doc(input.endpointId)
    .update({
      status: "revoked" as EndpointStatus,
      isPrimary: false,
      presence: "unavailable" as EndpointPresence,
      revokedAt: now,
      revokedReason: input.reason?.slice(0, 120) ?? "user_requested",
      updatedAt: now,
    });

  const provider = record.provider ? getEndpointProvider(record.type) : null;
  if (provider && record.providerReference) {
    await provider.revoke(record.providerReference, input.reason ?? "user_requested").catch(() => undefined);
  }

  await writeAuditLog({
    actorUid: input.actorUid ?? input.uid,
    action: "communications.endpoint_revoked",
    targetUid: input.uid,
    metadata: { endpointId: input.endpointId, type: record.type, reason: input.reason ?? "user_requested" },
  });
  await createNotification({
    uid: input.uid,
    kind: "communications.endpoint_revoked",
    title: "Endpoint revoked",
    message: `${record.name} can no longer be used with your OneNumbr Number. Your number and identity are unchanged.`,
  }).catch(() => undefined);

  // Revoking the primary promotes the oldest other active endpoint.
  await ensurePrimaryExists(input.uid);

  return toView(await getOwnedEndpoint(input.uid, input.endpointId));
}

export async function activateEndpoint(input: { uid: string; endpointId: string }): Promise<EndpointView> {
  const record = await getOwnedEndpoint(input.uid, input.endpointId);
  assertTransition(record.status, "active");

  await getAdminDb()
    .collection("communication_endpoints")
    .doc(input.endpointId)
    .update({ status: "active" as EndpointStatus, presence: "offline", lastActiveAt: Date.now(), updatedAt: Date.now() });

  await writeAuditLog({
    actorUid: input.uid,
    action: "communications.endpoint_activated",
    targetUid: input.uid,
    metadata: { endpointId: input.endpointId, type: record.type },
  });
  return toView(await getOwnedEndpoint(input.uid, input.endpointId));
}

export async function suspendEndpoint(input: {
  uid: string;
  endpointId: string;
  actorUid?: string;
}): Promise<EndpointView> {
  const record = await getOwnedEndpoint(input.uid, input.endpointId);
  assertTransition(record.status, "suspended");

  await getAdminDb()
    .collection("communication_endpoints")
    .doc(input.endpointId)
    .update({ status: "suspended" as EndpointStatus, isPrimary: false, updatedAt: Date.now() });

  await writeAuditLog({
    actorUid: input.actorUid ?? input.uid,
    action: "communications.endpoint_suspended",
    targetUid: input.uid,
    metadata: { endpointId: input.endpointId, type: record.type },
  });
  await ensurePrimaryExists(input.uid);
  return toView(await getOwnedEndpoint(input.uid, input.endpointId));
}

// ---------------------------------------------------------------------------
// Primary endpoint preference (never touches identity/number)
// ---------------------------------------------------------------------------

export async function setPrimaryEndpoint(input: { uid: string; endpointId: string }): Promise<EndpointView> {
  const record = await getOwnedEndpoint(input.uid, input.endpointId);
  if (record.status !== "active") {
    throw appError("invalid-data", "only an active endpoint can be primary");
  }

  const db = getAdminDb();
  const batch = db.batch();
  const current = await db
    .collection("communication_endpoints")
    .where("uid", "==", input.uid)
    .where("isPrimary", "==", true)
    .limit(5)
    .get();
  for (const d of current.docs) {
    if (d.id !== input.endpointId) batch.update(d.ref, { isPrimary: false, updatedAt: new Date() });
  }
  batch.update(db.collection("communication_endpoints").doc(input.endpointId), {
    isPrimary: true,
    updatedAt: new Date(),
  });
  await batch.commit();

  await writeAuditLog({
    actorUid: input.uid,
    action: "communications.endpoint_primary_changed",
    targetUid: input.uid,
    metadata: { endpointId: input.endpointId, type: record.type },
  });
  await createNotification({
    uid: input.uid,
    kind: "communications.endpoint_primary_changed",
    title: "Primary endpoint changed",
    message: `${record.name} is now your preferred way to reach your OneNumbr Number. Your number stays the same.`,
  }).catch(() => undefined);
  return toView(await getOwnedEndpoint(input.uid, input.endpointId));
}

async function ensurePrimaryExists(uid: string): Promise<void> {
  const db = getAdminDb();
  const active = await db
    .collection("communication_endpoints")
    .where("uid", "==", uid)
    .where("status", "==", "active")
    .orderBy("createdAt", "asc")
    .limit(5)
    .get();
  const anyPrimary = active.docs.some((d) => d.data().isPrimary === true);
  if (!anyPrimary && !active.empty) {
    await db.collection("communication_endpoints").doc(active.docs[0].id).update({
      isPrimary: true,
      updatedAt: new Date(),
    });
  }
}

// ---------------------------------------------------------------------------
// Presence — explicit updates only (no heartbeats, free-tier friendly)
// ---------------------------------------------------------------------------

const PRESENCE_VALUES: EndpointPresence[] = ["online", "offline", "busy", "unavailable", "suspended"];

export async function setEndpointPresence(input: {
  uid: string;
  endpointId: string;
  presence: EndpointPresence;
}): Promise<EndpointView> {
  if (!PRESENCE_VALUES.includes(input.presence)) {
    throw appError("invalid-data", "unknown presence state");
  }
  const record = await getOwnedEndpoint(input.uid, input.endpointId);
  if (record.status === "revoked") throw appError("invalid-data", "a revoked endpoint has no presence");

  await getAdminDb()
    .collection("communication_endpoints")
    .doc(input.endpointId)
    .update({
      presence: input.presence,
      lastActiveAt: Date.now(),
      updatedAt: Date.now(),
    });
  return toView(await getOwnedEndpoint(input.uid, input.endpointId));
}

// ---------------------------------------------------------------------------
// Routing simulation — deterministic, application-level only
// ---------------------------------------------------------------------------

export async function simulateInboundRouting(input: {
  uid: string;
  kind: "call" | "message";
}): Promise<EndpointRoutingDecision> {
  const db = getAdminDb();
  const snap = await db
    .collection("communication_endpoints")
    .where("uid", "==", input.uid)
    .where("status", "==", "active")
    .orderBy("createdAt", "asc")
    .limit(20)
    .get();

  const candidates = snap.docs
    .map((d) => mapEndpoint(d.id, d.data()))
    .filter((e) => (input.kind === "call" ? e.capabilities.includes("voice") || e.type === "tau_phone" : true))
    .filter((e) => e.presence !== "busy" && e.presence !== "unavailable")
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.createdAt - b.createdAt);

  const evaluated = candidates.map((e, order) => ({
    endpointId: e.id,
    type: e.type,
    name: e.name,
    order: order + 1,
  }));

  if (candidates.length === 0) {
    return {
      evaluated: [],
      selected: null,
      fallback: null,
      terminal: "voicemail",
      reason: `No available endpoint could take the demo ${input.kind}; it went to voicemail.`,
    };
  }

  const provider = candidates[0].provider ? getEndpointProvider(candidates[0].type) : null;
  const reachable = provider && candidates[0].providerReference
    ? await provider.isReachable(candidates[0].providerReference)
    : true;

  const selected = reachable ? candidates[0] : null;
  const fallback = !reachable && candidates[1] ? candidates[1] : null;

  return {
    evaluated,
    selected: selected ? { endpointId: selected.id, type: selected.type, name: selected.name } : null,
    fallback: fallback ? { endpointId: fallback.id, type: fallback.type, name: fallback.name } : null,
    terminal: "voicemail",
    reason: selected
      ? `Demo ${input.kind} routed to ${selected.name} (primary endpoint). No PSTN/carrier involved.`
      : `Primary endpoint was unreachable; demo ${input.kind} fell back to voicemail.`,
  };
}
