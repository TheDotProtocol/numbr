// =============================================================================
// GET /api/esim/me          → the user's orders + eSIMs (no QR payloads)
// GET /api/esim/me?esimId=… → one eSIM incl. activation details (owner only)
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError, appError } from "@/lib/errors";
import {
  getUserEsim,
  getUserOrder,
  listUserEsims,
  listUserOrders,
} from "@/lib/esim-server";

export async function GET(req: Request) {
  try {
    const identity = await requireUser();
    const url = new URL(req.url);
    const esimId = url.searchParams.get("esimId");

    // Single eSIM with activation details (owner-checked inside).
    if (esimId) {
      const esim = await getUserEsim(identity.uid, esimId);
      const order = await getUserOrder(identity.uid, esim.orderId).catch(() => null);
      return NextResponse.json({ esim, order });
    }

    // Lists (activation codes excluded on list reads).
    const [orders, esims] = await Promise.all([
      listUserOrders(identity.uid),
      listUserEsims(identity.uid),
    ]);
    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        planSnapshot: o.planSnapshot,
        totalAmount: o.totalAmount,
        currency: o.currency,
        paymentStatus: o.paymentStatus,
        orderStatus: o.orderStatus,
        provisioningStatus: o.provisioningStatus,
        esimId: o.esimId,
        createdAt: o.createdAt,
      })),
      esims: esims.map((e) => ({
        id: e.id,
        orderId: e.orderId,
        status: e.status,
        countryCode: e.countryCode,
        countryName: e.countryName,
        flag: e.flag,
        planName: e.planName,
        dataAmount: e.dataAmount,
        dataUnit: e.dataUnit,
        dataTotalMb: e.dataTotalMb,
        dataUsedMb: e.dataUsedMb,
        durationDays: e.durationDays,
        activatedAt: e.activatedAt,
        expiresAt: e.expiresAt,
        createdAt: e.createdAt,
        // No activationCode/qrPayload in list payloads.
      })),
    });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
