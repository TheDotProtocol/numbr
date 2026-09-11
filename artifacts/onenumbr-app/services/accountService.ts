// =============================================================================
// OneNumbr — Account service (client-side)
//
// Session coordination: after authentication the client calls
// registerCurrentSession() once; the SERVER creates/refreshes the session +
// device records and echoes back the session id, which the client stores in
// a non-sensitive cookie so every later API call resolves "current session"
// SERVER-side. The client flag alone never grants any authority.
// =============================================================================

import { getFirebaseAuth, getFirebaseDb } from "@/firebase/client";
import { toAppError } from "@/lib/errors";
import type {
  AccountSummary,
  DeviceView,
  NotificationPreferences,
  PrivacySettings,
  SecurityEvent,
  SessionView,
} from "@/types/account";
import type { AccountSecurityRecord } from "@/types/account";
import { getOrCreateDeviceId, detectDevice } from "./sessionService";

const CLIENT_SESSION_COOKIE = "onenumbr_client_session";
const CLIENT_DEVICE_COOKIE = "onenumbr_client_device";

async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw toAppError(err);
  }
  const payload = (await res.json().catch(() => null)) as
    | (T & { code?: string; message?: string })
    | null;
  if (!res.ok) throw new Error(payload?.message ?? `Request failed (${res.status})`);
  return payload as T;
}

async function sendJson<T>(url: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw toAppError(err);
  }
  const payload = (await res.json().catch(() => null)) as
    | (T & { code?: string; message?: string })
    | null;
  if (!res.ok) throw new Error(payload?.message ?? "Request failed.");
  return payload as T;
}

/**
 * Register the current browser session with the server. Safe to call
 * repeatedly (idempotent per device). Stores the server-issued session id
 * in a cookie so subsequent API reads resolve the current session
 * server-side.
 */
export async function registerCurrentSession(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();
    const deviceId = getOrCreateDeviceId();
    const detected = detectDevice();

    const res = await fetch("/api/account/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        deviceId,
        userAgent: navigator.userAgent,
        platform: detected.platform,
        browser: detected.browser,
      }),
    });
    if (!res.ok) return; // non-critical

    const data = (await res.json()) as { sessionId: string; deviceId: string };
    // 1-year cookie so the server can resolve "current session" on every call.
    document.cookie = `${CLIENT_SESSION_COOKIE}=${data.sessionId}; path=/; max-age=31536000; samesite=lax; secure`;
    document.cookie = `${CLIENT_DEVICE_COOKIE}=${data.deviceId}; path=/; max-age=31536000; samesite=lax; secure`;
  } catch (err) {
    console.error("[OneNumbr] session registration failed:", toAppError(err).message);
  }
}

function clearClientCookies(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${CLIENT_SESSION_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${CLIENT_DEVICE_COOKIE}=; path=/; max-age=0`;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function fetchAccountSummary(): Promise<AccountSummary> {
  return getJson<AccountSummary>("/api/account");
}

export interface SecurityCenterData {
  security: AccountSecurityRecord;
  sessions: SessionView[];
  devices: DeviceView[];
  twoFactorAvailable: boolean;
}

export async function fetchSecurityCenter(): Promise<SecurityCenterData> {
  return getJson<SecurityCenterData>("/api/account/security");
}

export async function fetchSessions(): Promise<{ sessions: SessionView[] }> {
  return getJson("/api/account/sessions");
}

export async function fetchDevices(): Promise<{ devices: DeviceView[] }> {
  return getJson("/api/account/devices");
}

export async function fetchActivity(cursor?: string): Promise<{
  events: SecurityEvent[];
  nextCursor: string | null;
}> {
  return getJson(`/api/account/activity${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
}

export async function fetchNotificationPreferences(): Promise<{ preferences: NotificationPreferences }> {
  return getJson("/api/account/preferences");
}

export async function fetchPrivacySettings(): Promise<{ settings: PrivacySettings }> {
  return getJson("/api/account/privacy");
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function revokeSession(sessionId: string): Promise<void> {
  await sendJson("/api/account/sessions", "POST", { action: "revoke", sessionId });
}

/** Sign out other sessions; returns how many were revoked. */
export async function revokeOtherSessions(): Promise<number> {
  const r = await sendJson<{ revoked: number }>("/api/account/sessions", "POST", {
    action: "revoke_others",
  });
  return r.revoked;
}

/** Sign out ALL sessions (including this one). */
export async function revokeAllSessions(): Promise<void> {
  await sendJson("/api/account/sessions", "POST", { action: "revoke_all" });
  clearClientCookies();
}

export async function renameDevice(deviceId: string, deviceName: string): Promise<void> {
  await sendJson("/api/account/devices", "PATCH", { action: "rename", deviceId, deviceName });
}

export async function setDeviceTrusted(deviceId: string, trusted: boolean): Promise<void> {
  await sendJson("/api/account/devices", "PATCH", { action: "trust", deviceId, trusted });
}

/** Revoke the device's sessions and remove it from the active list. */
export async function removeDevice(deviceId: string): Promise<void> {
  await sendJson("/api/account/devices", "PATCH", { action: "remove", deviceId });
}

export async function updateNotificationPreferences(
  patch: Partial<Omit<NotificationPreferences, "uid" | "updatedAt">>,
): Promise<{ preferences: NotificationPreferences }> {
  return sendJson("/api/account/preferences", "PATCH", patch);
}

export async function updatePrivacySettings(
  patch: Partial<Omit<PrivacySettings, "uid" | "updatedAt">>,
): Promise<{ settings: PrivacySettings }> {
  return sendJson("/api/account/privacy", "PATCH", patch);
}

export type LifecycleAction = "deactivate" | "request_deletion" | "reactivate";

export async function changeLifecycle(action: LifecycleAction): Promise<{ accountState: string }> {
  const r = await sendJson<{ accountState: string }>("/api/account/lifecycle", "POST", { action });
  if (action !== "reactivate") clearClientCookies();
  return r;
}

/** Called after a successful Firebase password change (server-side event + audit). */
export async function recordPasswordChangedClient(): Promise<void> {
  await sendJson("/api/account/password-changed", "POST", {});
}
