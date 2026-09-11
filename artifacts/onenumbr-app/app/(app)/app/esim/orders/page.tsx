"use client";

// =============================================================================
// /app/esim/orders — order history
//
// Order states are server-set; this page only renders them honestly:
//   ready      → eSIM prepared, install available
//   failed     → payment captured but provisioning failed (retry by team)
//   other      → in-progress states
// =============================================================================

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { fetchMyEsims, type MyOrderSummary } from "@/services/esimService";
import { formatData } from "@/types/esim";
import { ReceiptText } from "lucide-react";

export default function OrdersPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<LoadingState label="Loading orders…" />}>
        <OrdersInner />
      </Suspense>
    </AuthGuard>
  );
}

function OrdersInner() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("order");
  const [orders, setOrders] = useState<MyOrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyEsims()
      .then((d) => setOrders(d.orders))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load orders."));
  }, []);

  if (error) return <EmptyState title="Couldn't load your orders" description={error} />;

  if (orders === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading orders…" />
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ReceiptText className="h-5 w-5" />}
        title="No order history"
        description="When you purchase an eSIM, your orders will appear here."
        action={
          <Link href="/app/esim">
            <Button>Browse marketplace</Button>
          </Link>
        }
      />
    );
  }

  const highlighted = highlightId ? orders.find((o) => o.id === highlightId) : null;

  return (
    <>
      <PageHeaderSimple />

      {highlighted && highlighted.orderStatus === "failed" ? (
        <div
          role="alert"
          className="animate-fade-up mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4"
        >
          <p className="text-sm font-medium">We couldn&apos;t finish preparing your eSIM.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your order was received but preparation did not complete. Our team can retry it — you
            won&apos;t be charged again.
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        {orders.map((o) => (
          <OrderRow key={o.id} order={o} highlighted={o.id === highlightId} />
        ))}
      </div>
    </>
  );
}

function OrderRow({ order, highlighted }: { order: MyOrderSummary; highlighted: boolean }) {
  const s = order.planSnapshot;
  const failed = order.orderStatus === "failed";
  const ready = order.orderStatus === "ready" && order.esimId;

  return (
    <Card className={highlighted ? "border-primary/50" : undefined}>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{s.flag}</span>
          <div>
            <p className="text-sm font-medium">
              {s.countryName} · {s.planName}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatData(s.dataAmount, s.dataUnit)} · {s.durationDays} days ·{" "}
              {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-primary">
            ${order.totalAmount.toFixed(2)} {order.currency}
          </span>
          <Badge
            tone={
              ready
                ? "success"
                : failed
                  ? "danger"
                  : order.paymentStatus === "paid"
                    ? "gold"
                    : "neutral"
            }
          >
            {failed ? "Failed" : ready ? "Ready" : order.orderStatus.replace("_", " ")}
          </Badge>
          {ready ? (
            <Link href={`/app/esim/activation/${order.esimId}`}>
              <Button size="sm" variant="secondary">
                View eSIM
              </Button>
            </Link>
          ) : failed ? (
            <span className="text-xs text-muted-foreground">Retry pending</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function PageHeaderSimple() {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your eSIM purchase history and order status.
      </p>
    </div>
  );
}
