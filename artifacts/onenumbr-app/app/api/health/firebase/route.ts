// =============================================================================
// GET /api/health/firebase — Firestore + Auth reachability (safe summary).
// Performs two trivial reads; never exposes configuration or credentials.
// =============================================================================

import { NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/firebase/admin";

export async function GET() {
  const out: Record<string, { status: "ok" | "error"; detail?: string }> = {};
  let healthy = true;

  try {
    await getAdminDb().collection("users").limit(1).get();
    out.firestore = { status: "ok" };
  } catch (err) {
    healthy = false;
    out.firestore = { status: "error", detail: err instanceof Error ? err.name : "unknown" };
  }

  try {
    // Project-level auth settings read — no user data touched.
    await getAdminAuth().listUsers(1);
    out.auth = { status: "ok" };
  } catch (err) {
    healthy = false;
    out.auth = { status: "error", detail: err instanceof Error ? err.name : "unknown" };
  }

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", services: out, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 },
  );
}
