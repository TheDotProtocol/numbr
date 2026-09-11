// =============================================================================
// OneNumbr — Provider retry / backoff (Prompt 17)
//
// Safe retry behavior for real provider operations:
//   - ONLY transient / rate_limited errors are retried.
//   - Exponential backoff with full jitter, bounded attempts.
//   - Destructive / financial / identity operations are NEVER auto-retried
//     unless the caller can prove idempotency (they pass an idempotency key
//     and the operation is registered as idempotent).
//   - Never blocks forever; safe-fail returns the last error.
//
// No polling loops, no background timers — every retry happens inside an
// explicit awaited call.
// =============================================================================

import type { CloudCommunicationsErrorCategory } from "@/providers/communications/real/types";

export type RetryableErrorCategory = "transient" | "rate_limited";

export type RetryOptions = {
  /** Max attempts INCLUDING the first try. Default 3. */
  attempts?: number;
  /** Base delay in ms. Default 250. */
  baseDelayMs?: number;
  /** Max delay cap in ms. Default 4_000. */
  maxDelayMs?: number;
  /** Extra delay for rate_limited responses. Default 1_000. */
  rateLimitPenaltyMs?: number;
  /**
   * Set ONLY when the operation is idempotent (durable dedup key claimed or
   * vendor-side idempotency key). When false, no retry happens at all unless
   * the caller explicitly passes allowNonIdempotentRetry (discouraged).
   */
  idempotent: boolean;
  /** Escape hatch for legacy non-idempotent reads (e.g. status GETs). */
  allowNonIdempotentRetry?: boolean;
};

const DEFAULTS = {
  attempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
  rateLimitPenaltyMs: 1_000,
};

function isRetryable(err: unknown): err is { category: RetryableErrorCategory } {
  const category = (err as { category?: string } | null)?.category;
  return category === "transient" || category === "rate_limited";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Full-jitter exponential backoff delay for attempt n (0-based). */
export function backoffDelayMs(attempt: number, opts: RetryOptions): number {
  const base = opts.baseDelayMs ?? DEFAULTS.baseDelayMs;
  const max = opts.maxDelayMs ?? DEFAULTS.maxDelayMs;
  const exponential = Math.min(max, base * 2 ** attempt);
  // Full jitter: uniform in [0, exponential).
  const jitter = Math.random() * exponential;
  return Math.round(jitter);
}

/**
 * Run a provider operation with safe retry semantics.
 *
 * Retry rules:
 *   - attempt 1 runs always;
 *   - attempts 2..N run only when the error is transient/rate_limited AND
 *     (opts.idempotent OR opts.allowNonIdempotentRetry);
 *   - rate_limited adds an extra fixed penalty to the computed backoff;
 *   - any other error (permanent/authentication/conflict/unsupported) throws
 *     immediately.
 */
export async function withProviderRetry<T>(
  operation: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? DEFAULTS.attempts);
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const canRetry =
        attempt < attempts - 1 &&
        isRetryable(err) &&
        (opts.idempotent || opts.allowNonIdempotentRetry === true);
      if (!canRetry) break;

      let wait = backoffDelayMs(attempt, opts);
      if ((err as { category?: string }).category === "rate_limited") {
        wait += opts.rateLimitPenaltyMs ?? DEFAULTS.rateLimitPenaltyMs;
      }
      await delay(wait);
    }
  }

  throw lastError;
}

/**
 * Map a caught vendor error into the OneNumbr retry taxonomy. Adapters attach
 * `category`/`vendorCode` via CloudCommunicationsError; this helper is the
 * single normalization point for anything that slips through without one.
 */
export function normalizeProviderErrorCategory(err: unknown): CloudCommunicationsErrorCategory {
  const raw = (err as { category?: string; vendorCode?: string | null; message?: string } | null);
  const text = `${raw?.vendorCode ?? ""} ${raw?.message ?? ""}`.toLowerCase();

  if (raw?.category) return raw.category as CloudCommunicationsErrorCategory;
  if (text.includes("auth") || text.includes("unauthorized") || text.includes("forbidden")) return "authentication";
  if (text.includes("rate") || text.includes("too many") || text.includes("429")) return "rate_limited";
  if (text.includes("timeout") || text.includes("temporarily") || text.includes("unavailable") || text.includes("503") || text.includes("502")) return "transient";
  if (text.includes("already") || text.includes("duplicate") || text.includes("conflict") || text.includes("409")) return "conflict";
  if (text.includes("not supported") || text.includes("unsupported")) return "unsupported";
  return "permanent";
}
