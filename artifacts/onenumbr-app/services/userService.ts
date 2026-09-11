// =============================================================================
// OneNumbr — User service (client-side Firestore access to users/{uid})
//
// Note on rules: the client may create users/{uid} with explicit defaults
// (role: "user", status: "active") — the rules verify the shape but the client
// cannot choose arbitrary values. Role/status changes go through
// /api/admin routes only (Admin SDK bypasses rules; claims gate admin).
// =============================================================================

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  type DocumentData,
} from "firebase/firestore";
import { getFirebaseDb } from "@/firebase/client";
import { toAppError } from "@/lib/errors";
import type { AccountStatus, UserRecord, UserRole } from "@/types";

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  return null;
}

export function mapUserDocument(id: string, data: DocumentData): UserRecord {
  return {
    uid: String(data.uid ?? id),
    email: String(data.email ?? ""),
    role: (data.role as UserRole) ?? "user",
    status: (data.status as AccountStatus) ?? "active",
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    lastLoginAt: toMillis(data.lastLoginAt),
  };
}

/** Create users/{uid} after sign-up (defaults enforced by security rules). */
export async function createUserRecord(
  uid: string,
  email: string,
): Promise<UserRecord> {
  const ref = doc(getFirebaseDb(), "users", uid);
  const now = serverTimestamp();
  const record = {
    uid,
    email,
    role: "user" as const,
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
  try {
    await setDoc(ref, record);
    return {
      uid,
      email,
      role: "user",
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastLoginAt: Date.now(),
    };
  } catch (err) {
    throw toAppError(err);
  }
}

/** Read users/{uid}. */
export async function getUserRecord(uid: string): Promise<UserRecord | null> {
  try {
    const snap = await getDoc(doc(getFirebaseDb(), "users", uid));
    if (!snap.exists()) return null;
    return mapUserDocument(snap.id, snap.data());
  } catch (err) {
    throw toAppError(err);
  }
}

/** Update lastLoginAt (rules allow this field for self). */
export async function touchLastLogin(uid: string): Promise<void> {
  try {
    await updateDoc(doc(getFirebaseDb(), "users", uid), {
      lastLoginAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal; login should not fail because of telemetry.
  }
}

/** Update the account email copy in Firestore after a auth email change. */
export async function updateUserEmail(uid: string, email: string): Promise<void> {
  try {
    await updateDoc(doc(getFirebaseDb(), "users", uid), {
      email,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw toAppError(err);
  }
}

/**
 * Admin-side listing is server-only (claims-protected route). The client
 * service intentionally exposes no role/status mutation — those flows go
 * through /api/admin/*.
 */
export const userService = {
  createUserRecord,
  getUserRecord,
  touchLastLogin,
  updateUserEmail,
};
