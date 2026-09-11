"use client";

// =============================================================================
// /admin/operations — "What needs attention?"
//
// Deterministic operational indicators derived from live Firestore state:
// open/urgent support cases, KYC backlog, failed provisioning orders, failed
// payments. Every row links to the console where the fix lives. Demo/development
// context is stated honestly.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StaffGuard } from "@/components/admin/StaffGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast";
import type { OpsAlertKind, OpsAlertSeverity } from "@/types/support";

type OpsSnapshot = {
  alerts: {
    kind: OpsAlertKind;
    severity: OpsAlertSeverity;
    count: number;
    message: string;
    needsAttention: boolean;
  }[];
  recent: {
    failedEsimOrders: { id: string; uid: string; ref: string; reason: string | null; createdAt: number }[];
    failedNumberOrders: { id: string; uid: string; ref: string; reason: string | null; createdAt: number }[];
    failedPayments: { id: string; uid: string; ref: string; reason: string | null; createdAt: number }[];
  };
  generatedAt: number;
};

const SEVERITY_TONE: Record<OpsAlertSeverity, "neutral" | "success" | "warning" | "danger" | "gold"> = {
  info: "success",
  warning: "warning",
  critical: "danger",
};

export default function AdminOperationsPage() {
  const { showToast } = useToast();
  const [snap, setSnap] = useState<OpsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (refresh = false) => {
    try {
      const res = await fetch(`/api/admin/operations${refresh ? "?refresh=1" : ""}`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setSnap((await res.json()) as OpsSnapshot);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the operations snapshot.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <StaffGuard>
      <PageHeader
        title="Operations"
        description="What needs attention right now — derived from live platform state."
        actions={
          <Button
            variant="secondary"
            loading={busy}
            onClick={() => {
              setBusy(true);
              load(true)
                .then(() => showToast("Snapshot refreshed.", "success"))
                .catch(() => showToast("Refresh failed.", "error"))
                .finally(() => setBusy(false));
            }}
          >
            Refresh
          </Button>
        }
      />

      {error ? (
        <EmptyState title="Operations unavailable" description={error} />
      ) : snap === null ? (
        <LoadingState label="Evaluating operational state…" />
      ) : (
        <div className="space-y-6">
          {/* Alerts */}
          <div className="space-y-2">
            {snap.alerts.map((a) => (
              <Card key={a.kind} className={a.needsAttention ? "border-warning/40" : undefined}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <p className="text-sm">{a.message}</p>
                  <Badge tone={SEVERITY_TONE[a.severity]}>
                    {a.severity === "info" ? "OK" : a.severity === "warning" ? "Needs attention" : "Critical"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Failure worklists — surfaced to the consoles that fix them */}
          <div className="grid gap-4 lg:grid-cols-3">
            <WorklistCard
              title="Failed eSIM orders"
              empty="No failed eSIM orders."
              rows={snap.recent.failedEsimOrders}
              cta={{ label: "Open eSIM console → Retry", href: "/admin/esim" }}
            />
            <WorklistCard
              title="Failed number orders"
              empty="No failed number orders."
              rows={snap.recent.failedNumberOrders}
              cta={{ label: "Open Numbers console → Retry", href: "/admin/numbers" }}
            />
            <WorklistCard
              title="Failed payments"
              empty="No failed payments."
              rows={snap.recent.failedPayments}
              cta={{ label: "Open billing console", href: "/admin/billing" }}
            />
          </div>

          {/* Issue-resolution quick links */}
          <Card>
            <CardHeader>
              <CardTitle>Resolution workflows</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 text-sm">
              <Link href="/admin/kyc" className="text-primary hover:underline">
                KYC review queue →
              </Link>
              <Link href="/admin/support" className="text-primary hover:underline">
                Support queue →
              </Link>
              <Link href="/admin/billing" className="text-primary hover:underline">
                Refunds & payments →
              </Link>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Snapshot generated {new Date(snap.generatedAt).toLocaleString()} · counts are live queries with bounded
            windows (14 days for failures). Provisioning and payments run on demo providers in this environment.
          </p>
        </div>
      )}
    </StaffGuard>
  );
}

function WorklistCard({
  title,
  empty,
  rows,
  cta,
}: {
  title: string;
  empty: string;
  rows: { id: string; uid: string; ref: string; reason: string | null; createdAt: number }[];
  cta: { label: string; href: string };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <Link href={`/admin/users/${r.uid}`} className="truncate font-mono text-xs text-primary hover:underline">
                  {r.ref}
                </Link>
                <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href={cta.href} className="mt-3 inline-block text-xs text-primary hover:underline">
          {cta.label}
        </Link>
      </CardContent>
    </Card>
  );
}
