"use client";

// =============================================================================
// /app/esim/c/[country]/[plan] — plan detail
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { fetchCatalog } from "@/services/esimService";
import { formatData, type PublicPlan } from "@/types/esim";
import { ShieldCheck } from "lucide-react";

export default function PlanDetailPage() {
  return (
    <AuthGuard>
      <PlanDetailInner />
    </AuthGuard>
  );
}

function PlanDetailInner() {
  const params = useParams<{ country: string; plan: string }>();
  const router = useRouter();
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCatalog()
      .then(setPlans)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load plan."));
  }, []);

  const plan = useMemo(
    () => (plans ?? []).find((p) => p.id === params.plan) ?? null,
    [plans, params.plan],
  );

  if (error) return <EmptyState title="Couldn't load plan" description={error} />;
  if (plans === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading plan…" />
        </CardContent>
      </Card>
    );
  }
  if (!plan) {
    return (
      <EmptyState
        title="Plan unavailable"
        description="This plan no longer exists or has been removed."
        action={
          <Link href={`/app/esim/c/${params.country}`}>
            <Button variant="secondary">View available plans</Button>
          </Link>
        }
      />
    );
  }

  const facts: [string, string][] = [
    ["Data", formatData(plan.dataAmount, plan.dataUnit)],
    ["Validity", `${plan.durationDays} days`],
    ["Network", plan.networkType],
    ["Speed", plan.speed],
    ["Coverage", plan.coverage],
    ["Hotspot", plan.hotspot ? "Supported" : "Not supported"],
    ["Activation policy", plan.activationPolicy],
    ["Installation", "QR code — iPhone or Android"],
  ];

  return (
    <>
      <nav className="mb-4 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/app/esim" className="hover:text-primary">Marketplace</Link>
        <span className="mx-1.5">/</span>
        <Link href={`/app/esim/c/${params.country}`} className="hover:text-primary">
          {plan.flag} {plan.countryName}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{plan.planName}</span>
      </nav>

      <div className="glass-gold animate-fade-up rounded-2xl px-6 py-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {plan.flag} {plan.countryName}
            </p>
            <h1 className="onenumbr-mark mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {plan.planName}
            </h1>
          </div>
          <div className="text-right">
            <p className="gold-gradient-text text-4xl font-bold">${plan.price}</p>
            <p className="text-xs text-muted-foreground">
              {formatData(plan.dataAmount, plan.dataUnit)} · {plan.durationDays} days
            </p>
          </div>
        </div>
        {plan.featured ? (
          <div className="mt-3">
            <Badge tone="gold">Featured plan</Badge>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Plan details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {facts.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b border-border/40 py-2.5 last:border-0"
              >
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {label}
                </span>
                <span className="text-right text-sm">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Important terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              Validity starts when the eSIM is activated on your device, not at
              purchase ({plan.activationPolicy}).
            </p>
            <p>Data allowance is for the validity period; unused data does not roll over.</p>
            <p>
              Development notice: this catalog contains demo plans. Provisioned
              eSIMs are clearly marked as demo and do not connect to a live
              mobile network yet.
            </p>
            <p className="flex items-center gap-1.5 text-foreground/80">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Secure checkout — demo payment in this release.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-4 mt-6 rounded-xl border border-border bg-surface/90 p-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              {formatData(plan.dataAmount, plan.dataUnit)} · {plan.durationDays} days
            </p>
            <p className="text-xs text-muted-foreground">Total ${plan.price} · taxes included</p>
          </div>
          <Button size="lg" onClick={() => router.push(`/app/esim/checkout?plan=${plan.id}`)}>
            Buy eSIM
          </Button>
        </div>
      </div>
    </>
  );
}
