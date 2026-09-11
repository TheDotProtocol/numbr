"use client";

// =============================================================================
// /app/number — OneNumbr Number marketplace
//
// "YOUR NUMBER. YOUR IDENTITY."
//
// Gating: identity verification (KYC) is required before a number can be
// reserved or activated. Unverified/pending users see an honest lock state
// with a CTA to complete verification — the gate is enforced again
// server-side at checkout (never bypassable from the browser).
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { HelpLink } from "@/components/app/HelpLink";
import { useKyc } from "@/hooks/useKyc";
import { deriveIdentityState } from "@/types/kyc";
import {
  fetchMyNumbers,
  searchNumbers,
  NumberApiError,
  type SearchFilters,
} from "@/services/numberService";
import type { PublicNumber } from "@/types/number";
import { Hash, Lock, Search, ShieldCheck } from "lucide-react";

export default function NumberPage() {
  return (
    <AuthGuard>
      <NumberInner />
    </AuthGuard>
  );
}

function NumberInner() {
  const { kyc, loaded: kycLoaded } = useKyc("once");
  const identityState = deriveIdentityState(kyc);
  const verified = identityState === "verified";

  const [numbers, setNumbers] = useState<PublicNumber[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<SearchFilters["type"] | "">("");
  const [capFilter, setCapFilter] = useState<SearchFilters["capability"] | "">("");
  const [activeNumber, setActiveNumber] = useState<string | null>(null);
  const [activeLoaded, setActiveLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Existing number (any assignment history) — shown above the marketplace.
  useEffect(() => {
    fetchMyNumbers()
      .then((d) => {
        setActiveNumber(d.numbers.find((n) => n.status !== "released")?.numberId ?? null);
        setActiveLoaded(true);
      })
      .catch(() => setActiveLoaded(true));
  }, []);

  const runSearch = useCallback((filters: SearchFilters) => {
    setNumbers(null);
    setError(null);
    searchNumbers(filters)
      .then((d) => setNumbers(d.numbers))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to search numbers.");
        setNumbers((prev) => prev ?? []);
      });
  }, []);

  // Debounced search — no Firestore reads per keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch({ q, type: typeFilter || undefined, capability: capFilter || undefined });
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, typeFilter, capFilter, runSearch]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Number"
        description="One identity. One number. Anywhere."
      />

      {/* Hero */}
      <div className="glass-gold animate-fade-up rounded-2xl px-6 py-10 sm:px-10">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">OneNumbr Number</p>
        <h1 className="onenumbr-mark mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Your number. Your identity.
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Choose your OneNumbr number — one permanent public identity that travels
          with your OneNumbr ID.
        </p>
      </div>

      {/* Existing active number */}
      {activeLoaded && activeNumber ? (
        <Card className="mt-6 border-primary/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">You already have a OneNumbr number</p>
                <p className="text-xs text-muted-foreground">
                  Manage it from your number detail page. Your OneNumbr ID stays yours even if
                  you ever release it.
                </p>
              </div>
            </div>
            <Link href={`/app/number/${activeNumber}`}>
              <Button variant="secondary" size="sm">
                Manage number
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {/* KYC gate */}
      {kycLoaded && !verified ? (
        <Card className="mt-6 border-warning/40">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 text-warning" />
              <div>
                <p className="text-sm font-medium">Identity verification required</p>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {identityState === "pending"
                    ? "Your verification is under review. Number activation unlocks as soon as it's approved."
                    : "Before activating a number, we need to verify your identity. This protects you and the OneNumbr network."}
                </p>
              </div>
            </div>
            {identityState === "not_verified" || identityState === "rejected" || identityState === "resubmission_required" ? (
              <Link href="/app/identity/verification/start">
                <Button>Complete verification</Button>
              </Link>
            ) : (
              <Link href="/app/identity/verification">
                <Button variant="secondary">View verification status</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Marketplace */}
      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Choose your number
          </h2>
          <HelpLink slug="how-does-number-work" label="What is a OneNumbr Number?" />
        </div>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Your OneNumbr Number is the public identity people use to reach you on
          OneNumbr — pick one that feels like yours.
        </p>

        {/* Search + filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search digits — e.g. 284"
              aria-label="Search numbers"
              className="w-56 pl-9"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as SearchFilters["type"] | "")}
            aria-label="Number type"
            className="h-10 rounded-lg border border-border bg-surface-2 px-2 text-sm"
          >
            <option value="">All types</option>
            <option value="mobile">Mobile</option>
            <option value="international">International</option>
            <option value="local">Local</option>
            <option value="toll_free">Toll-free</option>
          </select>
          <select
            value={capFilter}
            onChange={(e) => setCapFilter(e.target.value as SearchFilters["capability"] | "")}
            aria-label="Capability"
            className="h-10 rounded-lg border border-border bg-surface-2 px-2 text-sm"
          >
            <option value="">All capabilities</option>
            <option value="SMS">SMS</option>
            <option value="VOICE">Voice</option>
          </select>
        </div>

        {error ? (
          <EmptyState className="mt-4" title="Couldn't load numbers" description={error} />
        ) : numbers === null ? (
          <Card className="mt-4">
            <CardContent>
              <LoadingState label="Searching numbers…" />
            </CardContent>
          </Card>
        ) : numbers.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<Hash className="h-5 w-5" />}
            title="No numbers match your search"
            description="Try fewer digits or clear the filters — new inventory is added regularly."
          />
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {numbers.map((n) => (
              <NumberCard key={n.id} number={n} verified={verified} />
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground/70">
        <Hash className="h-3.5 w-3.5" />
        Development catalog — numbers are provisioned through the OneNumbr demo
        carrier and are not connected to the public telephone network.
      </p>
    </div>
  );
}

function NumberCard({ number, verified }: { number: PublicNumber; verified: boolean }) {
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose() {
    if (reserving) return;
    setReserving(true);
    setError(null);
    try {
      const { reserveNumber } = await import("@/services/numberService");
      await reserveNumber(number.id);
      window.location.href = `/app/number/checkout?number=${number.id}`;
    } catch (err) {
      if (err instanceof NumberApiError && err.code === "kyc_required") {
        setError("Identity verification required.");
      } else if (err instanceof NumberApiError && err.code === "number_unavailable") {
        setError("Just taken — try another number.");
      } else {
        setError(err instanceof Error ? err.message : "Reservation failed.");
      }
      setReserving(false);
    }
  }

  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardContent>
        <p className="font-mono text-lg font-semibold tracking-wider text-primary">
          {number.displayNumber}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="success">Available</Badge>
          {number.capabilities.map((c) => (
            <Badge key={c} tone="neutral">{c}</Badge>
          ))}
          <Badge tone="neutral">{number.type.replace("_", " ")}</Badge>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm">
            <span className="font-semibold">${number.monthlyPrice}</span>
            <span className="text-muted-foreground"> / month</span>
          </p>
          {verified ? (
            <Button size="sm" loading={reserving} onClick={choose}>
              Choose number
            </Button>
          ) : (
            <Link href="/app/identity/verification/start">
              <Button size="sm" variant="secondary">
                Verify to choose
              </Button>
            </Link>
          )}
        </div>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
