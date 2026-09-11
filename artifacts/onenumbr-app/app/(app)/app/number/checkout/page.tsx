"use client";

// =============================================================================
// /app/number/checkout?number=… — review + demo payment for a number.
//
// The client sends only { numberId, idempotencyKey }; the server computes the
// authoritative price from the reserved inventory record. One idempotency key
// per checkout session prevents double purchase on double-click.
// =============================================================================

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import {
  checkoutNumber,
  fetchMyNumbers,
  newNumberIdempotencyKey,
  NumberApiError,
} from "@/services/numberService";
import type { MyNumber } from "@/types/number";
import { ShieldCheck, CreditCard } from "lucide-react";

export default function NumberCheckoutPage() {
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
  const numberId = searchParams.get("number") ?? "";

  const [number, setNumber] = useState<MyNumber | null>(null);
  const [identityState, setIdentityState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const idemKeyRef = useRef<string>("");

  if (!idemKeyRef.current) idemKeyRef.current = newNumberIdempotencyKey();

  useEffect(() => {
    // Detail fetch validates the reservation belongs to this session.
    fetchMyNumbers()
      .then((d) => {
        setIdentityState(d.identityState);
        setNumber(d.numbers.find((n) => n.numberId === numberId) ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load checkout."));
  }, [numberId]);

  const reserved = useMemo(
    () => number !== null && (number.status === "reserved" || number.status === "provisioning" || number.status === "active"),
    [number],
  );

  async function handlePurchase() {
    if (!number || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await checkoutNumber({ numberId: number.numberId, idempotencyKey: idemKeyRef.current });
      window.location.href = `/app/number/${number.numberId}?activated=1`;
    } catch (err) {
      if (err instanceof NumberApiError && err.code === "kyc_required") {
        setFormError("Complete identity verification before activating a number. Your number stays reserved while you do.");
      } else if (err instanceof NumberApiError && err.code === "reservation_expired") {
        setFormError("Your reservation expired and the number was released for others. Please choose it again — you haven't been charged.");
      } else {
        setFormError(
          err instanceof Error && err.message.length < 120
            ? err.message
            : "We couldn't complete your activation. You haven't been charged — please try again, or contact support if it keeps failing.",
        );
      }
      setSubmitting(false);
    }
  }

  if (!numberId) {
    return (
      <EmptyState
        title="No number selected"
        description="Choose a number in the marketplace to continue."
        action={
          <Link href="/app/number">
            <Button variant="secondary">Browse numbers</Button>
          </Link>
        }
      />
    );
  }

  if (error) return <EmptyState title="Checkout unavailable" description={error} />;

  if (number === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading checkout…" />
        </CardContent>
      </Card>
    );
  }

  if (identityState && identityState !== "verified") {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Identity verification required"
        description="Complete verification to activate your OneNumbr number."
        action={
          <Link href="/app/identity/verification/start">
            <Button>Complete verification</Button>
          </Link>
        }
      />
    );
  }

  const n = number;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Number checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review your number and complete activation.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Order summary */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Your number</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Your OneNumbr Number
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold tracking-wider text-primary">
                {n.displayNumber}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                {n.capabilities.map((c) => (
                  <Badge key={c} tone="neutral">{c}</Badge>
                ))}
                <Badge tone="neutral">{n.type.replace("_", " ")}</Badge>
              </div>
            </div>

            <dl className="space-y-2 text-sm">
              <Row label="Type" value={n.type.replace("_", " ")} />
              <Row label="Country" value={n.countryCode} />
              <Row label="Capabilities" value={n.capabilities.join(" · ")} />
              <Row label="Monthly plan" value={`$${n.monthlyPrice.toFixed(2)}`} />
              <Row label="Taxes & fees" value="$0.00" hint="Included" />
              <div className="border-t border-border/60 pt-2">
                <Row label="Total due today" value={`$${n.monthlyPrice.toFixed(2)}`} strong />
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
              disabled={!reserved}
            >
              {submitting ? "Activating…" : "Complete Purchase"}
            </Button>

            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Prices are verified server-side at purchase. Your number is
              reserved for this checkout and activates automatically after
              payment.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
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
