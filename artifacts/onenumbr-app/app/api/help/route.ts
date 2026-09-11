// =============================================================================
// GET /api/help            — Help Center index (sections + articles)
// GET /api/help/search     — lightweight search over static help content
//
// Content is static (lib/help-content.ts) — no Firestore reads, no external
// search service. This route exists so a future CMS can slot in behind the
// same contract.
// =============================================================================

import { NextResponse } from "next/server";
import { HELP_ARTICLES, HELP_SECTIONS } from "@/lib/help-content";
import { searchHelp } from "@/lib/help-search";

export async function GET() {
  return NextResponse.json({
    sections: HELP_SECTIONS,
    articles: HELP_ARTICLES.map((a) => ({
      slug: a.slug,
      section: a.section,
      title: a.title,
      updated: a.updated,
    })),
  });
}
