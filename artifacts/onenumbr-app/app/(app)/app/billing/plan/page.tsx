"use client";

// =============================================================================
// /app/billing/plan — OneNumbr Global Plan detail (Prompt 13)
//
// ONE PLAN. ONE NUMBER. ANYWHERE.
// Everything renders from the server-derived EntitlementsView — no client
// authority over plan state, prices or entitlements. Demo entitlements are
// labeled honestly; coming-soon entitlements are never actionable.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton, EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/Feedback";
import { fetchMyPlan, reactivatePlan } from "@/services/planService";
import type { EntitlementsView } from "@/types/plan";
import { formatMinor } from "@/types/billing";

export default function PlanPage() {
  return (
    <AuthGuard>
      <PlanInner />
    </AuthGuard>
  );
}

function PlanInner() {
  const [view, setView] = useState<EntitlementsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchMyPlan()
      .then(setView)
      .catch((err) => setError(err instanceof Error ? err.message : "We couldn't load your plan."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function reactivate() {
    setBusy(true);
    setError(null);
    try {
      await reactivatePlan();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't reactivate your plan.");
    } finally {
      setBusy(false);
    }
  }

  const plan = view?.plan ?? null;
  const canReactivate =
    plan !== null && (plan.status === "paused" || plan.status === "cancelled") && plan.subscriptionId !== null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Your plan"
        description="One plan. One number. Anywhere."
      />

      {error ? <ErrorState title="Something went wrong" description={error} /> : null}

      {view === null && !error ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}

      {plan ? (
        <div className="space-y-4">
          {/* Plan hero */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your OneNumbr plan</p>
                  <h2 className="mt-1 text-2xl font-semibold text-foreground">{plan.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.priceMinor !== null && plan.currency
                      ? `${formatMinor(plan.priceMinor, plan.currency)} / month · demo billing — no real charges`
                      : "Demo billing — no real charges"}
                    {plan.currentPeriodEnd
                      ? ` · current period ends ${new Date(plan.currentPeriodEnd).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={plan.status} />
                  {plan.demoProvider ? <StatusBadge status="demo" /> : null}
                </div>
              </div>
              {canReactivate ? (
                <div className="mt-4">
                  <Button size="sm" onClick={reactivate} disabled={busy}>
                    Reactivate plan
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your OneNumbr ID and number were never affected — reactivating restores your plan benefits.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Identity anchor — the constant */}
          <Card>
            <CardHeader>
              <CardTitle>Your OneNumbr</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">OneNumbr ID</p>
                <p className="mt-0.5 font-mono text-sm text-primary">{view?.usage.oneNumbrId ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Permanent — never changes</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your number</p>
                <p className="mt-0.5 font-mono text-sm text-primary">{view?.usage.primaryNumber ?? "No number yet"}</p>
                <p className="text-xs text-muted-foreground">Stays yours across endpoints and countries</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Connected endpoints</p>
                <p className="mt-0.5 text-sm text-foreground">{view?.usage.activeEndpoints ?? 0} active</p>
                <p className="text-xs text-muted-foreground">One number, many places to be reached</p>
              </div>
            </CardContent>
          </Card>

          {/* Entitlements */}
          <Card>
            <CardHeader>
              <CardTitle>Your Global benefits</CardTitle>
            </CardHeader>
            <CardContent>
              {view && view.entitlements.length > 0 ? (
                <ul className="divide-y divide-border/40">
                  {view.entitlements.map((e) => (
                    <li key={e.key} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{e.label}</p>
                        {e.note ? <p className="text-xs text-muted-foreground">{e.note}</p> : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {e.entitled ? (
                          <span className="text-xs text-success" aria-label="Included">
                            ✓
                          </span>
                        ) : null}
                        <StatusBadge
                          status={
                            e.availability === "coming_soon"
                              ? "coming_soon"
                              : e.entitled
                                ? e.availability === "demo"
                                  ? "demo_capability"
                                  : "active"
                                : "unavailable"
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No plan yet"
                  description="Your Global Plan benefits appear here once your OneNumbr Number is active."
                />
              )}
              <div className="mt-4 rounded-lg border border-border px-4 py-3">
                <p className="text-sm font-medium text-foreground">Global connectivity</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Included with your plan. Cloud today — eSIM, carriers and SIM can come later. The underlying
                  connectivity can evolve without changing your OneNumbr.{" "}
                  <Link href="/app/connectivity" className="text-primary hover:underline">
                    View connectivity
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
