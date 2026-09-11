"use client";

// =============================================================================
// /app/esim/active — my eSIMs
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { fetchMyEsims, type MyEsimSummary } from "@/services/esimService";
import { formatData } from "@/types/esim";
import { SignalHigh } from "lucide-react";

export default function ActiveEsimsPage() {
  return (
    <AuthGuard>
      <ActiveInner />
    </AuthGuard>
  );
}

function ActiveInner() {
  const [esims, setEsims] = useState<MyEsimSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyEsims()
      .then((d) => setEsims(d.esims))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load eSIMs."));
  }, []);

  if (error) return <EmptyState title="Couldn't load your eSIMs" description={error} />;
  if (esims === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading your eSIMs…" />
        </CardContent>
      </Card>
    );
  }
  if (esims.length === 0) {
    return (
      <EmptyState
        icon={<SignalHigh className="h-5 w-5" />}
        title="You don't have an active eSIM yet"
        description="Choose a plan to get connected — your eSIMs appear here once they're prepared."
        action={
          <Link href="/app/esim">
            <Button>Explore eSIMs</Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      <PageHeaderSimple />
      <div className="grid gap-3 sm:grid-cols-2">
        {esims.map((e) => {
          const pct =
            e.dataTotalMb > 0
              ? Math.max(0, Math.min(100, Math.round(((e.dataTotalMb - e.dataUsedMb) / e.dataTotalMb) * 100)))
              : 100;
          return (
            <Card key={e.id} className="transition-colors hover:border-primary/40">
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{e.flag}</span>
                    <div>
                      <p className="text-sm font-medium">{e.countryName}</p>
                      <p className="text-xs text-muted-foreground">{e.planName}</p>
                    </div>
                  </div>
                  <StatusPill status={e.status} />
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                    <span>{formatData(e.dataAmount, e.dataUnit)} · {e.durationDays} days</span>
                    <span>{pct}% remaining</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                    Demo usage
                  </span>
                  <Link href={`/app/esim/s/${e.id}`}>
                    <Button size="sm" variant="secondary">
                      {e.status === "ready" ? "View & install" : "View"}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "ready" || status === "active"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "suspended" || status === "expired"
          ? "warning"
          : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

function PageHeaderSimple() {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">My eSIMs</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        eSIMs you've purchased, with usage and activation.
      </p>
    </div>
  );
}
