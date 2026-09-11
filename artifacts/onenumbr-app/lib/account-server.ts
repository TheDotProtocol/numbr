// =============================================================================
// OneNumbr — Account engine (server-side; Admin SDK; Prompt 6)
//
// Unifies identity, KYC, numbers, eSIMs, billing, security, sessions and
// devices into one account control plane. EXTENDS existing systems — it
// never duplicates them:
//   - KYC state comes from the existing kyc/{uid} + deriveIdentityState()
//   - numbers / eSIMs / billing are read from their existing collections
//   - audit events go through the existing audit architecture
//   - notifications go through the existing notification system
//
// Security invariants:
//   - The current session is identified SERVER-side (sessionId issued at
//     registration; "current" is never trusted from the client).
//   - Session/device revocation and all lifecycle transitions are
//     server-authorized and owner-checked.
//   - IP addresses are stored only as SHA-256 hash prefixes (privacy-safe).
//   - Location is never fabricated: it is "Location unavailable".
// =============================================================================

import { createHash, randomUUID } from "crypto";
import { headers } from "next/headers";
import { getAdminDb } from "@/firebase/admin";
import { appError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit-server";
import { createNotification, mapKycDoc } from "@/lib/kyc-server";
import { deriveIdentityState, type IdentityState } from "@/types/kyc";
import { getTwoFactorProvider } from "@/providers";
import type {
  AccountLifecycle,
  AccountSecurityRecord,
  AccountSummary,
  ManagedDevice,
  NotificationPreferences,
  PrivacySettings,
  SecurityEvent,
  SecurityEventType,
  SessionRecord,
  SessionView,
  DeviceView,
  TwoFactorState,
} from "@/types/account";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toMillis(v: unknown): number | null {
  if (!v) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "toMillis" in v) {
    return (v as { toMillis(): number }).toMillis();
  }
  return null;
}

/** Privacy-safe IP representation: SHA-256 prefix. Raw IPs are never stored. */
export async function hashClientIp(): Promise<string | null> {
  try {
    const h = await headers();
    const raw =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      "";
    if (!raw) return null;
    return createHash("sha256").update(raw).digest("hex").slice(0, 12);
  } catch {
    return null;
  }
}

/** Parse the user agent into an honest device description ("Chrome on macOS"). */
export function describeUserAgent(ua: string): {
  description: string;
  platform: string;
  browser: string;
  deviceType: "desktop" | "mobile" | "tablet";
} {
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox"
    : "Browser";
  const platform =
    /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad/.test(ua) ? "iOS"
    : /Linux/.test(ua) ? "Linux"
    : "Unknown";
  const deviceType =
    /Mobi|Android|iPhone/.test(ua) ? "mobile"
    : /iPad|Tablet/.test(ua) ? "tablet"
    : "desktop";
  return { description: `${browser} on ${platform}`, platform, browser, deviceType };
}

async function writeSecurityEvent(input: {
  uid: string;
  type: SecurityEventType;
  title: string;
  metadata?: Record<string, string | number | boolean | null>;
  deviceDescription?: string | null;
  ipHash?: string | null;
}): Promise<void> {
  await getAdminDb().collection("login_events").add({
    uid: input.uid,
    type: input.type,
    title: input.title,
    metadata: input.metadata ?? {},
    deviceDescription: input.deviceDescription ?? null,
    ipHash: input.ipHash ?? null,
    createdAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// Account security document (account_security/{uid})
// ---------------------------------------------------------------------------

export async function getOrCreateAccountSecurity(uid: string): Promise<AccountSecurityRecord> {
  const db = getAdminDb();
  const ref = db.collection("account_security").doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    const d = snap.data() ?? {};
    return {
      uid,
      securityStatus: (d.securityStatus as AccountSecurityRecord["securityStatus"]) ?? "needs_attention",
      emailVerified: Boolean(d.emailVerified ?? false),
      phoneVerified: Boolean(d.phoneVerified ?? false),
      twoFactorEnabled: Boolean(d.twoFactorEnabled ?? false),
      twoFactorState: (d.twoFactorState as TwoFactorState) ?? "unavailable",
      twoFactorMethod: d.twoFactorMethod ? String(d.twoFactorMethod) : null,
      recoveryConfigured: Boolean(d.recoveryConfigured ?? false),
      lastPasswordChangeAt: toMillis(d.lastPasswordChangeAt),
      lastSecurityReviewAt: toMillis(d.lastSecurityReviewAt),
      accountState: (d.accountState as AccountLifecycle) ?? "active",
      createdAt: toMillis(d.createdAt),
      updatedAt: toMillis(d.updatedAt),
    };
  }

  // First access: derive honest initial state.
  const twoFactorAvailable = getTwoFactorProvider().available;
  const userSnap = await db.collection("users").doc(uid).get();
  const emailVerified = Boolean(userSnap.data()?.emailVerified ?? false);
  const record: AccountSecurityRecord = {
    uid,
    securityStatus: emailVerified ? "good" : "needs_attention",
    emailVerified,
    phoneVerified: false,
    twoFactorEnabled: false,
    twoFactorState: twoFactorAvailable ? "setup_ready" : "unavailable",
    twoFactorMethod: null,
    recoveryConfigured: false,
    lastPasswordChangeAt: null,
    lastSecurityReviewAt: null,
    accountState: "active",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const now = new Date();
  await ref.set({ ...record, createdAt: now, updatedAt: now });
  return record;
}

async function updateAccountSecurity(
  uid: string,
  patch: Partial<AccountSecurityRecord>,
): Promise<void> {
  const ref = getAdminDb().collection("account_security").doc(uid);
  await getOrCreateAccountSecurity(uid);
  await ref.update({ ...patch, updatedAt: new Date() });
}

// ---------------------------------------------------------------------------
// Session management (server-coordinated)
// ---------------------------------------------------------------------------

export interface RegisteredSession {
  sessionId: string;
  deviceId: string;
}

/**
 * Register (or refresh) the caller's session + device. Called by the client
 * after authentication; identity comes from the verified token, NOT the body.
 * The returned sessionId is the client's proof of "current session" — the
 * server re-verifies ownership on every use.
 */
export async function registerSession(input: {
  uid: string;
  deviceId?: string;
  userAgent: string;
}): Promise<RegisteredSession> {
  const db = getAdminDb();
  const now = new Date();
  const ua = describeUserAgent(input.userAgent);
  const ipHash = await hashClientIp();

  // Resolve the device record (client-supplied id is only a correlation key;
  // ownership is enforced by uid below).
  const deviceId = input.deviceId || randomUUID();
  const deviceRef = db.collection("devices").doc(`${input.uid}_${deviceId}`);
  const deviceSnap = await deviceRef.get();
  if (!deviceSnap.exists) {
    await deviceRef.set({
      uid: input.uid,
      clientDeviceId: deviceId,
      deviceName: ua.description,
      platform: ua.platform,
      browser: ua.browser,
      deviceType: ua.deviceType,
      trusted: false,
      firstSeenAt: now,
      lastSeenAt: now,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await writeAuditLog({
      actorUid: input.uid,
      action: "account.device_added",
      targetUid: input.uid,
      metadata: { deviceId },
    });
  } else {
    await deviceRef.update({ lastSeenAt: now, updatedAt: now });
  }

  // Find the live session for this device or create one.
  const live = await db
    .collection("sessions")
    .where("uid", "==", input.uid)
    .where("deviceId", "==", deviceId)
    .where("revokedAt", "==", null)
    .limit(1)
    .get();

  let sessionId: string;
  if (!live.empty) {
    const doc = live.docs[0];
    sessionId = doc.id;
    await doc.ref.update({ lastSeenAt: now, expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
  } else {
    const ref = db.collection("sessions").doc();
    sessionId = ref.id;
    await ref.set({
      uid: input.uid,
      deviceId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      revokedAt: null,
      ipHash,
      deviceDescription: ua.description,
      location: "Location unavailable", // honest — no geo-IP in this release
    });
    await writeSecurityEvent({
      uid: input.uid,
      type: "login_succeeded",
      title: "Signed in",
      deviceDescription: ua.description,
      ipHash,
    });
    await createNotification({
      uid: input.uid,
      kind: "security.new_login",
      title: "New sign-in",
      message: `Your account was accessed from ${ua.description}. If this wasn't you, review your sessions immediately.`,
    }).catch(() => undefined);
  }

  return { sessionId, deviceId };
}

/** Verify the caller owns a session; returns the record or throws. */
async function getOwnedSession(uid: string, sessionId: string): Promise<SessionRecord> {
  const snap = await getAdminDb().collection("sessions").doc(sessionId).get();
  if (!snap.exists) throw appError("not-found", "session not found");
  const d = snap.data() ?? {};
  if (String(d.uid ?? "") !== uid) throw appError("permission-denied", "not your session");
  return {
    id: snap.id,
    uid,
    deviceId: d.deviceId ? String(d.deviceId) : null,
    createdAt: toMillis(d.createdAt),
    lastSeenAt: toMillis(d.lastSeenAt),
    expiresAt: toMillis(d.expiresAt),
    revokedAt: toMillis(d.revokedAt),
    ipHash: d.ipHash ? String(d.ipHash) : null,
    deviceDescription: String(d.deviceDescription ?? ""),
    location: String(d.location ?? "Location unavailable"),
  };
}

export async function listSessions(uid: string, currentSessionId: string | null): Promise<SessionView[]> {
  const snap = await getAdminDb()
    .collection("sessions")
    .where("uid", "==", uid)
    .orderBy("lastSeenAt", "desc")
    .limit(30)
    .get();

  const now = Date.now();
  return snap.docs
    .map((d) => {
      const data = d.data();
      const revokedAt = toMillis(data.revokedAt);
      const expiresAt = toMillis(data.expiresAt);
      const live = !revokedAt && (expiresAt === null || expiresAt > now);
      return {
        id: d.id,
        deviceId: data.deviceId ? String(data.deviceId) : null,
        deviceDescription: String(data.deviceDescription ?? "Unknown device"),
        location: String(data.location ?? "Location unavailable"),
        createdAt: toMillis(data.createdAt),
        lastSeenAt: toMillis(data.lastSeenAt),
        revokedAt,
        // "Current" is resolved SERVER-side by comparing the verified
        // caller's session id — never trusted from the client.
        currentSession: Boolean(live && currentSessionId && d.id === currentSessionId),
      } satisfies SessionView;
    })
    .filter((s) => s.currentSession || (!s.revokedAt && s.lastSeenAt !== null && now - (s.lastSeenAt ?? 0) < SESSION_TTL_MS))
    .slice(0, 20);
}

export async function revokeSession(input: {
  uid: string;
  sessionId: string;
  actorUid: string;
}): Promise<void> {
  const session = await getOwnedSession(input.uid, input.sessionId);
  if (session.revokedAt) return; // idempotent

  await getAdminDb()
    .collection("sessions")
    .doc(input.sessionId)
    .update({ revokedAt: new Date() });

  await writeSecurityEvent({
    uid: input.uid,
    type: "session_revoked",
    title: "Session revoked",
    metadata: { sessionId: input.sessionId },
    deviceDescription: session.deviceDescription,
  });
  await writeAuditLog({
    actorUid: input.actorUid,
    action: "account.session_revoked",
    targetUid: input.uid,
    metadata: { sessionId: input.sessionId },
  });

  // Revoking the CURRENT session = signing out here: tell the client.
  if (input.sessionId === input.actorUid) {
    // handled by caller (client clears local state)
  }
}

/** Revoke every live session except (optionally) the caller's current one. */
export async function revokeAllSessions(input: {
  uid: string;
  exceptSessionId: string | null;
  actorUid: string;
}): Promise<number> {
  const db = getAdminDb();
  const snap = await db
    .collection("sessions")
    .where("uid", "==", input.uid)
    .where("revokedAt", "==", null)
    .limit(50)
    .get();

  const now = Date.now();
  const targets = snap.docs.filter((d) => {
    if (input.exceptSessionId && d.id === input.exceptSessionId) return false;
    const exp = toMillis(d.data().expiresAt);
    return exp === null || exp > now;
  });
  if (targets.length === 0) return 0;

  const batch = db.batch();
  for (const d of targets) batch.update(d.ref, { revokedAt: new Date() });
  await batch.commit();

  await writeSecurityEvent({
    uid: input.uid,
    type: "sessions_revoked",
    title: "Signed out other sessions",
    metadata: { count: targets.length },
  });
  await writeAuditLog({
    actorUid: input.actorUid,
    action: "account.sessions_revoked",
    targetUid: input.uid,
    metadata: { count: targets.length },
  });
  return targets.length;
}

// ---------------------------------------------------------------------------
// Devices (server-coordinated registry; extends the Prompt-1 registry)
// ---------------------------------------------------------------------------

export async function listDevices(uid: string, currentDeviceId: string | null): Promise<DeviceView[]> {
  const snap = await getAdminDb()
    .collection("devices")
    .where("uid", "==", uid)
    .orderBy("lastSeenAt", "desc")
    .limit(30)
    .get();

  // Count live sessions per device in one targeted query (no N+1).
  const sessionsSnap = await getAdminDb()
    .collection("sessions")
    .where("uid", "==", uid)
    .where("revokedAt", "==", null)
    .limit(50)
    .get();
  const now = Date.now();
  const liveByDevice = new Map<string, number>();
  for (const d of sessionsSnap.docs) {
    const exp = toMillis(d.data().expiresAt);
    if (exp !== null && exp <= now) continue;
    const key = String(d.data().deviceId ?? "");
    liveByDevice.set(key, (liveByDevice.get(key) ?? 0) + 1);
  }

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      uid,
      deviceName: String(data.deviceName ?? "Unknown device"),
      platform: String(data.platform ?? ""),
      browser: String(data.browser ?? ""),
      deviceType: (data.deviceType as ManagedDevice["deviceType"]) ?? "desktop",
      trusted: Boolean(data.trusted ?? false),
      firstSeenAt: toMillis(data.firstSeenAt),
      lastSeenAt: toMillis(data.lastSeenAt),
      revokedAt: toMillis(data.revokedAt),
      createdAt: toMillis(data.createdAt),
      updatedAt: toMillis(data.updatedAt),
      // Current resolved server-side from the caller's registered device.
      current: Boolean(currentDeviceId && String(data.clientDeviceId ?? "") === currentDeviceId),
      activeSessions: liveByDevice.get(String(data.clientDeviceId ?? "")) ?? 0,
    } satisfies DeviceView;
  });
}

async function getOwnedDevice(uid: string, deviceId: string): Promise<ManagedDevice> {
  const snap = await getAdminDb().collection("devices").doc(deviceId).get();
  if (!snap.exists) throw appError("not-found", "device not found");
  const d = snap.data() ?? {};
  if (String(d.uid ?? "") !== uid) throw appError("permission-denied", "not your device");
  return {
    id: deviceId,
    uid,
    deviceName: String(d.deviceName ?? "Unknown device"),
    platform: String(d.platform ?? ""),
    browser: String(d.browser ?? ""),
    deviceType: (d.deviceType as ManagedDevice["deviceType"]) ?? "desktop",
    trusted: Boolean(d.trusted ?? false),
    firstSeenAt: toMillis(d.firstSeenAt),
    lastSeenAt: toMillis(d.lastSeenAt),
    revokedAt: toMillis(d.revokedAt),
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}

export async function renameDevice(input: {
  uid: string;
  deviceId: string;
  deviceName: string;
}): Promise<void> {
  const name = input.deviceName.trim().slice(0, 60);
  if (!name) throw appError("invalid-data", "device name is required");
  await getOwnedDevice(input.uid, input.deviceId);
  await getAdminDb().collection("devices").doc(input.deviceId).update({
    deviceName: name,
    updatedAt: new Date(),
  });
  await writeSecurityEvent({
    uid: input.uid,
    type: "device_renamed",
    title: "Device renamed",
    metadata: { deviceId: input.deviceId },
  });
  await writeAuditLog({
    actorUid: input.uid,
    action: "account.device_renamed",
    targetUid: input.uid,
    metadata: { deviceId: input.deviceId },
  });
}

export async function setDeviceTrusted(input: {
  uid: string;
  deviceId: string;
  trusted: boolean;
}): Promise<void> {
  await getOwnedDevice(input.uid, input.deviceId);
  await getAdminDb().collection("devices").doc(input.deviceId).update({
    trusted: input.trusted,
    updatedAt: new Date(),
  });
}

/** Revoke the device's sessions and mark the device removed (record kept). */
export async function removeDevice(input: { uid: string; deviceId: string }): Promise<void> {
  const device = await getOwnedDevice(input.uid, input.deviceId);
  const db = getAdminDb();
  const clientDeviceId = String(
    (await db.collection("devices").doc(input.deviceId).get()).data()?.clientDeviceId ?? "",
  );

  const snap = await db
    .collection("sessions")
    .where("uid", "==", input.uid)
    .where("deviceId", "==", clientDeviceId)
    .where("revokedAt", "==", null)
    .limit(50)
    .get();
  const batch = db.batch();
  for (const d of snap.docs) batch.update(d.ref, { revokedAt: new Date() });
  batch.update(db.collection("devices").doc(input.deviceId), {
    revokedAt: new Date(),
    updatedAt: new Date(),
  });
  await batch.commit();

  await writeSecurityEvent({
    uid: input.uid,
    type: "device_removed",
    title: "Device removed",
    metadata: { deviceId: input.deviceId },
    deviceDescription: device.deviceName,
  });
  await writeAuditLog({
    actorUid: input.uid,
    action: "account.device_removed",
    targetUid: input.uid,
    metadata: { deviceId: input.deviceId },
  });
}

// ---------------------------------------------------------------------------
// Security activity (login_events) — paginated read
// ---------------------------------------------------------------------------

export async function listSecurityActivity(
  uid: string,
  limit = 25,
  cursor?: string,
): Promise<{ events: SecurityEvent[]; nextCursor: string | null }> {
  let query = getAdminDb()
    .collection("login_events")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(Math.min(limit, 50));
  if (cursor) {
    const c = await getAdminDb().collection("login_events").doc(cursor).get();
    if (c.exists) query = query.startAfter(c);
  }
  const snap = await query.get();
  const events = snap.docs.map((d) => ({
    id: d.id,
    uid,
    type: (d.data().type as SecurityEventType) ?? "security_updated",
    title: String(d.data().title ?? "Security event"),
    metadata: (d.data().metadata ?? {}) as SecurityEvent["metadata"],
    deviceDescription: d.data().deviceDescription ? String(d.data().deviceDescription) : null,
    ipHash: d.data().ipHash ? String(d.data().ipHash) : null,
    createdAt: toMillis(d.data().createdAt),
  }));
  return {
    events,
    nextCursor: events.length >= Math.min(limit, 50) ? events[events.length - 1].id : null,
  };
}

// ---------------------------------------------------------------------------
// Notification & privacy preferences
// ---------------------------------------------------------------------------

const DEFAULT_NOTIFICATION_PREFS: Omit<NotificationPreferences, "uid" | "updatedAt"> = {
  securityNewLogin: true, // mandatory — cannot be disabled
  securitySessionChanges: true,
  securityChanges: true,
  identityKycUpdates: true,
  connectivityEsimActivation: true,
  connectivityEsimStatus: true,
  numberActivation: true,
  numberRelease: true,
  billingPayments: true,
  billingInvoices: true,
  billingRefunds: true,
  billingSubscriptionChanges: true,
  marketingProductNews: false,
};

export async function getNotificationPreferences(uid: string): Promise<NotificationPreferences> {
  const snap = await getAdminDb().collection("notification_preferences").doc(uid).get();
  if (!snap.exists) {
    return { uid, ...DEFAULT_NOTIFICATION_PREFS, updatedAt: null };
  }
  const d = snap.data() ?? {};
  return {
    uid,
    // Mandatory keys are always forced on, regardless of stored value.
    securityNewLogin: true,
    securitySessionChanges: d.securitySessionChanges !== false,
    securityChanges: d.securityChanges !== false,
    identityKycUpdates: d.identityKycUpdates !== false,
    connectivityEsimActivation: d.connectivityEsimActivation !== false,
    connectivityEsimStatus: d.connectivityEsimStatus !== false,
    numberActivation: d.numberActivation !== false,
    numberRelease: d.numberRelease !== false,
    billingPayments: d.billingPayments !== false,
    billingInvoices: d.billingInvoices !== false,
    billingRefunds: d.billingRefunds !== false,
    billingSubscriptionChanges: d.billingSubscriptionChanges !== false,
    marketingProductNews: d.marketingProductNews === true,
    updatedAt: toMillis(d.updatedAt),
  };
}

export async function updateNotificationPreferences(
  uid: string,
  patch: Partial<Omit<NotificationPreferences, "uid" | "updatedAt">>,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(uid);
  // Security-critical preference is mandatory and can never be disabled.
  const merged: NotificationPreferences = {
    ...current,
    ...patch,
    uid,
    securityNewLogin: true,
    updatedAt: Date.now(),
  };
  await getAdminDb()
    .collection("notification_preferences")
    .doc(uid)
    .set({ ...merged, updatedAt: new Date() }, { merge: true });

  await writeSecurityEvent({
    uid,
    type: "notification_preferences_updated",
    title: "Notification preferences updated",
  });
  await writeAuditLog({
    actorUid: uid,
    action: "account.notification_preferences_updated",
    targetUid: uid,
    metadata: { keys: Object.keys(patch) },
  });
  return merged;
}

const DEFAULT_PRIVACY: Omit<PrivacySettings, "uid" | "updatedAt"> = {
  productCommunications: true,
  marketingCommunications: false,
};

export async function getPrivacySettings(uid: string): Promise<PrivacySettings> {
  const snap = await getAdminDb().collection("privacy_settings").doc(uid).get();
  if (!snap.exists) return { uid, ...DEFAULT_PRIVACY, updatedAt: null };
  const d = snap.data() ?? {};
  return {
    uid,
    productCommunications: d.productCommunications !== false,
    marketingCommunications: d.marketingCommunications === true,
    updatedAt: toMillis(d.updatedAt),
  };
}

export async function updatePrivacySettings(
  uid: string,
  patch: Partial<Omit<PrivacySettings, "uid" | "updatedAt">>,
): Promise<PrivacySettings> {
  const merged: PrivacySettings = {
    ...(await getPrivacySettings(uid)),
    ...patch,
    uid,
    updatedAt: Date.now(),
  };
  await getAdminDb()
    .collection("privacy_settings")
    .doc(uid)
    .set({ ...merged, updatedAt: new Date() }, { merge: true });

  await writeSecurityEvent({
    uid,
    type: "privacy_updated",
    title: "Privacy settings updated",
  });
  await writeAuditLog({
    actorUid: uid,
    action: "account.privacy_updated",
    targetUid: uid,
    metadata: { keys: Object.keys(patch) },
  });
  return merged;
}

// ---------------------------------------------------------------------------
// Security-status maintenance (called after password change etc.)
// ---------------------------------------------------------------------------

export async function recordPasswordChanged(uid: string): Promise<void> {
  await getOrCreateAccountSecurity(uid);
  await updateAccountSecurity(uid, { lastPasswordChangeAt: Date.now(), securityStatus: "good" });
  const ipHash = await hashClientIp();
  await writeSecurityEvent({
    uid,
    type: "password_changed",
    title: "Password changed",
    ipHash,
  });
  await writeAuditLog({
    actorUid: uid,
    action: "account.password_changed",
    targetUid: uid,
    metadata: {},
  });
  await createNotification({
    uid,
    kind: "security.password_changed",
    title: "Password changed",
    message: "Your OneNumbr password was changed. If this wasn't you, secure your account immediately.",
  }).catch(() => undefined);
}

export async function recordSecurityReview(uid: string): Promise<void> {
  await getOrCreateAccountSecurity(uid);
  await updateAccountSecurity(uid, { lastSecurityReviewAt: Date.now() });
}

// ---------------------------------------------------------------------------
// Account lifecycle (safe: records preserved, access locked)
// ---------------------------------------------------------------------------

export async function deactivateAccount(input: { uid: string; actorUid: string }): Promise<void> {
  await getOrCreateAccountSecurity(input.uid);
  await getAdminDb().collection("account_security").doc(input.uid).update({
    accountState: "deactivated",
    updatedAt: new Date(),
  });
  // Lock access: revoke every session.
  await revokeAllSessions({ uid: input.uid, exceptSessionId: null, actorUid: input.actorUid });

  await writeSecurityEvent({
    uid: input.uid,
    type: "account_deactivated",
    title: "Account deactivated",
  });
  await writeAuditLog({
    actorUid: input.actorUid,
    action: "account.deactivation_requested",
    targetUid: input.uid,
    metadata: { state: "deactivated" },
  });
  await createNotification({
    uid: input.uid,
    kind: "account.deactivation_requested",
    title: "Account deactivated",
    message: "Your account has been deactivated. Sign in to reactivate it. Your records are preserved.",
  }).catch(() => undefined);
}

export async function requestAccountDeletion(input: { uid: string; actorUid: string }): Promise<void> {
  await getOrCreateAccountSecurity(input.uid);
  await getAdminDb().collection("account_security").doc(input.uid).update({
    accountState: "deletion_requested",
    updatedAt: new Date(),
  });
  await revokeAllSessions({ uid: input.uid, exceptSessionId: null, actorUid: input.actorUid });

  await writeSecurityEvent({
    uid: input.uid,
    type: "deletion_requested",
    title: "Account deletion requested",
  });
  await writeAuditLog({
    actorUid: input.actorUid,
    action: "account.deletion_requested",
    targetUid: input.uid,
    metadata: {
      note: "Invoices, payments, KYC and audit records are retained per compliance requirements.",
    },
  });
  await createNotification({
    uid: input.uid,
    kind: "account.deletion_requested",
    title: "Deletion request submitted",
    message: "Your deletion request has been submitted. Invoices, payments and audit records are retained as required; personal access is locked.",
  }).catch(() => undefined);
}

export async function reactivateAccount(input: { uid: string; actorUid: string }): Promise<void> {
  await getOrCreateAccountSecurity(input.uid);
  await getAdminDb().collection("account_security").doc(input.uid).update({
    accountState: "active",
    updatedAt: new Date(),
  });
  await writeAuditLog({
    actorUid: input.actorUid,
    action: "account.security_updated",
    targetUid: input.uid,
    metadata: { change: "reactivated" },
  });
}

// ---------------------------------------------------------------------------
// Unified account summary — one call for the dashboard (free-tier friendly)
// ---------------------------------------------------------------------------

export async function getAccountSummary(uid: string, currentSessionId: string | null): Promise<AccountSummary> {
  const db = getAdminDb();

  // Parallel targeted reads — one per domain, no collection scans.
  const [userSnap, profileSnap, idSnap, kycSnap, security, sessions, devices] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("profiles").doc(uid).get(),
    db.collection("onenumbr_ids").doc(uid).get(),
    db.collection("kyc").doc(uid).get(),
    getOrCreateAccountSecurity(uid),
    db.collection("sessions").where("uid", "==", uid).where("revokedAt", "==", null).limit(20).get(),
    listDevices(uid, null),
  ]);

  const kycState: IdentityState = kycSnap.exists
    ? deriveIdentityState(mapKycDoc(uid, kycSnap.data() ?? {}))
    : "not_verified";

  // Latest active number (existing number_assignments data — no duplication).
  const numberSnap = await db
    .collection("number_assignments")
    .where("uid", "==", uid)
    .where("status", "==", "active")
    .limit(1)
    .get();
  let number: AccountSummary["number"] = null;
  if (!numberSnap.empty) {
    const a = numberSnap.docs[0].data();
    const numSnap = await db.collection("numbers").doc(String(a.numberId ?? "")).get();
    const n = numSnap.data();
    number = {
      numberId: String(a.numberId ?? ""),
      displayNumber: String(a.displayNumber ?? n?.displayNumber ?? ""),
      status: String(n?.status ?? "active"),
      capabilities: (n?.capabilities as string[]) ?? ["SMS", "VOICE"],
    };
  }

  // Latest ready/active eSIM.
  const esimSnap = await db
    .collection("esims")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();
  const activeEsim = esimSnap.docs.map((d) => d.data()).find((e) => e.status === "ready" || e.status === "active");
  let esim: AccountSummary["esim"] = null;
  if (activeEsim) {
    esim = {
      esimId: String(activeEsim.id ?? ""),
      flag: String(activeEsim.flag ?? ""),
      countryName: String(activeEsim.countryName ?? ""),
      planName: String(activeEsim.planName ?? ""),
      status: String(activeEsim.status ?? ""),
    };
  }

  // Latest payment.
  const paySnap = await db
    .collection("payments")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  const lastPay = paySnap.empty ? null : paySnap.docs[0].data();

  // Global Plan status (Prompt 13): derived from the number-sourced
  // subscription — same source of truth as the entitlements engine.
  const planSnap = await db
    .collection("subscriptions")
    .where("uid", "==", uid)
    .where("source", "==", "number")
    .limit(10)
    .get();
  const planSub = planSnap.empty
    ? null
    : planSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
        .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0))[0];
  const planStatusRaw = planSub ? String(planSub.status ?? "") : "";
  const planStatus: AccountSummary["plan"]["status"] =
    planSub === null
      ? number
        ? "active" // legacy bridge: number without subscription still carries the plan
        : "none"
      : planStatusRaw === "active" || planStatusRaw === "trialing"
        ? "active"
        : planStatusRaw === "past_due"
          ? "past_due"
          : planStatusRaw === "paused"
            ? "paused"
            : "cancelled";

  const now = Date.now();
  const liveSessions = sessions.docs.filter((d) => {
    const exp = toMillis(d.data().expiresAt);
    return exp === null || exp > now;
  });

  const currentDevice = devices.find((d) => d.current) ?? devices.find((d) => !d.revokedAt) ?? null;

  const emailVerified = Boolean(userSnap.data()?.emailVerified ?? security.emailVerified);

  return {
    profile: {
      fullName: String(profileSnap.data()?.fullName ?? ""),
      email: String(userSnap.data()?.email ?? ""),
      emailVerified,
    },
    onenumbrId: idSnap.exists ? String(idSnap.data()?.onenumbr ?? "") || null : null,
    kycState,
    number,
    esim,
    billing: {
      lastPaymentAt: toMillis(lastPay?.createdAt),
      lastPaymentDescription: lastPay ? String(lastPay.description ?? "") : null,
      lastPaymentStatus: lastPay ? String(lastPay.status ?? "") : null,
    },
    plan: {
      status: planStatus,
      name: planSub ? String((planSub.planSnapshot as Record<string, unknown> | undefined)?.planName ?? "OneNumbr Global Plan") : "OneNumbr Global Plan",
    },
    security: {
      emailVerified,
      twoFactorState: security.twoFactorState,
      securityStatus: emailVerified ? security.securityStatus : "needs_attention",
      activeSessionCount: liveSessions.length,
      lastActivityAt: liveSessions.length
        ? Math.max(...liveSessions.map((d) => toMillis(d.data().lastSeenAt) ?? 0))
        : null,
    },
    device: currentDevice
      ? { deviceId: currentDevice.id, deviceName: currentDevice.deviceName }
      : null,
    accountState: security.accountState,
  };
}
