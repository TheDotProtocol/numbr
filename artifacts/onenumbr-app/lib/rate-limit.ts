// =============================================================================
// OneNumbr — Centralized rate limiting (Prompt 10)
//
// Firestore-backed fixed-window limiter. One document per (scope, subject):
//
//   rate_limits/{scope}:{subject}   { count, windowStart, updatedAt }
//
// - `subject` is the verified uid (preferred) or a SHA-256 hash of the client
//   IP for pre-auth endpoints. Raw IPs are never stored.
// - Deterministic cooldowns, no CAPTCHA, no third-party service.
// - Extension point: swap `applyFirestoreWindow` for an Upstash/Redis INCR+
//   EXPIRE when multi-instance atomicity at scale is needed — the call sites
//   below must not change.
//
// Cost profile: 1 read + 1 write per check, only on deliberately rate-limited
// sensitive endpoints (not on general reads).
// =============================================================================

import { randomUUID, createHash } from "crypto";
import { headers } from "next/headers";
import { getAdminDb } from "@/firebase/admin";
import { appError } from "@/lib/errors";

export type RateLimitScope =
  | "auth" // future password-reset / token endpoints
  | "kyc_submit"
  | "support_create"
  | "support_reply"
  | "number_reserve"
  | "checkout"
  | "plan_reactivate"
  | "connectivity_provision"
  | "connectivity_lifecycle"
  | "session_register"
  | "admin_mutation"
  // Communications (Prompt 11)
  | "comm_call"
  | "comm_message"
  | "comm_routing"
  | "comm_endpoint"
  // Endpoints (Prompt 12)
  | "endpoint_register"
  | "endpoint_revoke"
  | "endpoint_activate"
  | "endpoint_routing_update";

export interface RateLimitRule {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

const RULES: Record<RateLimitScope, RateLimitRule> = {
  auth: { limit: 10, windowSeconds: 300 }, // 10 / 5 min (pre-auth placeholder)
  kyc_submit: { limit: 5, windowSeconds: 3600 }, // 5 / hour
  support_create: { limit: 5, windowSeconds: 3600 }, // spam tickets
  support_reply: { limit: 30, windowSeconds: 3600 },
  number_reserve: { limit: 20, windowSeconds: 3600 }, // reservation spam
  checkout: { limit: 10, windowSeconds: 3600 }, // repeated checkout
  plan_reactivate: { limit: 10, windowSeconds: 3600 },
  connectivity_provision: { limit: 5, windowSeconds: 3600 }, // expensive provider ops
  connectivity_lifecycle: { limit: 20, windowSeconds: 3600 }, // activate/suspend/terminate
  session_register: { limit: 60, windowSeconds: 3600 }, // client registers on auth
  admin_mutation: { limit: 120, windowSeconds: 60 }, // operator burst protection
  // Communications (Prompt 11): generous enough for real use, tight enough
  // to stop automation loops. All demo traffic runs through these too.
  comm_call: { limit: 30, windowSeconds: 3600 },
  comm_message: { limit: 60, windowSeconds: 3600 },
  comm_routing: { limit: 20, windowSeconds: 3600 },
  comm_endpoint: { limit: 20, windowSeconds: 3600 },
  // Endpoints (Prompt 12)
  endpoint_register: { limit: 10, windowSeconds: 3600 },
  endpoint_revoke: { limit: 20, windowSeconds: 3600 },
  endpoint_activate: { limit: 20, windowSeconds: 3600 },
  endpoint_routing_update: { limit: 20, windowSeconds: 3600 },
};

/**
 * Instance-local memo: a per-process sliding counter used to skip the
 * Firestore round-trip when the local count alone already exceeds the limit.
 * This is an optimization, NOT the enforcement mechanism — Firestore remains
 * authoritative so limits hold across instances.
 */
const localCounts = new Map<string, { windowStart: number; count: number }>();

function localAllows(key: string, rule: RateLimitRule): boolean {
  const now = Date.now();
  const entry = localCounts.get(key);
  if (!entry || now - entry.windowStart > rule.windowSeconds * 1000) {
    localCounts.set(key, { windowStart: now, count: 1 });
    return true;
  }
  entry.count += 1;
  // Soft-fail-open margin: rely on Firestore for the authoritative verdict.
  return entry.count <= rule.limit + 2;
}

async function applyFirestoreWindow(
  key: string,
  rule: RateLimitRule,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const db = getAdminDb();
  const ref = db.collection("rate_limits").doc(key);
  const windowMs = rule.windowSeconds * 1000;

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.data() as { count?: number; windowStart?: number } | undefined;
    const windowStart = typeof data?.windowStart === "number" ? data.windowStart : 0;
    const activeWindow = now - windowStart < windowMs;
    const count = activeWindow ? (data?.count ?? 0) + 1 : 1;
    const start = activeWindow ? windowStart : now;

    tx.set(ref, { count, windowStart: start, updatedAt: new Date() }, { merge: true });

    if (count > rule.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((start + windowMs - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  });

  return result;
}

/** Result of a rate-limit check (informational variant). */
export async function checkRateLimit(
  scope: RateLimitScope,
  subject: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number; remaining: number }> {
  const rule = RULES[scope];
  const key = `${scope}:${subject}`;
  if (!localAllows(key, rule)) {
    return { allowed: false, retryAfterSeconds: rule.windowSeconds, remaining: 0 };
  }
  const res = await applyFirestoreWindow(key, rule);
  return { ...res, remaining: Math.max(0, rule.limit - 1) };
}

/**
 * Enforce a limit; throws a typed "too many attempts" AppError that renders
 * as a calm, deterministic cooldown message via the existing error system.
 */
export async function enforceRateLimit(
  scope: RateLimitScope,
  subject: string,
): Promise<void> {
  const res = await checkRateLimit(scope, subject);
  if (!res.allowed) {
    throw appError(
      "auth/too-many-attempts",
      `rate limit hit for ${scope} (retry in ${res.retryAfterSeconds}s)`,
    );
  }
}

/** Rate-limit by the verified uid (the normal case). */
export async function enforceUserRateLimit(
  scope: RateLimitScope,
  uid: string,
): Promise<void> {
  await enforceRateLimit(scope, `uid:${uid}`);
}

/** Rate-limit pre-auth callers by a hashed client IP (privacy-safe). */
export async function enforceIpRateLimit(scope: RateLimitScope): Promise<void> {
  let ip = "";
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  } catch {
    // headers unavailable (rare); fall back to an anonymous bucket
  }
  const hash = ip
    ? createHash("sha256").update(ip).digest("hex").slice(0, 16)
    : `anon-${randomUUID().slice(0, 8)}`; // unhashable callers can't collide
  await enforceRateLimit(scope, `ip:${hash}`);
}
