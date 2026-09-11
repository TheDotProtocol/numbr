// =============================================================================
// /api/admin/esim/data — orders & eSIMs for the admin console.
//   GET                          → recent orders + esims (joined emails)
//   GET?orderId=… / ?esimId=…    → detail
//   POST { orderId, action: "retry_provisioning" }
// =============================================================================

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import {
  getUserEsim,
  getUserOrder,
  listAllEsims,
  listAllOrders,
  provisionOrder,
} from "@/lib/esim-server";
import { writeAuditLog } from "@/lib/audit-server";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");
    const esimId = url.searchParams.get("esimId");

    if (orderId) {
      const db = (await import("@/firebase/admin")).getAdminDb();
      const snap = await db.collection("esim_orders").doc(orderId).get();
      if (!snap.exists) {
        return NextResponse.json({ code: "not_found", message: "Order not found." }, { status: 404 });
      }
      const order = { id: snap.id, ...snap.data() };
      let esim = null;
      const orderData = snap.data() as { esimId?: string; uid?: string } | undefined;
      const maybeEsimId = orderData?.esimId;
      if (maybeEsimId) {
        const e = await db.collection("esims").doc(maybeEsimId).get();
        if (e.exists) esim = { id: e.id, ...e.data() };
      }
      const u = await db.collection("users").doc(String(orderData?.uid ?? "")).get();
      return NextResponse.json({
        order,
        esim,
        customer: { uid: orderData?.uid, email: u.data()?.email ?? "" },
      });
    }

    if (esimId) {
      const db = (await import("@/firebase/admin")).getAdminDb();
      const snap = await db.collection("esims").doc(esimId).get();
      if (!snap.exists) {
        return NextResponse.json({ code: "not_found", message: "eSIM not found." }, { status: 404 });
      }
      const data = snap.data() as { uid?: string; orderId?: string };
      const u = await db.collection("users").doc(String(data.uid ?? "")).get();
      const o = data.orderId
        ? await db.collection("esim_orders").doc(String(data.orderId)).get()
        : null;
      return NextResponse.json({
        esim: { id: snap.id, ...snap.data() },
        customer: { uid: data.uid, email: u.data()?.email ?? "" },
        order: o && o.exists ? { id: o.id, ...o.data() } : null,
      });
    }

    const [orders, esims] = await Promise.all([listAllOrders(), listAllEsims()]);
    return NextResponse.json({ orders, esims });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await req.json().catch(() => ({}))) as {
      orderId?: string;
      action?: string;
    };

    if (body.action === "retry_provisioning" && body.orderId) {
      const db = (await import("@/firebase/admin")).getAdminDb();
      const snap = await db.collection("esim_orders").doc(body.orderId).get();
      if (!snap.exists) {
        return NextResponse.json({ code: "not_found", message: "Order not found." }, { status: 404 });
      }
      const uid = String(snap.data()?.uid ?? "");
      const order = await provisionOrder(body.orderId, uid);
      await writeAuditLog({
        actorUid: admin.uid,
        action: "esim.provisioning_started",
        targetUid: uid,
        metadata: { orderId: body.orderId, retriedByAdmin: true },
      });
      return NextResponse.json({ ok: true, orderStatus: order.orderStatus, esimId: order.esimId });
    }

    return NextResponse.json({ code: "invalid_data", message: "Unknown action." }, { status: 400 });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
