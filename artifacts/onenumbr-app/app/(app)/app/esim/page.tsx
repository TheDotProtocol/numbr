"use client";

// =============================================================================
// /app/esim — marketplace home
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { HelpLink } from "@/components/app/HelpLink";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { fetchCatalog } from "@/services/esimService";
import { formatData, type PublicPlan } from "@/types/esim";
import { Search, Globe, SignalHigh } from "lucide-react";

export default function EsimMarketplacePage() {
  return (
    <AuthGuard>
      <MarketplaceInner />
    </AuthGuard>
  );
}

function MarketplaceInner() {
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchCatalog()
      .then(setPlans)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load marketplace."));
  }, []);

  const countries = useMemo(() => {
    if (!plans) return [];
    const map = new Map<string, { code: string; name: string; flag: string; region: string; cheapest: PublicPlan | null; count: number }>();
    for (const p of plans) {
      const entry = map.get(p.countryCode) ?? {
        code: p.countryCode,
        name: p.countryName,
        flag: p.flag,
        region: p.region,
        cheapest: null,
        count: 0,
      };
      entry.count += 1;
      if (!entry.cheapest || p.price < entry.cheapest.price) entry.cheapest = p;
      map.set(p.countryCode, entry);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [plans]);

  const filtered = useMemo(() => {
    if (!query.trim()) return countries;
    const q = query.trim().toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase() === q ||
        c.region.toLowerCase().includes(q),
    );
  }, [countries, query]);

  const featured = useMemo(
    () => (plans ?? []).filter((p) => p.featured).slice(0, 4),
    [plans],
  );

  return (
    <>
      {/* Hero */}
      <div className="glass-gold animate-fade-up rounded-2xl px-6 py-10 sm:px-10">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">OneNumbr eSIM</p>
        <h1 className="onenumbr-mark mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Stay connected wherever you go.
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Pick a destination, choose a data plan, and buy it in seconds — your
          eSIM is prepared for your device automatically. No plastic SIM, no
          shop visit.
        </p>
        <p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground">
          eSIM is one of the connectivity mechanisms underneath your OneNumbr —
          not the product itself. Your plan and number are unaffected.{" "}
          <Link href="/app/connectivity" className="text-primary hover:underline">
            About connectivity
          </Link>
        </p>
        <div className="mt-3">
          <HelpLink slug="activate-esim" label="How do I activate an eSIM?" />
        </div>
        <div className="relative mt-6 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search destinations — Japan, US, TH, Europe…"
            aria-label="Search destinations"
            className="pl-9"
          />
        </div>
      </div>

      {error ? (
        <EmptyState
          className="mt-6"
          title="Couldn't load the marketplace"
          description={error}
        />
      ) : plans === null ? (
        <Card className="mt-6">
          <CardContent>
            <LoadingState label="Loading destinations…" />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Featured plans */}
          {featured.length > 0 && !query ? (
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Featured plans
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {featured.map((p) => (
                  <Link
                    key={p.id}
                    href={`/app/esim/c/${p.countryCode.toLowerCase()}/${p.id}`}
                    className="group rounded-xl border border-primary/25 bg-primary/5 p-4 transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg">{p.flag}</span>
                      <Badge tone="gold">Featured</Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium">
                      {p.countryName} · {p.planName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatData(p.dataAmount, p.dataUnit)} · {p.durationDays} days
                    </p>
                    <p className="mt-2 text-lg font-semibold text-primary">
                      ${p.price}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* Destinations */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {query ? "Search results" : "Popular destinations"}
            </h2>
            {filtered.length === 0 ? (
              <EmptyState
                className="mt-3"
                icon={<Globe className="h-5 w-5" />}
                title="No destinations found"
                description={`Nothing matches “${query}”. Try a country name, code or region.`}
              />
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {filtered.map((c) => (
                  <Link
                    key={c.code}
                    href={`/app/esim/c/${c.code.toLowerCase()}`}
                    className="group rounded-xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{c.flag}</span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {c.count} {c.count === 1 ? "plan" : "plans"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium">{c.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      from ${c.cheapest?.price ?? "—"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground/70">
            <SignalHigh className="h-3.5 w-3.5" />
            Development catalog — plans are demo data and do not provide live
            mobile service yet.
          </p>
        </>
      )}
    </>
  );
}
