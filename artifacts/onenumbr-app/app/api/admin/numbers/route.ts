// =============================================================================
// /api/admin/numbers — inventory management (admin claim required).
//   GET                     → inventory list (paginated, status filter)
//   POST { ...number }      → create inventory number (uniqueness enforced)
//   POST { id, ...patch }   → update inventory metadata (ownership blocked)
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import {
  createInventoryNumber,
  listAllNumbers,
  updateInventoryNumber,
  type NumberEditorInput,
} from "@/lib/number-server";

const numberSchema = z.object({
  onenumbrNumber: z
    .string()
    .trim()
    .regex(/^\+\d{9,12}$/, "Use E.164 style, e.g. +1739284739"),
  providerNumber: z.string().trim().min(3),
  countryCode: z.string().trim().length(2),
  region: z.string().trim().min(1),
  type: z.enum(["mobile", "local", "toll_free", "international"]),
  capabilities: z.array(z.enum(["SMS", "VOICE", "MMS", "SIP"])).min(1),
  monthlyPrice: z.number().nonnegative(),
  currency: z.string().trim().length(3),
  provider: z.string().trim().min(1),
  status: z.enum(["available", "reserved", "provisioning", "active", "suspended", "released", "failed"]),
});

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const result = await listAllNumbers({ status, cursor });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(toAppError(err));
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));

    // Update (id present)
    if ("id" in body && typeof body.id === "string" && body.id) {
      const parsed = numberSchema.partial().safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { code: "invalid_data", message: parsed.error.issues[0]?.message ?? "Invalid patch." },
          { status: 400 },
        );
      }
      const number = await updateInventoryNumber(admin.uid, body.id, parsed.data);
      return NextResponse.json({ ok: true, number });
    }

    // Create
    const parsed = numberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: parsed.error.issues[0]?.message ?? "Invalid number." },
        { status: 400 },
      );
    }
    const number = await createInventoryNumber(admin.uid, parsed.data as NumberEditorInput);
    return NextResponse.json({ ok: true, number });
  } catch (err) {
    if (err instanceof Error && /already exists/.test(err.message)) {
      return NextResponse.json({ code: "already_exists", message: err.message }, { status: 409 });
    }
    return jsonError(toAppError(err));
  }
}
