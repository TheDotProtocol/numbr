"use client";

// =============================================================================
// /app/help/[slug] — help article renderer for the static content module.
// =============================================================================

import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { HELP_SECTIONS, type HelpBlock } from "@/lib/help-content";
import { getHelpArticle } from "@/lib/help-search";

export default function HelpArticlePage() {
  const params = useParams<{ slug: string }>();
  const article = getHelpArticle(params.slug);

  if (!article) {
    return (
      <AuthGuard>
        <EmptyState
          title="Article not found"
          description="This help article doesn't exist."
          action={
            <Link href="/app/help">
              <Button variant="secondary">Back to Help Center</Button>
            </Link>
          }
        />
      </AuthGuard>
    );
  }

  const sectionLabel = HELP_SECTIONS.find((s) => s.id === article.section)?.label ?? "Help";

  return (
    <AuthGuard>
      <PageHeader title={article.title} description={`${sectionLabel} · Updated ${article.updated}`} />

      <Card className="max-w-3xl">
        <CardContent className="space-y-4 py-6">
          {article.body.map((block: HelpBlock, i: number) => {
            switch (block.type) {
              case "h":
                return (
                  <h2 key={i} className="pt-2 text-lg font-semibold">
                    {block.text}
                  </h2>
                );
              case "p":
                return (
                  <p key={i} className="text-sm leading-relaxed">
                    {block.text}
                  </p>
                );
              case "list":
                return (
                  <ul key={i} className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                    {block.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                );
              case "steps":
                return (
                  <ol key={i} className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
                    {block.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ol>
                );
              case "note":
                return (
                  <div key={i} className="rounded-lg border border-gold/40 bg-gold/5 px-4 py-3 text-sm">
                    {block.text}
                  </div>
                );
            }
          })}

          <div className="flex flex-wrap gap-3 border-t border-border/50 pt-4">
            <Link href="/app/support/new">
              <Button variant="secondary">This didn't help — contact support</Button>
            </Link>
            <Link href="/app/help">
              <Button variant="ghost">Back to Help Center</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthGuard>
  );
}
