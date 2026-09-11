"use client";

// =============================================================================
// /app/esim/c/[country] — plans for a destination (sort + filter + compare)
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchCatalog } from "@/services/esimService";
import { formatData, type PublicPlan } from "@/types/esim";
import { cx } from "@/lib/cx";
import { Scale, SearchX } from "lucide-react";

type SortKey = "recommended" | "price" | "data" | "duration";

export default function CountryPlansPage() {
  return (
    <AuthGuard>
      <CountryInner />
    </AuthGuard>
  );
}

function CountryInner() {
  const params = useParams<{ country: string }>();
  const countryCode = (params.country ?? "").toUpperCase();
  const countrySlug = params.country ?? "";

  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("recommended");
  const [minData, setMinData] = useState(0); // GB
  const [maxDuration, setMaxDuration] = useState(0); // 0 = any
  const [compare, setCompare] = useState<string[]>([]);

  useEffect(() => {
    fetchCatalog()
      .then(setPlans)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load plans."));
  }, []);

  const countryPlans = useMemo(() => (plans ?? []).filter((p) => p.countryCode === countryCode), [plans, countryCode]);

  const sorted = useMemo(() => {
    const list = [...countryPlans].filter(
      (p) =>
        (minData === 0 || gb(p) >= minData) &&
        (maxDuration === 0 || p.durationDays <= maxDuration),
    );
    switch (sort) {
      case "price":
        return list.sort((a, b) => a.price - b.price);
      case "data":
        return list.sort((a, b) => gb(b) - gb(a));
      case "duration":
        return list.sort((a, b) => b.durationDays - a.durationDays);
      default:
        return list.sort(
          (a, b) => Number(b.featured) - Number(a.featured) || a.price - b.price,
        );
    }
  }, [countryPlans, sort, minData, maxDuration]);

  const meta = countryPlans[0];
  const comparePlans = sorted.filter((p) => compare.includes(p.id));

  if (error) return <EmptyState title="Couldn't load plans" description={error} />;
  if (plans === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading plans…" />
        </CardContent>
      </Card>
    );
  }
  if (countryPlans.length === 0) {
    return (
      <EmptyState
        icon={<SearchX className="h-5 w-5" />}
        title="No available plans"
        description={`We don't have plans for ${countrySlug} yet. Check back soon.`}
        action={
          <Link href="/app/esim">
            <Button variant="secondary">Back to marketplace</Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title={`${meta?.flag ?? ""} ${meta?.countryName ?? countrySlug}`}
        description="Available eSIM plans"
      />

      {/* Sort + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <SortPills sort={sort} setSort={setSort} />
        <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
        <FilterPills
          minData={minData}
          setMinData={setMinData}
          maxDuration={maxDuration}
          setMaxDuration={setMaxDuration}
        />
        {compare.length > 0 ? (
          <span className="ml-auto text-muted-foreground">
            Comparing {compare.length} —{" "}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setCompare([])}
            >
              clear
            </button>
          </span>
        ) : null}
      </div>

      {/* Comparison table */}
      {comparePlans.length >= 2 ? <ComparisonTable plans={comparePlans} /> : null}

      {/* Plan cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            countrySlug={countrySlug}
            selected={compare.includes(p.id)}
            onToggleCompare={() =>
              setCompare((prev) =>
                prev.includes(p.id)
                  ? prev.filter((x) => x !== p.id)
                  : prev.length >= 3
                    ? prev
                    : [...prev, p.id],
              )
            }
          />
        ))}
      </div>
    </>
  );
}

function gb(p: PublicPlan): number {
  return p.dataUnit === "GB" ? p.dataAmount : p.dataAmount / 1024;
}

function SortPills({ sort, setSort }: { sort: SortKey; setSort: (s: SortKey) => void }) {
  const keys: { key: SortKey; label: string }[] = [
    { key: "recommended", label: "Recommended" },
    { key: "price", label: "Price" },
    { key: "data", label: "Data" },
    { key: "duration", label: "Duration" },
  ];
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sort plans">
      {keys.map((k) => (
        <button
          key={k.key}
          type="button"
          aria-pressed={sort === k.key}
          onClick={() => setSort(k.key)}
          className={cx(
            "rounded-full border px-3 py-1 transition-colors",
            sort === k.key
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}

function FilterPills({
  minData,
  setMinData,
  maxDuration,
  setMaxDuration,
}: {
  minData: number;
  setMinData: (v: number) => void;
  maxDuration: number;
  setMaxDuration: (v: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter plans">
      {[0, 5, 10, 20].map((v) => (
        <button
          key={`data-${v}`}
          type="button"
          aria-pressed={minData === v}
          onClick={() => setMinData(v)}
          className={cx(
            "rounded-full border px-3 py-1 transition-colors",
            minData === v
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {v === 0 ? "Any data" : `${v}GB+`}
        </button>
      ))}
      {[0, 7, 15, 30].map((v) => (
        <button
          key={`dur-${v}`}
          type="button"
          aria-pressed={maxDuration === v}
          onClick={() => setMaxDuration(v)}
          className={cx(
            "rounded-full border px-3 py-1 transition-colors",
            maxDuration === v
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {v === 0 ? "Any length" : `≤ ${v} days`}
        </button>
      ))}
    </div>
  );
}

function PlanCard({
  plan,
  countrySlug,
  selected,
  onToggleCompare,
}: {
  plan: PublicPlan;
  countrySlug: string;
  selected: boolean;
  onToggleCompare: () => void;
}) {
  return (
    <div
      className={cx(
        "flex flex-col rounded-xl border p-4 transition-colors",
        selected ? "border-primary/60 bg-primary/5" : "border-border bg-card/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{plan.planName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {plan.networkType} {plan.hotspot ? "· Hotspot" : ""}
          </p>
        </div>
        {plan.featured ? <Badge tone="gold">Featured</Badge> : null}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{formatData(plan.dataAmount, plan.dataUnit)}</span>
        <span className="text-xs text-muted-foreground">{plan.durationDays} days</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{plan.coverage}</p>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xl font-semibold text-primary">${plan.price}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Compare"
            aria-label={`Compare ${plan.planName}`}
            aria-pressed={selected}
            onClick={onToggleCompare}
            className={cx(
              "rounded-md border p-2 transition-colors",
              selected
                ? "border-primary/60 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Scale className="h-3.5 w-3.5" />
          </button>
          <Link href={`/app/esim/c/${countrySlug}/${plan.id}`}>
            <Button size="sm">Choose plan</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ComparisonTable({ plans }: { plans: PublicPlan[] }) {
  const rows: { label: string; render: (p: PublicPlan) => string }[] = [
    { label: "Price", render: (p) => `$${p.price}` },
    { label: "Data", render: (p) => formatData(p.dataAmount, p.dataUnit) },
    { label: "Duration", render: (p) => `${p.durationDays} days` },
    { label: "Speed", render: (p) => p.speed },
    { label: "Hotspot", render: (p) => (p.hotspot ? "Yes" : "No") },
    { label: "Coverage", render: (p) => p.coverage },
  ];
  return (
    <Card className="mb-4 animate-fade-up">
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60">
              <th className="px-4 py-2.5 text-left text-xs uppercase tracking-wider text-muted-foreground">
                Compare
              </th>
              {plans.map((p) => (
                <th key={p.id} className="px-4 py-2.5 text-left text-xs font-medium">
                  {p.flag} {p.planName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                  {r.label}
                </td>
                {plans.map((p) => (
                  <td key={p.id} className="px-4 py-2">
                    {r.render(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
