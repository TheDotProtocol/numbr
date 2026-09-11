"use client";

// =============================================================================
// /admin — Overview
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { LoadingState, EmptyState } from "@/components/ui/EmptyState";

interface OverviewData {
  totals: { users: number; identitiesIssued: number };
  recentAuditLogs: {
    id: string;
    actorUid: string;
    action: string;
    targetUid: string | null;
    createdAt: number | null;
  }[];
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/overview");
        if (!res.ok) throw new Error(`Failed to load overview (${res.status})`);
        setData((await res.json()) as OverviewData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load overview.");
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Overview"
        description="Platform-wide status at a glance."
      />

      {error ? (
        <EmptyState title="Couldn't load overview" description={error} />
      ) : data === null ? (
        <Card>
          <CardContent>
            <LoadingState label="Loading platform stats…" />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total users" value={data.totals.users} />
            <StatCard label="OneNumbr IDs issued" value={data.totals.identitiesIssued} />
            <StatCard
              label="Verification pending"
              value="0"
              hint="KYC launches in Prompt 2"
            />
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Recent audit logs</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentAuditLogs.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">
                  No audit events yet.
                </p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {data.recentAuditLogs.map((log) => (
                    <li key={log.id} className="flex items-center justify-between gap-4 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-primary">{log.action}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          actor {log.actorUid.slice(0, 10)}…
                          {log.targetUid ? ` → target ${log.targetUid.slice(0, 10)}…` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="mt-6">
            <Link
              href="/admin/users"
              className="text-sm text-primary hover:underline"
            >
              Manage users →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
