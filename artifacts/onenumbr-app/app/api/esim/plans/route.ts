// =============================================================================
// GET /api/esim/plans — active catalog, customer-safe fields only.
// Query: ?country=JP  (optional filter)
// Free-tier note: this is a small catalog; the route reads it once per page
// view. Client caches per navigation entry — no repeated polling.
// =============================================================================

import { NextResponse } from "next/server";
import { getAdminDb } from "@/firebase/admin";
import { mapPlan, toPublicPlan } from "@/lib/esim-server";
import { toAppError } from "@/lib/errors";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const country = url.searchParams.get("country");

    let q = getAdminDb()
      .collection("esim_plans")
      .where("status", "==", "active")
      .orderBy("sortOrder", "asc")
      .limit(200);

    if (country) q = q.where("countryCode", "==", country.toUpperCase());

    const snap = await q.get();
    const plans = snap.docs.map((d) => toPublicPlan(mapPlan(d.id, d.data())));

    return NextResponse.json({ plans });
  } catch (err) {
    return jsonErr(toAppError(err));
  }
}

function jsonErr(err: unknown) {
  const { jsonError } = require("@/lib/api") as typeof import("@/lib/api");
  return jsonError(err);
}
