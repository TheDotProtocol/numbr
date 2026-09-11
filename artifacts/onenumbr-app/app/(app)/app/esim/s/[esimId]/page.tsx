"use client";

// =============================================================================
// /app/esim/s/[esimId] — eSIM detail
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle, DataRow } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { fetchEsimDetail, type MyEsimDetail } from "@/services/esimService";
import { formatData } from "@/types/esim";

export default function EsimDetailPage() {
  return (
    <AuthGuard>
      <DetailInner />
    </AuthGuard>
  );
}

function DetailInner() {
  const params = useParams<{ esimId: string }>();
  const [data, setData] = useState<MyEsimDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEsimDetail(params.esimId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load eSIM."));
  }, [params.esimId]);

  if (error) {
    return (
      <EmptyState
        title="eSIM unavailable"
        description={error}
        action={
          <Link href="/app/esim/active">
            <Button variant="secondary">My eSIMs</Button>
          </Link>
        }
      />
    );
  }
  if (!data) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading eSIM…" />
        </CardContent>
      </Card>
    );
  }

  const { esim, order } = data;
  const remainingMb = Math.max(0, esim.dataTotalMb - esim.dataUsedMb);
  const pct =
    esim.dataTotalMb > 0
      ? Math.round((remainingMb / esim.dataTotalMb) * 100)
      : 100;

  return (
    <>
      <nav className="mb-4 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/app/esim/active" className="hover:text-primary">My eSIMs</Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{esim.countryName}</span>
      </nav>

      <div className="glass-gold animate-fade-up rounded-2xl px-6 py-7 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{esim.flag}</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{esim.countryName}</h1>
              <p className="text-xs text-muted-foreground">{esim.planName}</p>
            </div>
          </div>
          <Badge tone={esim.status === "ready" || esim.status === "active" ? "success" : "neutral"}>
            {esim.status}
          </Badge>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usage & validity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">
                  {formatData(Number((remainingMb / 1024).toFixed(1)), "GB")} remaining
                </span>
                <span className="text-xs text-muted-foreground">
                  of {formatData(esim.dataAmount, esim.dataUnit)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                Simulated usage — demo eSIM
              </p>
            </div>
            <div className="divide-y divide-border/40">
              <DataRow label="Validity">
                {esim.durationDays} days
              </DataRow>
              <DataRow label="Expires">
                {esim.expiresAt ? new Date(esim.expiresAt).toLocaleDateString() : "—"}
              </DataRow>
              <DataRow label="Activated">
                {esim.activatedAt ? new Date(esim.activatedAt).toLocaleString() : "Not yet installed"}
              </DataRow>
              <DataRow label="Provider">
                {esim.provider} <Badge tone="neutral">dev</Badge>
              </DataRow>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href={`/app/esim/activation/${esim.id}`}>
              <Button fullWidth>Show QR & activation</Button>
            </Link>
            <Link href={`/app/esim/activation/${esim.id}`}>
              <Button variant="secondary" fullWidth>
                Installation guide
              </Button>
            </Link>
            {order ? (
              <p className="pt-1 text-xs text-muted-foreground">
                Purchased{" "}
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"} for{" "}
                ${order.totalAmount} ·{" "}
                <Link href="/app/esim/orders" className="text-primary hover:underline">
                  view order history
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
