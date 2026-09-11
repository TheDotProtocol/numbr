// =============================================================================
// OneNumbr — eSIM service (client-side)
//
// Thin, typed access to the eSIM APIs. The catalog is cached per session
// (free-tier: one fetch per navigation burst, not per card render).
// =============================================================================

import { toAppError, appError } from "@/lib/errors";
import type { PublicPlan } from "@/types/esim";

let catalogCache: { at: number; plans: PublicPlan[] } | null = null;
const CATALOG_TTL_MS = 60_000;

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
    throw new Error(payload?.message ?? `Request failed (${res.status})`);
  }
  return payload as T;
}

/** Active catalog (customer-safe fields). Cached for 60s per session. */
export async function fetchCatalog(force = false): Promise<PublicPlan[]> {
  if (!force && catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) {
    return catalogCache.plans;
  }
  const data = await getJson<{ plans: PublicPlan[] }>("/api/esim/plans");
  catalogCache = { at: Date.now(), plans: data.plans };
  return data.plans;
}

export function clearCatalogCache(): void {
  catalogCache = null;
}

export interface MyOrderSummary {
  id: string;
  planSnapshot: {
    countryName: string;
    flag: string;
    planName: string;
    dataAmount: number;
    dataUnit: string;
    durationDays: number;
    total: number;
  };
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  orderStatus: string;
  provisioningStatus: string;
  esimId: string | null;
  createdAt: number | null;
}

export interface MyEsimSummary {
  id: string;
  orderId: string;
  status: string;
  countryCode: string;
  countryName: string;
  flag: string;
  planName: string;
  dataAmount: number;
  dataUnit: string;
  dataTotalMb: number;
  dataUsedMb: number;
  durationDays: number;
  activatedAt: number | null;
  expiresAt: number | null;
  createdAt: number | null;
}

export async function fetchMyEsims(): Promise<{
  orders: MyOrderSummary[];
  esims: MyEsimSummary[];
}> {
  return getJson("/api/esim/me");
}

export interface MyEsimDetail {
  esim: MyEsimSummary & {
    activationCode: string;
    qrPayload: string;
    iccid: string;
    provider: string;
    providerEsimId: string;
  };
  order: MyOrderSummary | null;
}

/** One eSIM with activation details (QR payload) — owner-checked server-side. */
export async function fetchEsimDetail(esimId: string): Promise<MyEsimDetail> {
  return getJson(`/api/esim/me?esimId=${encodeURIComponent(esimId)}`);
}

/**
 * Submit checkout. The client sends ONLY the plan id and an idempotency
 * key — never price or plan data. Returns the order/esim ids for redirect.
 */
export async function checkout(input: {
  planId: string;
  idempotencyKey: string;
}): Promise<{ orderId: string; esimId: string | null; orderStatus: string; alreadyExists: boolean }> {
  let res: Response;
  try {
    res = await fetch("/api/esim/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (err) {
    throw toAppError(err);
  }
  const payload = (await res.json().catch(() => null)) as
    | {
        ok?: true;
        orderId?: string;
        esimId?: string | null;
        orderStatus?: string;
        alreadyExists?: boolean;
        code?: string;
        message?: string;
      }
    | null;

  if (!res.ok) {
    if (payload?.code === "plan_unavailable") {
      throw appError("not-found", "plan unavailable");
    }
    if (payload?.code === "payment_failed") {
      throw new Error(payload.message ?? "Payment failed.");
    }
    throw new Error(payload?.message ?? "Checkout failed. Please try again.");
  }

  return {
    orderId: payload!.orderId!,
    esimId: payload!.esimId ?? null,
    orderStatus: payload!.orderStatus ?? "created",
    alreadyExists: Boolean(payload!.alreadyExists),
  };
}

/** Generate a fresh idempotency key per checkout session. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `chk-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
