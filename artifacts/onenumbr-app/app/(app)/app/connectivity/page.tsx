"use client";

// =============================================================================
// /app/connectivity — the Connectivity experience (Prompt 14)
//
// "Global connectivity, underneath your OneNumbr."
// eSIM is one mechanism — not the product. The eSIM marketplace stays
// reachable for backward compatibility, framed as a mechanism.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/Feedback";
import { fetchConnectivity, connectivityAction } from "@/services/connectivityService";
import type { ConnectivityOverviewData } from "@/services/connectivityService";

const AVAILABILITY_BADGE: Record<string, string> = {
  available: "active",
  demo: "demo_capability",
  coming_soon: "coming_soon",
};

export default function ConnectivityPage() {
  return (
    <AuthGuard>
      <ConnectivityInner />
    </AuthGuard>
  );
}

function ConnectivityInner() {
  const [data, setData] = useState<ConnectivityOverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchConnectivity()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "We couldn't load your connectivity."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't update your connectivity.");
    } finally {
      setBusy(false);
    }
  }

  const conn = data?.connection ?? null;
  const live = conn !== null && (conn.status === "active" || conn.status === "provisioning" || conn.status === "suspended");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Connectivity"
        description="Global connectivity, underneath your OneNumbr. Your connectivity can change without changing your number."
      />

      {error ? <ErrorState title="Something went wrong" description={error} /> : null}

      {data === null && !error ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : null}

      {data ? (
        <div className="space-y-4">
          {/* Promise banner */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
            <p className="text-sm font-medium text-foreground">One plan. One number. Multiple ways to connect.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Connectivity is the infrastructure beneath your OneNumbr identity — providers are replaceable, your
              number is not.
            </p>
          </div>

          {/* Current connection */}
          <Card>
            <CardHeader>
              <CardTitle>Your connectivity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {conn === null ? (
                data.entitlement.entitled ? (
                  <EmptyState
                    title="No connection yet"
                    description="Set up global connectivity to carry your OneNumbr communications. Your number and plan are unaffected."
                    action={
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => act(() => connectivityAction("request", { mechanism: "cloud" }))}
                      >
                        Set up connectivity
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    title="Included with your Global Plan"
                    description="Connectivity becomes available with your OneNumbr Global Plan."
                  />
                )
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Global Connectivity · {conn.mechanism === "cloud" ? "Cloud" : conn.mechanism.toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Provider: {data.provider?.name ?? conn.providerId}
                        {data.provider?.demo ? " (demo)" : ""}
                        {conn.region ? ` · Region: ${conn.region}` : ""}
                        {" · "}{conn.environment === "demo" ? "Demo environment" : "Live"}
                      </p>
                    </div>
                    <StatusBadge status={conn.status} />
                  </div>
                  {conn.note ? <p className="text-xs text-muted-foreground">{conn.note}</p> : null}
                  <div className="flex flex-wrap gap-1.5">
                    {conn.capabilities.map((c) => (
                      <span key={c} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {conn.status === "active" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => act(() => connectivityAction("suspend", { connectionId: conn.id }))}
                      >
                        Suspend
                      </Button>
                    ) : null}
                    {conn.status === "suspended" ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => act(() => connectivityAction("activate", { connectionId: conn.id }))}
                      >
                        Resume
                      </Button>
                    ) : null}
                    {live ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => act(() => connectivityAction("terminate", { connectionId: conn.id }))}
                      >
                        Terminate
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Changing or removing this connection never changes your OneNumbr ID, your number or your plan.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mechanisms — honest availability */}
          <Card>
            <CardHeader>
              <CardTitle>Available mechanisms</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border/40">
                {data.mechanisms.map((m) => (
                  <li key={m.mechanism} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.note}</p>
                    </div>
                    <StatusBadge status={AVAILABILITY_BADGE[m.availability] ?? "coming_soon"} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                eSIM marketplace (mechanism):{" "}
                <Link href="/app/esim" className="text-primary hover:underline">
                  browse demo eSIM plans
                </Link>
              </p>
            </CardContent>
          </Card>

          {/* Future boundaries — documentation, never actionable */}
          <Card>
            <CardHeader>
              <CardTitle>Coming later</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.future.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{b.name.replace(" (future)", "")}</span>
                    <span className="text-xs text-muted-foreground">{b.requirement}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
