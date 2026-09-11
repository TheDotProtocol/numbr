// =============================================================================
// /api/admin/billing — admin billing console data (admin claim required).
//   GET                        → overview (aggregates)
//   GET?resource=payments      → all payments
//   GET?resource=invoices      → all invoices
//   GET?resource=subscriptions → all subscriptions
//   GET?resource=events        → billing events
//   POST { paymentId, amountMinor?, reason } → refund (confirmed in UI)
//   POST { subscriptionId, action }          → pause | cancel | resume
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError, appError } from "@/lib/errors";
import {
  getAdminBillingOverview,
  listAllBillingEvents,
  listAllInvoices,
  listAllPayments,
  listAllSubscriptions,
  refundPayment,
  setSubscriptionStatus,
} from "@/lib/billing-server";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const resource = url.searchParams.get("resource");

    if (resource === "payments") {
      return NextResponse.json({ payments: await listAllPayments() });
    }
    if (resource === "invoices") {
      return NextResponse.json({ invoices: await listAllInvoices() });
    }
    if (resource === "subscriptions") {
      return NextResponse.json({ subscriptions: await listAllSubscriptions() });
    }
    if (resource === "events") {
      return NextResponse.json({ events: await listAllBillingEvents() });
    }
    return NextResponse.json({ overview: await getAdminBillingOverview() });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

const refundSchema = z.object({
  paymentId: z.string().trim().min(1),
  amountMinor: z.number().int().positive().optional(),
  reason: z.string().trim().min(3).max(500),
});

const subActionSchema = z.object({
  subscriptionId: z.string().trim().min(1),
  action: z.enum(["pause", "cancel", "resume"]),
});

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Refund (full when amountMinor omitted).
    if ("paymentId" in body) {
      const parsed = refundSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { code: "invalid_data", message: parsed.error.issues[0]?.message ?? "Invalid refund." },
          { status: 400 },
        );
      }
      await refundPayment({
        adminUid: admin.uid,
        paymentId: parsed.data.paymentId,
        amountMinor: parsed.data.amountMinor,
        reason: parsed.data.reason,
      });
      return NextResponse.json({ ok: true });
    }

    // Subscription management.
    if ("subscriptionId" in body) {
      const parsed = subActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ code: "invalid_data", message: "Unknown action." }, { status: 400 });
      }
      // Resolve the owner uid from the subscription document.
      const { getAdminDb } = await import("@/firebase/admin");
      const snap = await getAdminDb().collection("subscriptions").doc(parsed.data.subscriptionId).get();
      const ownerUid = String(snap.data()?.uid ?? "");
      if (!ownerUid) throw appError("not-found", "subscription not found");
      const status =
        parsed.data.action === "cancel" ? "cancelled" : parsed.data.action === "pause" ? "paused" : "active";
      await setSubscriptionStatus(ownerUid, parsed.data.subscriptionId, status, admin.uid);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ code: "invalid_data", message: "Unknown action." }, { status: 400 });
  } catch (err) {
    if (err instanceof Error && /exceeds refundable|only paid/.test(err.message)) {
      return NextResponse.json({ code: "invalid_data", message: err.message }, { status: 400 });
    }
    return jsonError(toAppError(err));
  }
}
