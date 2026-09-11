"use client";

// =============================================================================
// /app/esim/checkout?plan=… — review + demo payment
//
// The client sends only { planId, idempotencyKey }; the server computes the
// authoritative price. The idempotency key is generated when the checkout
// page mounts, so a double-click or re-submit cannot create two orders.
// =============================================================================

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, Spinner } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { checkout, fetchCatalog, newIdempotencyKey } from "@/services/esimService";
import { formatData, type PublicPlan } from "@/types/esim";
import { ShieldCheck, CreditCard } from "lucide-react";

export default function CheckoutPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<LoadingState label="Loading checkout…" />}>
        <CheckoutInner />
      </Suspense>
    </AuthGuard>
  );
}

function CheckoutInner() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan") ?? "";

  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const idemKeyRef = useRef<string>("");

  // One idempotency key per checkout session (not per attempt).
  if (!idemKeyRef.current) idemKeyRef.current = newIdempotencyKey();

  useEffect(() => {
    fetchCatalog()
      .then(setPlans)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load checkout."));
  }, []);

  const plan = useMemo(
    () => (plans ?? []).find((p) => p.id === planId) ?? null,
    [plans, planId],
  );

  async function handlePurchase() {
    if (!plan || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await checkout({ planId: plan.id, idempotencyKey: idemKeyRef.current });
      if (result.esimId) {
        window.location.href = `/app/esim/activation/${result.esimId}?new=1`;
      } else {
        window.location.href = `/app/esim/orders?order=${result.orderId}`;
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Checkout failed.");
      setSubmitting(false);
    }
  }

  if (!planId) {
    return (
      <EmptyState
        title="No plan selected"
        description="Choose a plan in the marketplace to continue to checkout."
        action={
          <Link href="/app/esim">
            <Button variant="secondary">Browse marketplace</Button>
          </Link>
        }
      />
    );
  }

  if (error) return <EmptyState title="Checkout unavailable" description={error} />;

  if (plans === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading checkout…" />
        </CardContent>
      </Card>
    );
  }

  if (!plan) {
    return (
      <EmptyState
        title="Plan unavailable"
        description="This plan no longer exists or has been removed from the catalog."
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
      <PageHeaderSimple />
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Order summary */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Order summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-2/40 p-4">
              <div>
                <p className="text-lg">{plan.flag}</p>
                <p className="mt-1 text-sm font-medium">{plan.planName}</p>
                <p className="text-xs text-muted-foreground">
                  {plan.countryName} · {formatData(plan.dataAmount, plan.dataUnit)} ·{" "}
                  {plan.durationDays} days · {plan.networkType}
                </p>
              </div>
              {plan.featured ? <Badge tone="gold">Featured</Badge> : null}
            </div>

            <dl className="space-y-2 text-sm">
              <Row label="Plan price" value={`$${plan.price.toFixed(2)}`} />
              <Row label="Taxes & fees" value="$0.00" hint="Included" />
              <div className="border-t border-border/60 pt-2">
                <Row label="Total" value={`$${plan.price.toFixed(2)}`} strong />
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Payment */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Payment method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <CreditCard className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Demo Payment</p>
                <p className="text-xs text-muted-foreground">
                  Development environment — no real charge, no card data.
                </p>
              </div>
            </div>

            {formError ? (
              <p role="alert" className="text-sm text-destructive">{formError}</p>
            ) : null}

            <Button
              fullWidth
              size="lg"
              loading={submitting}
              onClick={handlePurchase}
            >
              {submitting ? "Processing…" : "Complete Purchase"}
            </Button>

            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Prices are verified server-side at purchase. Your eSIM is
              prepared automatically after payment.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function PageHeaderSimple() {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review your order and complete the purchase.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd className={strong ? "text-base font-semibold text-primary" : ""}>
        {value}
        {hint ? <span className="ml-1.5 text-xs text-muted-foreground">({hint})</span> : null}
      </dd>
    </div>
  );
}
