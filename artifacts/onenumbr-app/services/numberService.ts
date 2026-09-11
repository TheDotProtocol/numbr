// =============================================================================
// OneNumbr — Number service (client-side)
//
// Thin, typed access to the number APIs. The client NEVER sends price,
// status, ownership or provider data — only identifiers + idempotency keys.
// =============================================================================

import { toAppError } from "@/lib/errors";
import type { MyNumber, PublicNumber } from "@/types/number";

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
  if (!res.ok) {
    throw new NumberApiError(payload?.message ?? `Request failed (${res.status})`, payload?.code);
  }
  return payload as T;
}

/** Typed error carrying the API code (kyc_required, reservation_expired, …). */
export class NumberApiError extends Error {
  readonly code: string | undefined;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "NumberApiError";
    this.code = code;
  }
}

export interface SearchFilters {
  q?: string;
  countryCode?: string;
  type?: "mobile" | "local" | "toll_free" | "international";
  capability?: "SMS" | "VOICE" | "MMS" | "SIP";
  maxPrice?: number;
  cursor?: string;
}

export async function searchNumbers(filters: SearchFilters): Promise<{
  numbers: PublicNumber[];
  nextCursor: string | null;
}> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.countryCode) params.set("countryCode", filters.countryCode);
  if (filters.type) params.set("type", filters.type);
  if (filters.capability) params.set("capability", filters.capability);
  if (filters.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));
  if (filters.cursor) params.set("cursor", filters.cursor);
  const qs = params.toString();
  return getJson(`/api/number/search${qs ? `?${qs}` : ""}`);
}

export interface MyNumbersResponse {
  numbers: MyNumber[];
  identityState: "not_verified" | "pending" | "verified" | "rejected" | "resubmission_required";
}

/** My numbers + derived identity state (single read, gates the UI). */
export async function fetchMyNumbers(): Promise<MyNumbersResponse> {
  return getJson<MyNumbersResponse>("/api/number/me");
}

export async function fetchNumberDetail(numberId: string): Promise<{
  number: MyNumber;
  identityState: MyNumbersResponse["identityState"];
}> {
  return getJson(`/api/number/me?numberId=${encodeURIComponent(numberId)}`);
}

/** Reserve a number for checkout (15-minute server-side hold). */
export async function reserveNumber(
  numberId: string,
): Promise<{ reservationExpiresAt: number }> {
  return postJson("/api/number/reserve", { numberId });
}

export interface CheckoutResult {
  orderId: string;
  numberId: string;
  orderStatus: string;
  alreadyExists: boolean;
}

/**
 * Submit checkout. The client sends ONLY { numberId, idempotencyKey } —
 * never price or number data. Throws NumberApiError with code
 * `kyc_required` when identity verification is missing.
 */
export async function checkoutNumber(input: {
  numberId: string;
  idempotencyKey: string;
}): Promise<CheckoutResult> {
  return postJson("/api/number/checkout", input);
}

export async function releaseNumber(numberId: string): Promise<void> {
  await postJson("/api/number/release", { numberId });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw toAppError(err);
  }
  const payload = (await res.json().catch(() => null)) as
    | (T & { code?: string; message?: string })
    | null;
  if (!res.ok) {
    throw new NumberApiError(payload?.message ?? "Request failed.", payload?.code);
  }
  return payload as T;
}

/** Generate a fresh idempotency key per checkout session. */
export function newNumberIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `nchk-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
