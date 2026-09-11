// =============================================================================
// OneNumbr — Identity service (OneNumbr ID allocation)
//
// The OneNumbr ID is the user's permanent identity identifier (ON-XXXXXX).
// It is NOT a telecom number. The format lives in this file only so the
// numbering scheme can change later without touching any other code.
//
// Server-side allocation:
//   1. Atomically reserve a slot in `system/onenumbr_id_alloc` (transaction).
//   2. Deterministic base-N candidate derived from the slot.
//   3. Uniqueness enforced by a unique-key collection written in the same
//      transaction — a collision rolls the slot forward and retries.
//
// Clients never generate IDs. They call POST /api/onboarding/generate-id.
// =============================================================================

import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/firebase/admin";
import { appError } from "@/lib/errors";
import type { OneNumbrIdRecord, OneNumbrIdStatus } from "@/types";

const ID_PREFIX = "ON-";
const ID_DIGITS = 6;
// Base-31 alphabet: unambiguous, human-readable, uppercase (no 0/1/I/O).
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const MAX_RETRY = 20;

// Firestore doc holding the monotonically increasing allocation counter.
const ALLOC_DOC = "system/onenumbr_id_alloc";

/** Internal — format a numeric slot into an ON-XXXXXX candidate. */
export function formatOneNumbrId(slot: number): string {
  let n = slot;
  let out = "";
  for (let i = 0; i < ID_DIGITS; i++) {
    out = ALPHABET[n % ALPHABET.length] + out;
    n = Math.floor(n / ALPHABET.length);
  }
  return ID_PREFIX + out;
}

/** Internal — inverse of formatOneNumbrId (admin/debug tooling). */
export function parseOneNumbrId(id: string): number {
  let n = 0;
  for (const ch of id.replace(ID_PREFIX, "")) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) return -1;
    n = n * ALPHABET.length + idx;
  }
  return n;
}

/**
 * Allocate a brand-new OneNumbr ID for a user, server-side.
 * Transactional: allocation counter + unique key are written together so two
 * concurrent requests can never receive the same ID, and a pre-existing ID
 * (collision) rolls the counter forward and retries.
 */
export async function allocateOneNumbrId(uid: string): Promise<OneNumbrIdRecord> {
  if (!uid) throw appError("invalid-data", "allocateOneNumbrId: missing uid");

  const adb = getAdminDb();
  const allocRef = adb.doc(ALLOC_DOC);
  const idDocRef = adb.collection("onenumbr_ids").doc(uid);

  return adb.runTransaction(async (tx) => {
    // 1. Read + bump the allocation counter.
    const allocSnap = await tx.get(allocRef);
    let slot = allocSnap.exists
      ? Number((allocSnap.data() as { counter?: number })?.counter ?? 0)
      : 0;

    let onenumbr = "";
    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      const candidate = formatOneNumbrId(slot);

      // 2. Check the unique-key collection for collisions.
      const keyQuery = await adb
        .collection("onenumbr_id_keys")
        .where("onenumbr", "==", candidate)
        .limit(1)
        .get();

      if (keyQuery.empty) {
        onenumbr = candidate;
        break;
      }
      // 3. Collision — roll forward and retry.
      slot += 1;
    }

    if (!onenumbr) {
      throw appError("server", "allocateOneNumbrId: exhausted retries");
    }

    const now = new Date();

    // 4. Write the user's ID document and the unique key atomically.
    tx.set(idDocRef, {
      uid,
      onenumbr,
      status: "active" as OneNumbrIdStatus,
      createdAt: now,
      updatedAt: now,
    });
    tx.set(adb.collection("onenumbr_id_keys").doc(onenumbr), {
      onenumbr,
      uid,
      createdAt: now,
    });
    // 5. Persist the bumped counter (slot + 1 past the issued ID).
    const slotAfter = parseOneNumbrId(onenumbr) + 1;
    tx.set(allocRef, { counter: slotAfter }, { merge: true });

    return {
      uid,
      onenumbr,
      status: "active" as OneNumbrIdStatus,
      createdAt: now.getTime(),
      updatedAt: now.getTime(),
    };
  });
}

/** Read a user's OneNumbr ID record (server-side). */
export async function getOneNumbrIdRecord(
  uid: string,
): Promise<OneNumbrIdRecord | null> {
  const adb = getAdminDb();
  const snap = await adb.collection("onenumbr_ids").doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown> | undefined;
  if (!data) return null;
  return {
    uid: String(data.uid ?? uid),
    onenumbr: String(data.onenumbr ?? ""),
    status: (data.status as OneNumbrIdStatus) ?? "active",
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as { toMillis(): number }).toMillis();
  }
  return null;
}
