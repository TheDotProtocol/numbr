// =============================================================================
// GET /api/admin/support — paginated, filterable ticket queue (admin/support).
// =============================================================================

import { NextResponse } from "next/server";
import { jsonError, getApiIdentity } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { requireStaff } from "@/lib/admin-server";
import { listAdminTickets } from "@/lib/support-server";
import { TICKET_CATEGORY_OPTIONS, type TicketPriority, type TicketStatus } from "@/types/support";

const STATUSES = ["open", "in_progress", "waiting_for_customer", "waiting_for_provider", "resolved", "closed", "all", "open_work"];
const PRIORITIES = ["low", "normal", "high", "urgent", "all"];

export async function GET(req: Request) {
  try {
    await requireStaff();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "open_work";
    const category = url.searchParams.get("category") ?? "all";
    const priority = url.searchParams.get("priority") ?? "all";
    const assignedTo = url.searchParams.get("assignedTo") ?? "all";
    const search = url.searchParams.get("search") ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(50, Math.max(10, Number(url.searchParams.get("pageSize") ?? "20") || 20));

    if (!STATUSES.includes(status) || !PRIORITIES.includes(priority)) {
      return NextResponse.json({ code: "invalid_data", message: "Invalid filter." }, { status: 400 });
    }
    if (!TICKET_CATEGORY_OPTIONS.some((c) => c.value === category) && category !== "all") {
      return NextResponse.json({ code: "invalid_data", message: "Invalid category filter." }, { status: 400 });
    }

    const result = await listAdminTickets({
      status: status as TicketStatus | "all" | "open_work",
      category: category as Parameters<typeof listAdminTickets>[0]["category"],
      priority: priority as TicketPriority | "all",
      assignedTo,
      search,
      page,
      pageSize,
    });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
