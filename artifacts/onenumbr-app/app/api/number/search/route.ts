// =============================================================================
// /api/number/search — public (signed-in) inventory search.
// GET ?q=&countryCode=&type=&capability=&maxPrice=&limit=&cursor=
//
// Server-side filtering only; the client never queries the collection.
// Returns customer-safe projections (no reservation internals, no provider
// number references).
// =============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { searchAvailableNumbers } from "@/lib/number-server";

const querySchema = z.object({
  q: z.string().trim().max(20).optional(),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/).optional(),
  type: z.enum(["mobile", "local", "toll_free", "international"]).optional(),
  capability: z.enum(["SMS", "VOICE", "MMS", "SIP"]).optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  cursor: z.string().trim().optional(),
});

export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "invalid_data", message: "Invalid search parameters." },
        { status: 400 },
      );
    }
    const result = await searchAvailableNumbers({
      q: parsed.data.q,
      countryCode: parsed.data.countryCode,
      type: parsed.data.type,
      capability: parsed.data.capability,
      maxPrice: parsed.data.maxPrice,
      limit: parsed.data.limit,
      cursor: parsed.data.cursor,
    });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
