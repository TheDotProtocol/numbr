// =============================================================================
// GET /api/help/search?q=… — lightweight search over static help content.
// =============================================================================

import { NextResponse } from "next/server";
import { searchHelp } from "@/lib/help-search";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const hits = searchHelp(q, 8).map((h) => ({
    slug: h.article.slug,
    title: h.article.title,
    section: h.article.section,
    sectionLabel: h.sectionLabel,
    updated: h.article.updated,
  }));
  return NextResponse.json({ hits });
}
