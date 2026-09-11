// =============================================================================
// OneNumbr — Session/device service
//
// Registers the current browser as a device (devices/{uid}/{deviceId}) and
// keeps a heartbeat. No advanced fingerprinting — just a stable browser+
// platform descriptor plus a random per-browser device ID.
// =============================================================================

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { getFirebaseDb } from "@/firebase/client";
import { toAppError } from "@/lib/errors";
import type { DeviceRecord } from "@/types";

const DEVICE_ID_KEY = "onenumbr_device_id";

/** Detect the current device descriptor from the browser UA. */
export function detectDevice(): {
  name: string;
  platform: string;
  browser: string;
  deviceType: DeviceRecord["deviceType"];
} {
  if (typeof navigator === "undefined") {
    return { name: "Unknown device", platform: "Unknown", browser: "Unknown", deviceType: "desktop" };
  }
  const ua = navigator.userAgent;
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
  const deviceType: DeviceRecord["deviceType"] =
    /Mobi|Android|iPhone/.test(ua) ? "mobile"
    : /iPad|Tablet/.test(ua) ? "tablet"
    : "desktop";
  return {
    name: `${browser} on ${platform}`,
    platform,
    browser,
    deviceType,
  };
}

/** Stable per-browser device id (random, stored in localStorage). */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Register/refresh the current device. Fire-and-forget safe. */
export async function heartbeatCurrentDevice(uid: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const deviceId = getOrCreateDeviceId();
    const detected = detectDevice();
    const ref = doc(getFirebaseDb(), "devices", uid, "devices", deviceId);
    const snap = await getDoc(ref);
    const now = Date.now();

    await setDoc(
      ref,
      {
        uid,
        deviceId,
        name: detected.name,
        platform: detected.platform,
        browser: detected.browser,
        deviceType: detected.deviceType,
        lastActiveAt: serverTimestamp(),
        ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );
    void now;
  } catch (err) {
    // Device heartbeat is non-critical; log and continue.
    console.error("[OneNumbr] device heartbeat failed:", toAppError(err).message);
  }
}

/** List the user's registered devices. */
export async function listDevices(uid: string): Promise<DeviceRecord[]> {
  try {
    const ref = collection(getFirebaseDb(), "devices", uid, "devices");
    const q = query(ref, orderBy("lastActiveAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: String(data.uid ?? uid),
        deviceId: String(data.deviceId ?? d.id),
        name: String(data.name ?? "Unknown device"),
        platform: String(data.platform ?? ""),
        browser: String(data.browser ?? ""),
        deviceType: (data.deviceType as DeviceRecord["deviceType"]) ?? "desktop",
        lastActiveAt: toMillis(data.lastActiveAt) ?? Date.now(),
        createdAt: toMillis(data.createdAt),
      };
    });
  } catch (err) {
    throw toAppError(err);
  }
}

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  return null;
}

export const deviceService = {
  heartbeatCurrentDevice,
  listDevices,
};
