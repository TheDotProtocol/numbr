"use client";

// =============================================================================
// /admin/kyc — verification queue (tabs, search, pagination)
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { LoadingState, EmptyState } from "@/components/ui/EmptyState";

interface QueueCase {
  uid: string;
  status: string;
  documentType: string | null;
  documentCountry: string;
  attempt: number;
  submittedAt: number | null;
  email: string;
  onenumbr: string | null;
  profileName?: string;
  reviewerName?: string | null;
}

const TABS = [
  { label: "Pending", statuses: ["submitted", "under_review"] },
  { label: "Under Review", statuses: ["under_review"] },
  { label: "Approved", statuses: ["approved"] },
  { label: "Rejected", statuses: ["rejected"] },
  { label: "Resubmission", statuses: ["resubmission_required"] },
];

export default function AdminKycQueuePage() {
  const [tab, setTab] = useState(0);
  const [cases, setCases] = useState<QueueCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const status = TABS[tab].statuses.join(",");

  const load = useCallback(
    async (statusParam: string, cursorVal: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ status: statusParam });
        if (cursorVal) params.set("cursor", cursorVal);
        const res = await fetch(`/api/kyc/admin/queue?${params.toString()}`);
        if (!res.ok) throw new Error(`Failed to load queue (${res.status})`);
        const data = (await res.json()) as {
          cases: QueueCase[];
          nextCursor: string | null;
        };
        setCases((prev) =>
          cursorVal && prev ? [...prev, ...data.cases] : data.cases,
        );
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load queue.");
        setCases((prev) => prev ?? []);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setCases(null);
    setCursor(null);
    void load(TABS[0].statuses.join(","), null);
  }, [load]);

  function switchTab(i: number) {
    setTab(i);
    setQ("");
    setCases(null);
    void load(TABS[i].statuses.join(","), null);
  }

  const visible = cases
    ? q.trim()
      ? cases.filter(
          (c) =>
            c.email.toLowerCase().includes(q.trim().toLowerCase()) ||
            (c.onenumbr ?? "").toLowerCase().includes(q.trim().toLowerCase()),
        )
      : cases
    : null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="KYC — Verification Center"
        description="Review identity verification submissions. Every decision is audit-logged."
      />

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Queue filters">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            role="tab"
            aria-selected={tab === i}
            type="button"
            onClick={() => switchTab(i)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              tab === i
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
          ))}
      </div>

      {/* Search */}
      <form
        className="mb-4 flex max-w-sm gap-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <Input
          type="search"
          placeholder="Search email or OneNumbr ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search queue"
        />
      </form>

      {error ? (
        <EmptyState title="Couldn't load queue" description={error} />
      ) : visible === null ? (
        <Card>
          <CardContent>
            <LoadingState label="Loading queue…" />
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No pending verifications"
          description="Submissions will appear here as users complete identity verification."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">OneNumbr ID</th>
                    <th className="px-5 py-3 font-medium">Document</th>
                    <th className="px-5 py-3 font-medium">Country</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Submitted</th>
                    <th className="px-5 py-3" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {visible.map((c) => (
                    <tr key={c.uid} className="transition-colors hover:bg-muted/30">
                      <td className="px-5 py-3">{c.email}</td>
                      <td className="px-5 py-3 font-mono text-xs text-primary">
                        {c.onenumbr ?? "—"}
                      </td>
                      <td className="px-5 py-3 capitalize">
                        {(c.documentType ?? "—").replace(/_/g, " ")}
                      </td>
                      <td className="px-5 py-3">{c.documentCountry || "—"}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {c.submittedAt
                          ? new Date(c.submittedAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/kyc/${c.uid}`}
                          className="text-primary hover:underline"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nextCursor ? (
              <div className="border-t border-border/60 px-5 py-3">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={loading}
                  onClick={() => {
                    setCursor(nextCursor);
                    void load(status, nextCursor);
                  }}
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
