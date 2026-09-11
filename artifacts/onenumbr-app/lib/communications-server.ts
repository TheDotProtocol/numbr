// =============================================================================
// OneNumbr — Communications engine (server-side; Admin SDK; Prompt 11)
//
// Domain layer ABOVE connectivity. All state transitions live here; clients
// only send identifiers and text. Security model follows Prompt 10:
//   - every function is owner-checked by uid (never client-trusted)
//   - provider references are demo-only (MOCK-*) and clearly projected as such
//   - message bodies are user records; audit metadata never includes them
//
// Hierarchy enforced here:
//   USER → ONENUMBR ID → PRIMARY NUMBER → GLOBAL PLAN → COMMUNICATIONS
//
// The existing Number Engine (number_orders / number_assignments) remains the
// source of truth for number ownership — nothing is duplicated.
// =============================================================================

import { getAdminDb } from "@/firebase/admin";
import { appError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit-server";
import { createNotification } from "@/lib/kyc-server";
import { getCommunicationsProvider } from "@/providers";
import { requireEntitlement } from "@/lib/entitlements-server";
import { PSTN_PROVIDER_BOUNDARY } from "@/providers/communications/pstn-future";
import type {
  CallDirection,
  CallParty,
  CallRecord,
  CallStatus,
  CallTerminationReason,
  CommunicationEndpoint,
  CommunicationPreferences,
  CommunicationsNumberView,
  CommunicationsOverview,
  EndpointKind,
  GlobalPlanView,
  MessageDirection,
  MessageRecord,
  MessageStatus,
  NumberAssignmentStatus,
  NumberingStatus,
  RoutingAction,
  RoutingRule,
  VoicemailRecord,
  VoicemailStatus,
} from "@/types/communications";
import type { SubscriptionRecord } from "@/types/billing";

const PROVIDER_DEMO = true; // mock-communications is demo — flip only with a real adapter

function toMillis(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toMillis" in v) return (v as { toMillis(): number }).toMillis();
  return null;
}

function toMillisOr(v: unknown, fallback: number): number {
  return toMillis(v) ?? fallback;
}

// ---------------------------------------------------------------------------
// Number resolution — ownership from the EXISTING number engine
// ---------------------------------------------------------------------------

/**
 * Resolve the caller's PRIMARY number (active assignment) and derive the
 * structured numbering model from the existing engine data. The OneNumbr ID
 * is read from onenumbr_ids and is never affected by number lifecycle.
 */
export async function getOwnedNumberView(
  uid: string,
  numberId?: string,
): Promise<CommunicationsNumberView> {
  const db = getAdminDb();

  const assignmentQuery = db
    .collection("number_assignments")
    .where("uid", "==", uid)
    .where("status", "==", "active")
    .limit(5);

  const snap = await assignmentQuery.get();
  if (snap.empty) throw appError("not-found", "no active OneNumbr Number");

  // Product model: first (earliest active) assignment is PRIMARY.
  const docs = snap.docs.sort(
    (a, b) => toMillisOr(a.data().assignedAt, Infinity) - toMillisOr(b.data().assignedAt, Infinity),
  );
  const doc = numberId ? docs.find((d) => String(d.data().numberId ?? "") === numberId) : docs[0];
  if (!doc) throw appError("permission-denied", "number does not belong to this account");

  const a = doc.data();
  const numberSnap = await db.collection("numbers").doc(String(a.numberId ?? "")).get();
  const n = numberSnap.data() ?? {};

  const onenumbrNumber = String(a.onenumbrNumber ?? n.onenumbrNumber ?? "");
  // Application-level split: "+1739 284739" → prefix "+1739", subscriber "284739".
  const spaceIdx = onenumbrNumber.indexOf(" ");
  const applicationPrefix = spaceIdx > 0 ? onenumbrNumber.slice(0, spaceIdx) : onenumbrNumber.slice(0, 5);
  const subscriberNumber = spaceIdx > 0 ? onenumbrNumber.slice(spaceIdx + 1) : onenumbrNumber.slice(5);

  const numberStatus = String(n.status ?? "active");

  return {
    numberId: String(a.numberId ?? ""),
    assignmentId: doc.id,
    displayNumber: String(a.displayNumber ?? n.displayNumber ?? onenumbrNumber),
    applicationPrefix,
    subscriberNumber,
    canonicalRepresentation: onenumbrNumber.replace(/\s+/g, ""),
    // Numbering honesty: always application-level until a real arrangement exists.
    numberingStatus: "application_only",
    pstnStatus: "not_available",
    routingStatus: "application",
    assignmentStatus: (doc.id === docs[0].id ? "primary" : "secondary") as NumberAssignmentStatus,
    assignedAt: toMillis(a.assignedAt),
  };
}

/** The permanent OneNumbr ID — independent of any number lifecycle. */
export async function getOneNumbrId(uid: string): Promise<string | null> {
  const snap = await getAdminDb().collection("onenumbr_ids").doc(uid).get();
  return snap.exists ? String(snap.data()?.onenumbr ?? "") || null : null;
}

async function getOwnedCall(uid: string, callId: string): Promise<CallRecord> {
  const snap = await getAdminDb().collection("calls").doc(callId).get();
  if (!snap.exists) throw appError("not-found", "call not found");
  return mapCall(snap.id, snap.data() ?? {});
}

function mapCall(id: string, d: FirebaseFirestore.DocumentData): CallRecord {
  return {
    id,
    uid: String(d.uid ?? ""),
    oneNumbrId: d.oneNumbrId ? String(d.oneNumbrId) : null,
    numberId: String(d.numberId ?? ""),
    direction: (d.direction as CallDirection) ?? "outbound",
    from: (d.from as CallParty) ?? { label: "", canonical: null },
    to: (d.to as CallParty) ?? { label: "", canonical: null },
    status: (d.status as CallStatus) ?? "initiated",
    provider: String(d.provider ?? "mock-communications"),
    providerReference: d.providerReference ? String(d.providerReference) : null,
    startedAt: toMillisOr(d.startedAt, 0),
    answeredAt: toMillis(d.answeredAt),
    endedAt: toMillis(d.endedAt),
    durationSeconds: typeof d.durationSeconds === "number" ? d.durationSeconds : null,
    terminationReason: (d.terminationReason as CallTerminationReason | null) ?? null,
    createdAt: toMillisOr(d.createdAt, 0),
    updatedAt: toMillisOr(d.updatedAt, 0),
  };
}

async function getOwnedMessage(uid: string, messageId: string): Promise<MessageRecord> {
  const snap = await getAdminDb().collection("messages").doc(messageId).get();
  if (!snap.exists) throw appError("not-found", "message not found");
  const d = snap.data() ?? {};
  if (String(d.uid ?? "") !== uid) throw appError("permission-denied", "not your message");
  return mapMessage(snap.id, d);
}

function mapMessage(id: string, d: FirebaseFirestore.DocumentData): MessageRecord {
  return {
    id,
    uid: String(d.uid ?? ""),
    oneNumbrId: d.oneNumbrId ? String(d.oneNumbrId) : null,
    numberId: String(d.numberId ?? ""),
    direction: (d.direction as MessageDirection) ?? "outbound",
    from: (d.from as CallParty) ?? { label: "", canonical: null },
    to: (d.to as CallParty) ?? { label: "", canonical: null },
    body: String(d.body ?? ""),
    status: (d.status as MessageStatus) ?? "queued",
    provider: String(d.provider ?? "mock-communications"),
    providerReference: d.providerReference ? String(d.providerReference) : null,
    createdAt: toMillisOr(d.createdAt, 0),
    deliveredAt: toMillis(d.deliveredAt),
    readAt: toMillis(d.readAt),
    updatedAt: toMillisOr(d.updatedAt, 0),
  };
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

export async function initiateCall(input: {
  uid: string;
  numberId?: string;
  to: string;
}): Promise<CallRecord> {
  // Entitlement gate (Prompt 13): the Global Plan provides voice (demo).
  await requireEntitlement(input.uid, "communications.voice");
  const number = await getOwnedNumberView(input.uid, input.numberId);
  const oneNumbrId = await getOneNumbrId(input.uid);

  const result = await getCommunicationsProvider().initiateCall({
    numberId: number.numberId,
    to: { label: input.to, canonical: null },
  });

  const now = Date.now();
  const ref = getAdminDb().collection("calls").doc();
  const record = {
    uid: input.uid,
    oneNumbrId,
    numberId: number.numberId,
    direction: "outbound" as CallDirection,
    from: { label: number.displayNumber, canonical: number.canonicalRepresentation },
    to: { label: input.to, canonical: null },
    status: "initiated" as CallStatus,
    provider: getCommunicationsProvider().name,
    providerReference: result.providerReference,
    startedAt: now,
    answeredAt: null,
    endedAt: null,
    durationSeconds: null,
    terminationReason: null,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(record);

  await writeAuditLog({
    actorUid: input.uid,
    action: "communications.call_initiated",
    targetUid: input.uid,
    metadata: { callId: ref.id, providerReference: result.providerReference, demo: PROVIDER_DEMO },
  });
  return mapCall(ref.id, record);
}

export async function updateCall(input: {
  uid: string;
  callId: string;
  status?: CallStatus;
  terminationReason?: CallTerminationReason;
}): Promise<CallRecord> {
  const call = await getOwnedCall(input.uid, input.callId);
  if (call.status === "ended") throw appError("invalid-data", "call already ended");

  const now = Date.now();
  const patch: Record<string, unknown> = { updatedAt: now };
  if (input.status) patch.status = input.status;
  if (input.status === "answered" && !call.answeredAt) patch.answeredAt = now;
  if (input.status === "ended") {
    patch.endedAt = now;
    patch.terminationReason = input.terminationReason ?? "hangup";
    patch.durationSeconds = Math.max(0, Math.round((now - (call.answeredAt ?? call.startedAt)) / 1000));
    await getCommunicationsProvider().endCall(call.providerReference ?? "", input.terminationReason ?? "hangup");
  }

  await getAdminDb().collection("calls").doc(input.callId).update(patch);
  await writeAuditLog({
    actorUid: input.uid,
    action: "communications.call_ended",
    targetUid: input.uid,
    metadata: { callId: input.callId, status: input.status ?? call.status, demo: PROVIDER_DEMO },
  });
  return getOwnedCall(input.uid, input.callId);
}

export async function listCalls(uid: string, limit = 25): Promise<CallRecord[]> {
  const snap = await getAdminDb()
    .collection("calls")
    .where("uid", "==", uid)
    .orderBy("startedAt", "desc")
    .limit(Math.min(limit, 50))
    .get();
  return snap.docs.map((d) => mapCall(d.id, d.data()));
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function sendMessage(input: {
  uid: string;
  numberId?: string;
  to: string;
  body: string;
}): Promise<MessageRecord> {
  // Entitlement gate (Prompt 13): the Global Plan provides messaging (demo).
  await requireEntitlement(input.uid, "communications.messaging");
  const number = await getOwnedNumberView(input.uid, input.numberId);
  const oneNumbrId = await getOneNumbrId(input.uid);

  const result = await getCommunicationsProvider().sendMessage({
    numberId: number.numberId,
    to: { label: input.to, canonical: null },
    body: input.body,
  });

  const now = Date.now();
  const ref = getAdminDb().collection("messages").doc();
  // Deterministic demo lifecycle: queued → sent → delivered (instantly).
  const record = {
    uid: input.uid,
    oneNumbrId,
    numberId: number.numberId,
    direction: "outbound" as MessageDirection,
    from: { label: number.displayNumber, canonical: number.canonicalRepresentation },
    to: { label: input.to, canonical: null },
    body: input.body,
    status: "delivered" as MessageStatus,
    provider: getCommunicationsProvider().name,
    providerReference: result.providerReference,
    createdAt: now,
    deliveredAt: now, // demo: immediate; a real adapter moves this async
    readAt: null,
    updatedAt: now,
  };
  await ref.set(record);

  await writeAuditLog({
    actorUid: input.uid,
    action: "communications.message_sent",
    targetUid: input.uid,
    metadata: { messageId: ref.id, providerReference: result.providerReference, demo: PROVIDER_DEMO },
  });
  return mapMessage(ref.id, record);
}

/** Demo inbound message — clearly simulated, never real PSTN SMS. */
export async function receiveDemoMessage(input: {
  uid: string;
  numberId?: string;
  from: string;
  body: string;
}): Promise<MessageRecord> {
  const number = await getOwnedNumberView(input.uid, input.numberId);
  const result = await getCommunicationsProvider().receiveMessage({
    numberId: number.numberId,
    from: { label: input.from, canonical: null },
    body: input.body,
  });

  const now = Date.now();
  const ref = getAdminDb().collection("messages").doc();
  const record = {
    uid: input.uid,
    oneNumbrId: await getOneNumbrId(input.uid),
    numberId: number.numberId,
    direction: "inbound" as MessageDirection,
    from: { label: input.from, canonical: null },
    to: { label: number.displayNumber, canonical: number.canonicalRepresentation },
    body: input.body,
    status: "delivered" as MessageStatus,
    provider: getCommunicationsProvider().name,
    providerReference: result.providerReference,
    createdAt: now,
    deliveredAt: now,
    readAt: null,
    updatedAt: now,
  };
  await ref.set(record);

  await writeAuditLog({
    actorUid: input.uid,
    action: "communications.message_status_changed",
    targetUid: input.uid,
    metadata: { messageId: ref.id, direction: "inbound", simulated: true },
  });
  await createNotification({
    uid: input.uid,
    kind: "communications.message_received",
    title: "New demo message",
    message: `${input.from}: "${input.body.slice(0, 80)}${input.body.length > 80 ? "…" : ""}" (simulation)`,
  }).catch(() => undefined);
  return mapMessage(ref.id, record);
}

export async function markMessageRead(uid: string, messageId: string): Promise<MessageRecord> {
  const msg = await getOwnedMessage(uid, messageId);
  const now = Date.now();
  const patch = { status: "read" as MessageStatus, readAt: now, updatedAt: now };
  await getAdminDb().collection("messages").doc(messageId).update(patch);
  return getOwnedMessage(uid, messageId);
}

export async function listMessages(uid: string, limit = 25): Promise<MessageRecord[]> {
  const snap = await getAdminDb()
    .collection("messages")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(Math.min(limit, 50))
    .get();
  return snap.docs.map((d) => mapMessage(d.id, d.data()));
}

// ---------------------------------------------------------------------------
// Voicemail
// ---------------------------------------------------------------------------

function mapVoicemail(id: string, d: FirebaseFirestore.DocumentData): VoicemailRecord {
  return {
    id,
    uid: String(d.uid ?? ""),
    oneNumbrId: d.oneNumbrId ? String(d.oneNumbrId) : null,
    numberId: String(d.numberId ?? ""),
    caller: (d.caller as CallParty) ?? { label: "", canonical: null },
    durationSeconds: typeof d.durationSeconds === "number" ? d.durationSeconds : 0,
    status: (d.status as VoicemailStatus) ?? "new",
    provider: String(d.provider ?? "mock-communications"),
    providerReference: d.providerReference ? String(d.providerReference) : null,
    transcript: d.transcript ? String(d.transcript) : null,
    recordingPath: d.recordingPath ? String(d.recordingPath) : null,
    createdAt: toMillisOr(d.createdAt, 0),
    readAt: toMillis(d.readAt),
    updatedAt: toMillisOr(d.updatedAt, 0),
  };
}

export async function createDemoVoicemail(input: {
  uid: string;
  numberId?: string;
  caller: string;
  durationSeconds: number;
  transcript: string;
}): Promise<VoicemailRecord> {
  const number = await getOwnedNumberView(input.uid, input.numberId);
  const result = await getCommunicationsProvider().createVoicemail({
    numberId: number.numberId,
    caller: { label: input.caller, canonical: null },
    durationSeconds: input.durationSeconds,
    transcript: input.transcript,
  });

  const now = Date.now();
  const ref = getAdminDb().collection("voicemails").doc();
  const record = {
    uid: input.uid,
    oneNumbrId: await getOneNumbrId(input.uid),
    numberId: number.numberId,
    caller: { label: input.caller, canonical: null },
    durationSeconds: input.durationSeconds,
    status: "new" as VoicemailStatus,
    provider: getCommunicationsProvider().name,
    providerReference: result.providerReference,
    // Demo transcript only — no audio stored. A real recording would live in
    // private Storage with owner-checked signed-URL access (Prompt 10 rules).
    transcript: input.transcript,
    recordingPath: null,
    createdAt: now,
    readAt: null,
    updatedAt: now,
  };
  await ref.set(record);

  await writeAuditLog({
    actorUid: input.uid,
    action: "communications.voicemail_created",
    targetUid: input.uid,
    metadata: { voicemailId: ref.id, simulated: true },
  });
  await createNotification({
    uid: input.uid,
    kind: "communications.voicemail_created",
    title: "New demo voicemail",
    message: `A simulated voicemail from ${input.caller} arrived for ${number.displayNumber}.`,
  }).catch(() => undefined);
  return mapVoicemail(ref.id, record);
}

export async function markVoicemailRead(uid: string, voicemailId: string): Promise<VoicemailRecord> {
  const snap = await getAdminDb().collection("voicemails").doc(voicemailId).get();
  if (!snap.exists) throw appError("not-found", "voicemail not found");
  const d = snap.data() ?? {};
  if (String(d.uid ?? "") !== uid) throw appError("permission-denied", "not your voicemail");

  const now = Date.now();
  const patch = { status: "read" as VoicemailStatus, readAt: now, updatedAt: now };
  await getAdminDb().collection("voicemails").doc(voicemailId).update(patch);
  await getCommunicationsProvider().markVoicemailRead(String(d.providerReference ?? ""));
  const after = await getAdminDb().collection("voicemails").doc(voicemailId).get();
  return mapVoicemail(voicemailId, after.data() ?? {});
}

export async function listVoicemails(uid: string, limit = 25): Promise<VoicemailRecord[]> {
  const snap = await getAdminDb()
    .collection("voicemails")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(Math.min(limit, 50))
    .get();
  return snap.docs.map((d) => mapVoicemail(d.id, d.data()));
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

const ENDPOINT_KINDS: EndpointKind[] = [
  "web",
  "mobile_app",
  "tau_phone",
  "verified_device",
  "forwarding_destination",
  "voicemail",
  "sip",
  "pstn",
];

function mapEndpoint(id: string, d: FirebaseFirestore.DocumentData): CommunicationEndpoint {
  return {
    id,
    uid: String(d.uid ?? ""),
    kind: (d.kind as EndpointKind) ?? "web",
    label: String(d.label ?? "Endpoint"),
    target: d.target ? String(d.target) : null,
    enabled: d.enabled !== false,
    priority: typeof d.priority === "number" ? d.priority : 100,
    createdAt: toMillisOr(d.createdAt, 0),
    updatedAt: toMillisOr(d.updatedAt, 0),
  };
}

export async function listEndpoints(uid: string): Promise<CommunicationEndpoint[]> {
  const snap = await getAdminDb()
    .collection("communication_endpoints")
    .where("uid", "==", uid)
    .orderBy("priority", "asc")
    .limit(20)
    .get();
  return snap.docs.map((d) => mapEndpoint(d.id, d.data()));
}

export async function addEndpoint(input: {
  uid: string;
  kind: EndpointKind;
  label: string;
  target?: string | null;
}): Promise<CommunicationEndpoint> {
  if (!ENDPOINT_KINDS.includes(input.kind)) {
    throw appError("invalid-data", "unknown endpoint kind");
  }
  if (input.kind === "pstn" || input.kind === "sip") {
    // PSTN/SIP endpoints require the future adapter + flag; not available.
    if (!PSTN_PROVIDER_BOUNDARY.enabled) {
      throw appError("invalid-data", "this endpoint type is not enabled yet");
    }
  }
  const label = input.label.trim().slice(0, 60);
  if (!label) throw appError("invalid-data", "endpoint label is required");

  const now = Date.now();
  const ref = getAdminDb().collection("communication_endpoints").doc();
  const record = {
    uid: input.uid,
    kind: input.kind,
    label,
    target: input.target ?? null,
    enabled: true,
    priority: 100,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(record);
  await writeAuditLog({
    actorUid: input.uid,
    action: "communications.endpoint_added",
    targetUid: input.uid,
    metadata: { endpointId: ref.id, kind: input.kind },
  });
  return mapEndpoint(ref.id, record);
}

export async function updateEndpoint(input: {
  uid: string;
  endpointId: string;
  label?: string;
  enabled?: boolean;
}): Promise<CommunicationEndpoint> {
  const snap = await getAdminDb().collection("communication_endpoints").doc(input.endpointId).get();
  if (!snap.exists) throw appError("not-found", "endpoint not found");
  const d = snap.data() ?? {};
  if (String(d.uid ?? "") !== input.uid) throw appError("permission-denied", "not your endpoint");

  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  if (input.label !== undefined) patch.label = input.label.trim().slice(0, 60) || "Endpoint";
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  await getAdminDb().collection("communication_endpoints").doc(input.endpointId).update(patch);

  await writeAuditLog({
    actorUid: input.uid,
    action: input.enabled === false ? "communications.endpoint_removed" : "communications.endpoint_added",
    targetUid: input.uid,
    metadata: { endpointId: input.endpointId },
  });
  return mapEndpoint(input.endpointId, { ...d, ...patch });
}

// ---------------------------------------------------------------------------
// Routing rules
// ---------------------------------------------------------------------------

const ROUTING_ACTIONS: RoutingAction[] = ["app", "tau_phone", "verified_device", "forward", "voicemail"];

export async function getRoutingRules(uid: string, numberId: string): Promise<RoutingRule | null> {
  const snap = await getAdminDb().collection("routing_rules").doc(uid).get();
  if (!snap.exists) return null;
  const d = snap.data() ?? {};
  if (String(d.numberId ?? "") !== numberId) return null;
  return {
    id: snap.id,
    uid,
    numberId: String(d.numberId ?? numberId),
    steps: ((d.steps as RoutingAction[]) ?? ["app", "voicemail"]).filter((s) =>
      ROUTING_ACTIONS.includes(s),
    ),
    forwardEndpointId: d.forwardEndpointId ? String(d.forwardEndpointId) : null,
    ringTimeoutSeconds: typeof d.ringTimeoutSeconds === "number" ? d.ringTimeoutSeconds : 25,
    voicemailFallback: true,
    updatedAt: toMillisOr(d.updatedAt, 0),
  };
}

export async function updateRoutingRules(input: {
  uid: string;
  numberId: string;
  steps: RoutingAction[];
  forwardEndpointId?: string | null;
  ringTimeoutSeconds?: number;
}): Promise<RoutingRule> {
  const number = await getOwnedNumberView(input.uid, input.numberId);

  // Validate: known actions, forward requires an endpoint, voicemail terminal.
  const steps = input.steps.filter((s) => ROUTING_ACTIONS.includes(s));
  if (steps.length === 0) throw appError("invalid-data", "at least one routing step is required");
  if (steps.includes("forward") && !input.forwardEndpointId) {
    throw appError("invalid-data", "forwarding requires a selected endpoint");
  }
  if (!steps.includes("voicemail")) steps.push("voicemail"); // terminal fallback always

  const now = Date.now();
  const record = {
    uid: input.uid,
    numberId: number.numberId,
    steps,
    forwardEndpointId: input.forwardEndpointId ?? null,
    ringTimeoutSeconds: Math.min(Math.max(input.ringTimeoutSeconds ?? 25, 5), 60),
    voicemailFallback: true as const,
    updatedAt: now,
  };
  await getAdminDb().collection("routing_rules").doc(input.uid).set(record, { merge: true });

  await writeAuditLog({
    actorUid: input.uid,
    action: "communications.routing_changed",
    targetUid: input.uid,
    metadata: { numberId: number.numberId, steps },
  });
  return { id: input.uid, ...record };
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

const DEFAULT_PREFS: Omit<CommunicationPreferences, "uid" | "updatedAt"> = {
  voicemailEnabled: true,
  missedCallAlerts: true,
  messageAlerts: true,
  hideCallHistory: false,
};

export async function getCommunicationPreferences(uid: string): Promise<CommunicationPreferences> {
  const snap = await getAdminDb().collection("communication_preferences").doc(uid).get();
  if (!snap.exists) return { uid, ...DEFAULT_PREFS, updatedAt: 0 };
  const d = snap.data() ?? {};
  return {
    uid,
    voicemailEnabled: d.voicemailEnabled !== false,
    missedCallAlerts: d.missedCallAlerts !== false,
    messageAlerts: d.messageAlerts !== false,
    hideCallHistory: d.hideCallHistory === true,
    updatedAt: toMillisOr(d.updatedAt, 0),
  };
}

export async function updateCommunicationPreferences(
  uid: string,
  patch: Partial<Omit<CommunicationPreferences, "uid" | "updatedAt">>,
): Promise<CommunicationPreferences> {
  const merged = { ...(await getCommunicationPreferences(uid)), ...patch, uid, updatedAt: Date.now() };
  await getAdminDb()
    .collection("communication_preferences")
    .doc(uid)
    .set({ ...merged, updatedAt: new Date() }, { merge: true });
  await writeAuditLog({
    actorUid: uid,
    action: "communications.preferences_changed",
    targetUid: uid,
    metadata: { keys: Object.keys(patch) },
  });
  return merged;
}

// ---------------------------------------------------------------------------
// Global Plan view — built on the EXISTING billing subscriptions
// ---------------------------------------------------------------------------

export async function getGlobalPlanView(uid: string): Promise<GlobalPlanView> {
  const snap = await getAdminDb()
    .collection("subscriptions")
    .where("uid", "==", uid)
    .where("status", "in", ["trialing", "active", "past_due", "paused"])
    .limit(10)
    .get();

  const subs = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SubscriptionRecord, "id">) }))
    // A number-sourced subscription IS the Global Plan in this model.
    .filter((s) => s.source === "number")
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const active = subs[0];
  if (!active) {
    return {
      active: false,
      planId: null,
      planName: "OneNumbr Global Plan",
      amountMinor: null,
      currency: null,
      interval: null,
      currentPeriodEnd: null,
      subscriptionId: null,
      demoProvider: true,
    };
  }
  return {
    active: active.status === "active" || active.status === "trialing" || active.status === "past_due",
    planId: active.planId,
    planName: active.planSnapshot?.planName ?? "OneNumbr Global Plan",
    amountMinor: active.planSnapshot?.amountMinor ?? null,
    currency: active.planSnapshot?.currency ?? null,
    interval: active.planSnapshot?.interval ?? null,
    currentPeriodEnd: active.currentPeriodEnd ?? null,
    subscriptionId: active.id,
    demoProvider: true,
  };
}

// ---------------------------------------------------------------------------
// Unified overview — ONE read path for the Communications page
// ---------------------------------------------------------------------------

export async function getCommunicationsOverview(uid: string): Promise<CommunicationsOverview> {
  const [numberOrErr, plan] = await Promise.all([
    getOwnedNumberView(uid).catch(() => null),
    getGlobalPlanView(uid),
  ]);

  const number = numberOrErr;
  const [calls, messages, voicemails, endpoints, routing, preferences] = await Promise.all([
    listCalls(uid, 10),
    listMessages(uid, 10),
    listVoicemails(uid, 10),
    listEndpoints(uid),
    number ? getRoutingRules(uid, number.numberId) : Promise.resolve(null),
    getCommunicationPreferences(uid),
  ]);

  return {
    number,
    plan,
    recentCalls: calls,
    recentMessages: messages,
    recentVoicemails: voicemails,
    endpoints,
    routing,
    preferences,
    provider: { name: getCommunicationsProvider().name, demo: PROVIDER_DEMO },
  };
}
