// =============================================================================
// GET /api/communications — unified overview for the Communications page.
// One read path (free-tier friendly): number, plan, recent calls/messages/
// voicemails, endpoints, routing, preferences, provider honesty.
// =============================================================================

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/admin-server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { getCommunicationsOverview } from "@/lib/communications-server";
import { getFeatureFlags } from "@/lib/features";

export async function GET() {
  try {
    const identity = await requireUser();
    const flags = getFeatureFlags();
    if (!flags.communicationsEnabled) {
      return NextResponse.json(
        { code: "unavailable", message: "Communications are not available in this environment yet." },
        { status: 503 },
      );
    }
    const overview = await getCommunicationsOverview(identity.uid);
    return NextResponse.json({ overview, flags });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
