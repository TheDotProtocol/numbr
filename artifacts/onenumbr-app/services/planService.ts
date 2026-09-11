// =============================================================================
// OneNumbr — Global Plan client service (Prompt 13)
// =============================================================================

import type { EntitlementsView } from "@/types/plan";

/** Resolve the owner's Global Plan + entitlements (server-derived truth). */
export async function fetchMyPlan(): Promise<EntitlementsView> {
  const res = await fetch("/api/billing/plan", { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "We couldn't load your plan.");
  }
  return (await res.json()) as EntitlementsView;
}

/** Reactivate a paused/cancelled plan (owner action; server-authoritative). */
export async function reactivatePlan(): Promise<{ ok: boolean; plan: EntitlementsView["plan"] }> {
  const res = await fetch("/api/billing/plan", { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as { message?: string; ok?: boolean; plan?: EntitlementsView["plan"] };
  if (!res.ok) {
    throw new Error(body.message ?? "We couldn't reactivate your plan.");
  }
  return { ok: Boolean(body.ok), plan: body.plan! };
}
