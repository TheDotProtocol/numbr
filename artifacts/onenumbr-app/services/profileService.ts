// =============================================================================
// OneNumbr — Profile service (client-side access to profiles/{uid})
// =============================================================================

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { getFirebaseDb } from "@/firebase/client";
import { toAppError } from "@/lib/errors";
import type { ProfileRecord } from "@/types";

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  return null;
}

export function mapProfileDocument(id: string, data: DocumentData): ProfileRecord {
  return {
    uid: String(data.uid ?? id),
    fullName: String(data.fullName ?? ""),
    country: String(data.country ?? ""),
    phone: String(data.phone ?? ""),
    avatarUrl: String(data.avatarUrl ?? ""),
    timezone: String(data.timezone ?? ""),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

/** Create profiles/{uid} during onboarding profile setup. */
export async function createProfile(
  uid: string,
  input: { fullName: string; country: string; phone?: string; timezone?: string },
): Promise<ProfileRecord> {
  const ref = doc(getFirebaseDb(), "profiles", uid);
  const now = serverTimestamp();
  try {
    await setDoc(ref, {
      uid,
      fullName: input.fullName,
      country: input.country,
      phone: input.phone ?? "",
      avatarUrl: "",
      timezone: input.timezone ?? "",
      createdAt: now,
      updatedAt: now,
    });
    return {
      uid,
      fullName: input.fullName,
      country: input.country,
      phone: input.phone ?? "",
      avatarUrl: "",
      timezone: input.timezone ?? "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  } catch (err) {
    throw toAppError(err);
  }
}

/** Read profiles/{uid}. */
export async function getProfile(uid: string): Promise<ProfileRecord | null> {
  try {
    const snap = await getDoc(doc(getFirebaseDb(), "profiles", uid));
    if (!snap.exists()) return null;
    return mapProfileDocument(snap.id, snap.data());
  } catch (err) {
    throw toAppError(err);
  }
}

/** Editable fields only — uid/role/status/identity are never touched here. */
export async function updateProfile(
  uid: string,
  patch: Partial<Pick<ProfileRecord, "fullName" | "country" | "phone" | "timezone" | "avatarUrl">>,
): Promise<void> {
  try {
    await updateDoc(doc(getFirebaseDb(), "profiles", uid), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw toAppError(err);
  }
}

export const profileService = {
  createProfile,
  getProfile,
  updateProfile,
};
