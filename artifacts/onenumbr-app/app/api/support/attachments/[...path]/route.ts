// =============================================================================
// GET /api/support/attachments/<path..> — resolve a short-lived signed URL for
// a private attachment. Customers: own files only. Staff: any customer file
// (verified staff claim required). No permanent or public URLs exist.
// =============================================================================

import { NextResponse } from "next/server";
import { getApiIdentity, jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { requireStaff } from "@/lib/admin-server";
import { getAttachmentUrl } from "@/lib/support-server";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const identity = await getApiIdentity();
    if (!identity) return NextResponse.json({ code: "unauthorized", message: "Authentication required." }, { status: 401 });

    const { path } = await params;
    const storagePath = path.map(decodeURIComponent).join("/");

    let staff = false;
    if (identity.role === "admin" || identity.role === "support") {
      await requireStaff();
      staff = true;
    }

    const url = await getAttachmentUrl(identity.uid, storagePath, { staff });
    return NextResponse.json({ url });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
