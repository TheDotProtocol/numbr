"use client";

// =============================================================================
// /app/help — Help Center
// Sections + search over the static help content module. Lightweight and
// free-tier friendly (no Firestore reads, no external service).
// =============================================================================

import { useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { SearchInput } from "@/components/ui/Controls";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ServiceStatus } from "@/components/app/ServiceStatus";
import { HELP_ARTICLES, HELP_SECTIONS } from "@/lib/help-content";
import { searchHelp } from "@/lib/help-search";

export default function HelpPage() {
  const [query, setQuery] = useState("");

  const hits = useMemo(() => searchHelp(query, 8), [query]);

  return (
    <AuthGuard>
      <PageHeader
        title="Help Center"
        description="Answers about your identity, number, eSIMs, billing and account."
        actions={
          <Link href="/app/support/new">
            <Button variant="secondary">Contact support</Button>
          </Link>
        }
      />

      <div className="max-w-2xl">
        <SearchInput
          value={query}
          onChange={setQuery}
          onClear={() => setQuery("")}
          ariaLabel="Search help articles"
          placeholder="Search help — e.g. “activate eSIM”, “invoice”, “sessions”"
        />
      </div>

      {query.trim().length >= 2 ? (
        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {hits.length} result{hits.length === 1 ? "" : "s"} for “{query.trim()}”
          </h2>
          {hits.length === 0 ? (
            <EmptyState
              title="No matching articles"
              description="Try different words — or open a support case and we'll help directly."
              action={
                <Link href="/app/support/new">
                  <Button>Contact support</Button>
                </Link>
              }
            />
          ) : (
            hits.map((h) => (
              <Link key={h.article.slug} href={`/app/help/${h.article.slug}`} className="block">
                <Card className="transition-colors hover:bg-muted/30">
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground">{h.sectionLabel}</p>
                    <p className="font-medium">{h.article.title}</p>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HELP_SECTIONS.map((s) => {
              const articles = HELP_ARTICLES.filter((a) => a.section === s.id);
              return (
                <Card key={s.id}>
                  <CardContent className="py-4">
                    <h2 className="font-medium">{s.label}</h2>
                    <p className="mb-3 text-xs text-muted-foreground">{s.blurb}</p>
                    <ul className="space-y-2">
                      {articles.map((a) => (
                        <li key={a.slug}>
                          <Link href={`/app/help/${a.slug}`} className="text-sm text-primary hover:underline">
                            {a.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-10">
            <h2 className="mb-3 text-lg font-semibold">Service status</h2>
            <ServiceStatus />
          </div>
        </>
      )}
    </AuthGuard>
  );
}
