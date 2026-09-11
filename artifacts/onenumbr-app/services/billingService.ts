// =============================================================================
// OneNumbr — Billing service (client-side)
//
// Thin, typed access to the billing APIs. The client never sends amounts,
// statuses, or ownership — only identifiers and confirmed actions.
// =============================================================================

import { toAppError } from "@/lib/errors";
import type {
  InvoiceRecord,
  PaymentRecord,
  SubscriptionRecord,
} from "@/types/billing";

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
  if (!res.ok) throw new Error(payload?.message ?? `Request failed (${res.status})`);
  return payload as T;
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
  if (!res.ok) throw new Error(payload?.message ?? "Request failed.");
  return payload as T;
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export interface BillingOverviewData {
  payments: PaymentRecord[];
  invoices: InvoiceRecord[];
  subscriptions: SubscriptionRecord[];
  paymentMethod: { id: string; label: string; provider: string; isDefault: boolean };
}

export async function fetchBillingOverview(): Promise<BillingOverviewData> {
  return getJson<BillingOverviewData>("/api/billing/overview");
}

export async function fetchPayments(): Promise<{ payments: PaymentRecord[] }> {
  return getJson("/api/billing/payments");
}

export async function fetchPayment(id: string): Promise<{ payment: PaymentRecord }> {
  return getJson(`/api/billing/payments?id=${encodeURIComponent(id)}`);
}

export async function fetchInvoices(): Promise<{ invoices: InvoiceRecord[] }> {
  return getJson("/api/billing/invoices");
}

export async function fetchInvoice(id: string): Promise<{ invoice: InvoiceRecord }> {
  return getJson(`/api/billing/invoices?id=${encodeURIComponent(id)}`);
}

export async function fetchSubscriptions(): Promise<{ subscriptions: SubscriptionRecord[] }> {
  return getJson("/api/billing/subscriptions");
}

export type SubscriptionAction = "cancel" | "pause" | "resume";

export async function changeSubscription(
  id: string,
  action: SubscriptionAction,
): Promise<void> {
  await postJson("/api/billing/subscriptions", { id, action });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminBillingOverview {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  refundedPayments: number;
  activeSubscriptions: number;
  revenueMinor: number;
  refundedMinor: number;
}

export type AdminBillingResource = "payments" | "invoices" | "subscriptions" | "events";

export async function fetchAdminBilling<T>(resource: AdminBillingResource | null): Promise<T> {
  return getJson<T>(`/api/admin/billing${resource ? `?resource=${resource}` : ""}`);
}

export async function adminRefund(input: {
  paymentId: string;
  amountMinor?: number;
  reason: string;
}): Promise<void> {
  await postJson("/api/admin/billing", input);
}

export async function adminChangeSubscription(
  subscriptionId: string,
  action: SubscriptionAction,
): Promise<void> {
  await postJson("/api/admin/billing", { subscriptionId, action });
}
