// =============================================================================
// OneNumbr — Help Center search (Prompt 7)
//
// Lightweight client-side search over the static help module. No external
// service, no Firestore reads — free-tier friendly by design.
// =============================================================================

import { HELP_ARTICLES, HELP_SECTIONS, type HelpArticle } from "@/lib/help-content";

export type HelpSearchHit = {
  article: HelpArticle;
  sectionLabel: string;
  score: number;
};

function sectionLabel(id: HelpArticle["section"]): string {
  return HELP_SECTIONS.find((s) => s.id === id)?.label ?? "Help";
}

/**
 * Simple scored search: title matches weigh most, then heading/list hits,
 * then body text. Tokens shorter than 2 chars are ignored.
 */
export function searchHelp(query: string, limit = 8): HelpSearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];

  const hits: HelpSearchHit[] = [];

  for (const article of HELP_ARTICLES) {
    let score = 0;
    const title = article.title.toLowerCase();

    for (const token of tokens) {
      if (title.includes(token)) score += 10;
      if (title.startsWith(token)) score += 4;
      for (const block of article.body) {
        switch (block.type) {
          case "h":
            if (block.text.toLowerCase().includes(token)) score += 3;
            break;
          case "list":
          case "steps":
            if (block.items.some((i) => i.toLowerCase().includes(token))) score += 2;
            break;
          case "p":
          case "note":
            if (block.text.toLowerCase().includes(token)) score += 1;
            break;
        }
      }
    }

    if (score > 0) {
      hits.push({ article, sectionLabel: sectionLabel(article.section), score });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function getHelpArticle(slug: string): HelpArticle | null {
  return HELP_ARTICLES.find((a) => a.slug === slug) ?? null;
}
