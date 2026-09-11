"use client";

// =============================================================================
// /admin/logs — audit trail
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState, EmptyState } from "@/components/ui/EmptyState";

interface AuditRow {
  id: string;
  actorUid: string;
  action: string;
  targetUid: string | null;
  metadata: Record<string, unknown>;
  createdAt: number | null;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cursor: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to load logs (${res.status})`);
      const data = (await res.json()) as { logs: AuditRow[]; nextCursor: string | null };
      setLogs((prev) => (cursor && prev ? [...prev, ...data.logs] : data.logs));
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Audit logs"
        description="Server-recorded administrative actions. Written by the backend only."
      />

      {error ? (
        <EmptyState title="Couldn't load logs" description={error} />
      ) : logs === null ? (
        <Card>
          <CardContent>
            <LoadingState label="Loading audit logs…" />
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <EmptyState
          title="No audit events yet"
          description="Administrative actions will appear here as they happen."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/40">
              {logs.map((log) => (
                <li key={log.id} className="px-5 py-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-primary">{log.action}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        actor {log.actorUid}
                        {log.targetUid ? ` → ${log.targetUid}` : ""}
                        {Object.keys(log.metadata).length > 0
                          ? ` · ${JSON.stringify(log.metadata)}`
                          : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {nextCursor ? (
              <div className="border-t border-border/60 px-5 py-3">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={loading}
                  onClick={() => void load(nextCursor)}
                >
                  Load more
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
