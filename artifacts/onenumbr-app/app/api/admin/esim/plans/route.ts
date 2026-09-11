// =============================================================================
// /api/admin/esim/plans — plan management (admin claim required).
//   GET                    → full plans incl. wholesaleCost/margin
//   POST { ...plan }       → create plan
//   POST { id, ...patch }  → update plan (status/featured/pricing/…)
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { getAdminDb } from "@/firebase/admin";
import { toAppError, appError } from "@/lib/errors";
import { createPlan, mapPlan, toPublicPlan, updatePlan, type PlanEditorInput } from "@/lib/esim-server";

const planSchema = z.object({
  countryCode: z.string().trim().regex(/^[A-Z]{2}$/, "Country is required."),
  countryName: z.string().trim().min(1),
  region: z.string().trim().min(1),
  flag: z.string().trim().min(1),
  planName: z.string().trim().min(1),
  dataAmount: z.number().positive(),
  dataUnit: z.enum(["GB", "MB"]),
  durationDays: z.number().int().positive(),
  speed: z.string().trim().min(1),
  networkType: z.string().trim().min(1),
  coverage: z.string().trim().min(1),
  hotspot: z.boolean(),
  activationPolicy: z.string().trim().min(1),
  price: z.number().nonnegative(),
  currency: z.string().trim().length(3),
  wholesaleCost: z.number().nonnegative(),
  margin: z.number(),
  status: z.enum(["active", "inactive", "archived"]),
  featured: z.boolean(),
  sortOrder: z.number().int(),
});

export async function GET() {
  try {
    await requireAdmin();
    const snap = await getAdminDb()
      .collection("esim_plans")
      .orderBy("sortOrder", "asc")
      .limit(300)
      .get();
    const plans = snap.docs.map((d) => mapPlan(d.id, d.data()));
    return NextResponse.json({ plans });
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
      const parsed = planSchema.partial().safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { code: "invalid_data", message: parsed.error.issues[0]?.message ?? "Invalid plan patch." },
          { status: 400 },
        );
      }
      const plan = await updatePlan(admin.uid, body.id, parsed.data);
      return NextResponse.json({ ok: true, plan });
    }

    // Create
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: parsed.error.issues[0]?.message ?? "Invalid plan." },
        { status: 400 },
      );
    }
    const plan = await createPlan(admin.uid, parsed.data as PlanEditorInput);
    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
