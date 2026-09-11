// =============================================================================
// /api/admin/number-data — orders & assignments for the admin console.
//   GET   → recent orders + assignments (joined emails)
//   POST { orderId, action: "retry_provisioning" } → admin retry
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import {
  adminRetryProvisioning,
  listAllAssignments,
  listAllNumberOrders,
} from "@/lib/number-server";

export async function GET() {
  try {
    await requireAdmin();
    const [orders, assignments] = await Promise.all([listAllNumberOrders(), listAllAssignments()]);
    return NextResponse.json({ orders, assignments });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

const actionSchema = z.object({
  orderId: z.string().trim().min(1),
  action: z.enum(["retry_provisioning"]),
});

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "invalid_data", message: "Unknown action." }, { status: 400 });
    }
    const order = await adminRetryProvisioning(parsed.data.orderId, admin.uid);
    return NextResponse.json({ ok: true, orderStatus: order.orderStatus });
  } catch (err) {
    if (err instanceof Error && /not paid/.test(err.message)) {
      return NextResponse.json(
        { code: "invalid_data", message: "Only paid orders can be retried." },
        { status: 400 },
      );
    }
    return jsonError(toAppError(err));
  }
}
