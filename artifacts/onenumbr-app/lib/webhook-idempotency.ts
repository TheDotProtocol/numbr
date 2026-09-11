// =============================================================================
// OneNumbr — Durable webhook idempotency (Prompt 17)
//
// Prompt 15 used an in-memory Set for provider event dedup. That is sufficient
// for a single warm process but NOT for production scale: serverless instances
// recycle, multiple instances do not share memory, and provider retries across
// instances would defeat the dedup.
//
// This module defines the DURABLE idempotency interface and a Firestore-backed
// implementation used by the real provider integration. Design rules:
//
//   - Reuses the existing Admin SDK singleton (no new infrastructure).
//   - One small document per processed provider event, TTL-pruned.
//   - `claimEvent` is the single atomic entry point: it returns true exactly
//     once per provider event id; every concurrent/retried call returns false.
//   - TTL pruning uses a bounded query (Firebase free-tier friendly) and is
//     invoked opportunistically on claim — no polling loops, no listeners.
//
// Collection: `provider_webhook_dedup/{eventId}` — server-only writes; the
// firestore.rules update denies all client access (Prompt 10 model).
//
// DURABLE WEBHOOK IDEMPOTENCY REQUIRED BEFORE PRODUCTION SCALE: this module is
// that durable layer. The in-memory set in lib/webhooks-server.ts remains as a
// fast pre-filter; this store is the authoritative cross-instance guarantee.
// =============================================================================

import { getAdminDb } from "@/firebase/admin";

const COLLECTION = "provider_webhook_dedup";
/** How long a dedup record is kept. Providers retry within minutes/hours, not
 *  months; 14 days is generous and keeps the collection bounded. */
const RECORD_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** Safety cap on the number of expired docs deleted per opportunistic sweep. */
const PRUNE_BATCH = 50;

export type ClaimResult = {
  /** True exactly once per eventId across all instances/retries. */
  claimed: boolean;
  /** When this event was first processed (claimed === false only). */
  firstProcessedAt: number | null;
};

/**
 * Atomically claim a provider event id for processing.
 *
 * Returns { claimed: true } the first time an eventId is seen; every later
 * call (retry, duplicate delivery, another instance) returns
 * { claimed: false, firstProcessedAt } so the caller can acknowledge the
 * webhook without reprocessing.
 */
export async function claimProviderEvent(eventId: string): Promise<ClaimResult> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(eventId);
  const now = new Date();

  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      return false;
    }
    tx.create(ref, {
      eventId,
      createdAt: now,
      expiresAt: new Date(Date.now() + RECORD_TTL_MS),
    });
    return true;
  });

  if (claimed) {
    // Opportunistic, bounded prune — never blocks the hot path on failure.
    void pruneExpiredEvents().catch(() => undefined);
  }

  return {
    claimed,
    firstProcessedAt: claimed ? null : Date.now(),
  };
}

/** Delete expired dedup records (bounded batch; explicit operation only). */
export async function pruneExpiredEvents(): Promise<number> {
  const db = getAdminDb();
  const snap = await db
    .collection(COLLECTION)
    .where("expiresAt", "<", new Date())
    .limit(PRUNE_BATCH)
    .get();

  if (snap.empty) return 0;

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
  return snap.size;
}

// ---------------------------------------------------------------------------
// Idempotent operation keys (provision/release/send/initiate)
// ---------------------------------------------------------------------------

/**
 * Claim an idempotency key for a provider OPERATION (not just webhooks) —
 * e.g. `sms_send:{uid}:{localId}`. Same atomic guarantee as claimProviderEvent
 * so provider retries never create duplicate numbers/messages/calls.
 */
export async function claimProviderOperation(operationKey: string): Promise<ClaimResult> {
  return claimProviderEvent(`op:${operationKey}`);
}
