// =============================================================================
// OneNumbr — KYC service (client-side)
//
// Owns all user-facing KYC operations: draft lifecycle, Storage uploads,
// submission, realtime status (single doc listener — free-tier friendly) and
// history. UI components never touch Firebase directly.
// =============================================================================

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  collection,
  getDocs,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { getFirebaseDb, getFirebaseStorage } from "@/firebase/client";
import { toAppError, appError } from "@/lib/errors";
import type {
  KycRecord,
  KycStatus,
  KycDocumentType,
  KycHistoryEntry,
} from "@/types/kyc";

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  const t = value as Timestamp;
  if (t && typeof t.toMillis === "function") return t.toMillis();
  return null;
}

export function mapKycSnapshot(id: string, data: Record<string, unknown>): KycRecord {
  return {
    uid: id,
    status: (data.status as KycStatus) ?? "draft",
    documentType: (data.documentType as KycDocumentType) ?? null,
    documentCountry: String(data.documentCountry ?? ""),
    documentNumber: String(data.documentNumber ?? ""),
    documentFrontPath: data.documentFrontPath ? String(data.documentFrontPath) : null,
    documentBackPath: data.documentBackPath ? String(data.documentBackPath) : null,
    selfiePath: data.selfiePath ? String(data.selfiePath) : null,
    submittedAt: toMillis(data.submittedAt),
    reviewedAt: toMillis(data.reviewedAt),
    reviewedBy: data.reviewedBy ? String(data.reviewedBy) : null,
    rejectionReason: (data.rejectionReason as string) ?? null,
    reviewerNotes: null, // never available client-side
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    attempt: Number(data.attempt ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Draft lifecycle
// ---------------------------------------------------------------------------

/** Create (or return the existing) draft case for this user. */
export async function createKycDraft(uid: string): Promise<KycRecord> {
  const ref = doc(getFirebaseDb(), "kyc", uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const existing = mapKycSnapshot(uid, snap.data());
    if (existing.status !== "draft") {
      throw appError("already-exists", "case already submitted");
    }
    return existing;
  }

  const now = serverTimestamp();
  await setDoc(ref, {
    uid,
    status: "draft" as const,
    documentType: null,
    documentCountry: "",
    documentNumber: "",
    documentFrontPath: null,
    documentBackPath: null,
    selfiePath: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    reviewerNotes: null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    uid,
    status: "draft",
    documentType: null,
    documentCountry: "",
    documentNumber: "",
    documentFrontPath: null,
    documentBackPath: null,
    selfiePath: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    reviewerNotes: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attempt: 0,
  };
}

/** Persist partial draft edits (rules allow these fields in draft only). */
export async function saveKycDraft(
  uid: string,
  patch: Partial<
    Pick<
      KycRecord,
      "documentType" | "documentCountry" | "documentNumber" | "documentFrontPath" | "documentBackPath" | "selfiePath"
    >
  >,
): Promise<void> {
  try {
    await updateDoc(doc(getFirebaseDb(), "kyc", uid), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    throw toAppError(err);
  }
}

// ---------------------------------------------------------------------------
// File uploads (Storage)
// ---------------------------------------------------------------------------

export const KYC_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const KYC_ACCEPTED_TYPES = ["image/png", "image/jpeg", "application/pdf"];

export interface UploadResult {
  path: string;
  downloadUrl: string;
}

/**
 * Upload a KYC file to the user's private scope and return its Storage path.
 * Path pattern: kyc/{uid}/{documents|selfie}/{timestamp}-{random}.{ext}
 */
export async function uploadKycFile(
  uid: string,
  file: File,
  role: "document_front" | "document_back" | "selfie",
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  if (!KYC_ACCEPTED_TYPES.includes(file.type)) {
    throw appError("invalid-data", `Unsupported file type: ${file.type || "unknown"}`);
  }
  if (file.size > KYC_MAX_FILE_BYTES) {
    throw appError("invalid-data", "File is larger than 5 MB.");
  }

  const folder = role === "selfie" ? "selfie" : "documents";
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `kyc/${uid}/${folder}/${Date.now()}-${rand}.${ext}`;

  try {
    const storageRef = ref(getFirebaseStorage(), path);
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          const pct = snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
          onProgress?.(pct);
        },
        (err) => reject(err),
        () => resolve(),
      );
    });

    const downloadUrl = await getDownloadURL(task.snapshot.ref);
    return { path, downloadUrl };
  } catch (err) {
    throw toAppError(err);
  }
}

/** Delete a previously uploaded KYC file (replace/remove flows). */
export async function deleteKycFile(path: string): Promise<void> {
  try {
    await deleteObject(ref(getFirebaseStorage(), path));
  } catch (err) {
    // Missing files are fine — removal should not hard-fail.
    const code = (err as { code?: string })?.code ?? "";
    if (code !== "storage/object-not-found") throw toAppError(err);
  }
}

// ---------------------------------------------------------------------------
// Status & submission
// ---------------------------------------------------------------------------

/** One-shot status read. */
export async function getKycStatus(uid: string): Promise<KycRecord | null> {
  try {
    const snap = await getDoc(doc(getFirebaseDb(), "kyc", uid));
    return snap.exists() ? mapKycSnapshot(uid, snap.data()) : null;
  } catch (err) {
    throw toAppError(err);
  }
}

/**
 * Realtime status listener. A single document listener per verification page
 * — deliberate and free-tier friendly (dashboard uses one-shot reads).
 */
export function observeKycStatus(
  uid: string,
  cb: (kyc: KycRecord | null) => void,
): () => void {
  return onSnapshot(
    doc(getFirebaseDb(), "kyc", uid),
    (snap) => cb(snap.exists() ? mapKycSnapshot(uid, snap.data()) : null),
    (err) => {
      console.error("[OneNumbr] kyc listener error:", err);
      cb(null);
    },
  );
}

/** Submit the verification (server-side transition via /api/kyc/submit). */
export async function submitKyc(input: {
  documentType: KycDocumentType;
  documentCountry: string;
  documentNumber: string;
  documentFrontPath: string;
  documentBackPath?: string | null;
  selfiePath: string;
}): Promise<{ ok: true; attempt: number }> {
  let res: Response;
  try {
    res = await fetch("/api/kyc/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (err) {
    throw toAppError(err);
  }
  const payload = (await res.json().catch(() => null)) as
    | { ok?: true; attempt?: number; code?: string; message?: string }
    | null;

  if (!res.ok) {
    if (payload?.code === "conflict") {
      throw appError("already-exists", "verification already in progress");
    }
    throw new Error(payload?.message ?? "Submission failed. Please try again.");
  }
  return { ok: true, attempt: payload?.attempt ?? 1 };
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

/** Read the user's own review history. */
export async function getKycHistory(uid: string): Promise<KycHistoryEntry[]> {
  try {
    const ref = collection(getFirebaseDb(), "kyc_history", uid, "entries");
    const snap = await getDocs(query(ref, orderBy("createdAt", "asc")));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        actorUid: String(data.actorUid ?? ""),
        action: data.action as KycHistoryEntry["action"],
        statusAfter: data.statusAfter as KycStatus,
        metadata: (data.metadata ?? {}) as Record<string, unknown>,
        createdAt: toMillis(data.createdAt),
      };
    });
  } catch (err) {
    throw toAppError(err);
  }
}

export const kycService = {
  createKycDraft,
  saveKycDraft,
  uploadKycFile,
  deleteKycFile,
  getKycStatus,
  observeKycStatus,
  submitKyc,
  getKycHistory,
};
