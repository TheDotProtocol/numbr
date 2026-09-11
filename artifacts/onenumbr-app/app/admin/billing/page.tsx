"use client";

// =============================================================================
// /admin/billing — billing console (Overview / Payments / Invoices /
// Subscriptions / Events). Refunds and subscription controls operate against
// the mock billing engine with confirmation dialogs; statistics are derived
// from real stored records, never hardcoded.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Card, CardContent } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Field, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast";
import {
  adminChangeSubscription,
  adminRefund,
  fetchAdminBilling,
  type AdminBillingOverview,
} from "@/services/billingService";
import { formatMinor, type BillingEvent, type InvoiceRecord, type PaymentRecord, type SubscriptionRecord } from "@/types/billing";
import { RefreshCw } from "lucide-react";

const TABS = ["Overview", "Payments", "Invoices", "Subscriptions", "Events"] as const;
type Tab = (typeof TABS)[number];

export default function AdminBillingPage() {
  return (
    <AdminGuard>
      <Console />
    </AdminGuard>
  );
}

function Console() {
  const [tab, setTab] = useState<Tab>("Overview");
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Payments, invoices, subscriptions and financial events.
        </p>
      </div>

      <Tabs
        ariaLabel="Billing console"
        className="mb-6"
        tabs={TABS.map((t) => ({ value: t, label: t }))}
        value={tab}
        onChange={setTab}
      />

      {tab === "Overview" ? <OverviewTab /> : null}
      {tab === "Payments" ? <PaymentsTab /> : null}
      {tab === "Invoices" ? <InvoicesTab /> : null}
      {tab === "Subscriptions" ? <SubscriptionsTab /> : null}
      {tab === "Events" ? <EventsTab /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewTab() {
  const [overview, setOverview] = useState<AdminBillingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminBilling<{ overview: AdminBillingOverview }>(null)
      .then((d) => setOverview(d.overview))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load overview."));
  }, []);

  if (error) return <EmptyState title="Couldn't load overview" description={error} />;
  if (overview === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading billing statistics…" />
        </CardContent>
      </Card>
    );
  }

  const stats = [
    { label: "Total payments", value: String(overview.totalPayments) },
    { label: "Successful", value: String(overview.successfulPayments) },
    { label: "Failed", value: String(overview.failedPayments) },
    { label: "Refunded", value: String(overview.refundedPayments) },
    { label: "Active subscriptions", value: String(overview.activeSubscriptions) },
    {
      label: "Gross revenue",
      value: formatMinor(overview.revenueMinor, "USD"),
    },
    {
      label: "Refunded amount",
      value: formatMinor(overview.refundedMinor, "USD"),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-primary">{s.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payments (+ refunds)
// ---------------------------------------------------------------------------

function PaymentsTab() {
  const { showToast } = useToast();
  const [payments, setPayments] = useState<(PaymentRecord & { email: string })[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [refundTarget, setRefundTarget] = useState<(PaymentRecord & { email: string }) | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [partial, setPartial] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await fetchAdminBilling<{ payments: (PaymentRecord & { email: string })[] }>("payments");
      setPayments(d.payments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments.");
      setPayments((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = (payments ?? []).filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return p.description.toLowerCase().includes(s) || p.email.toLowerCase().includes(s) || p.id.toLowerCase().includes(s);
  });

  function openRefund(p: PaymentRecord & { email: string }) {
    setRefundTarget(p);
    setPartial(false);
    setRefundAmount("");
    setRefundReason("");
  }

  async function confirmRefund() {
    if (!refundTarget || refunding) return;
    const amountMinor = partial ? Math.round(Number(refundAmount) * 100) : undefined;
    if (partial && (!amountMinor || amountMinor <= 0)) {
      showToast("Enter a valid refund amount.", "error");
      return;
    }
    setRefunding(true);
    try {
      await adminRefund({
        paymentId: refundTarget.id,
        amountMinor,
        reason: refundReason || "Admin refund",
      });
      showToast("Refund processed.");
      setRefundTarget(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Refund failed.", "error");
    } finally {
      setRefunding(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search payments…"
            aria-label="Search payments"
            className="w-52"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Status filter"
            className="h-10 rounded-lg border border-border bg-surface-2 px-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="partially_refunded">Partially refunded</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {error ? (
        <EmptyState title="Couldn't load payments" description={error} />
      ) : payments === null ? (
        <Card>
          <CardContent>
            <LoadingState label="Loading payments…" />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState title="No payments found" description="Payments appear here as customers purchase services." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border/40 last:border-0">
                    <td className="max-w-[160px] truncate px-4 py-3">{p.email || p.uid.slice(0, 8)}</td>
                    <td className="max-w-[200px] truncate px-4 py-3">{p.description}</td>
                    <td className="px-4 py-3 capitalize">{p.orderType}</td>
                    <td className="px-4 py-3 font-medium text-primary">
                      {formatMinor(p.amountMinor, p.currency)}
                      {p.refundedAmountMinor > 0 ? (
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          −{formatMinor(p.refundedAmountMinor, p.currency)} refunded
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          p.status === "paid"
                            ? "success"
                            : p.status === "failed"
                              ? "danger"
                              : p.status === "refunded" || p.status === "partially_refunded"
                                ? "warning"
                                : "neutral"
                        }
                      >
                        {p.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.status === "paid" || p.status === "partially_refunded" ? (
                        <Button size="sm" variant="secondary" onClick={() => openRefund(p)}>
                          Refund
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Refund confirmation modal */}
      <Modal
        open={refundTarget !== null}
        onClose={() => (refunding ? undefined : setRefundTarget(null))}
        title="Process refund"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRefundTarget(null)} disabled={refunding}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmRefund} loading={refunding}>
              Confirm refund
            </Button>
          </div>
        }
      >
        {refundTarget ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Payment:</span>{" "}
              {refundTarget.description} —{" "}
              <span className="font-semibold text-primary">
                {formatMinor(refundTarget.amountMinor, refundTarget.currency)}
              </span>
            </p>
            {refundTarget.refundedAmountMinor > 0 ? (
              <p className="text-xs text-muted-foreground">
                Already refunded: {formatMinor(refundTarget.refundedAmountMinor, refundTarget.currency)}
              </p>
            ) : null}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={partial}
                onChange={(e) => setPartial(e.target.checked)}
                className="h-4 w-4"
              />
              Partial refund
            </label>
            {partial ? (
              <Field label="Refund amount (major units, e.g. 5.00)">
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="5.00"
                />
              </Field>
            ) : null}
            <Field label="Reason">
              <Input
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Customer request"
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              The invoice and related records update automatically. Demo provider — no real funds
              move.
            </p>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

function InvoicesTab() {
  const [invoices, setInvoices] = useState<(InvoiceRecord & { email: string })[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminBilling<{ invoices: (InvoiceRecord & { email: string })[] }>("invoices")
      .then((d) => setInvoices(d.invoices))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load invoices.");
        setInvoices((prev) => prev ?? []);
      });
  }, []);

  if (error) return <EmptyState title="Couldn't load invoices" description={error} />;
  if (invoices === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading invoices…" />
        </CardContent>
      </Card>
    );
  }
  if (invoices.length === 0) {
    return <EmptyState title="No invoices yet" description="Issued invoices appear here." />;
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Issued</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                <td className="max-w-[180px] truncate px-4 py-3">{inv.email || inv.uid.slice(0, 8)}</td>
                <td className="px-4 py-3 font-medium text-primary">
                  {formatMinor(inv.totalMinor, inv.currency)}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    tone={
                      inv.status === "paid"
                        ? "success"
                        : inv.status === "refunded"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {inv.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{inv.invoiceDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

function SubscriptionsTab() {
  const { showToast } = useToast();
  const [subs, setSubs] = useState<(SubscriptionRecord & { email: string })[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; label: string; action: "pause" | "cancel" | "resume" } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await fetchAdminBilling<{ subscriptions: (SubscriptionRecord & { email: string })[] }>("subscriptions");
      setSubs(d.subscriptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subscriptions.");
      setSubs((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act() {
    if (!confirmTarget) return;
    setBusy(confirmTarget.id);
    try {
      await adminChangeSubscription(confirmTarget.id, confirmTarget.action);
      showToast(`Subscription ${confirmTarget.action === "resume" ? "resumed" : confirmTarget.action + "led"}.`);
      setConfirmTarget(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (error) return <EmptyState title="Couldn't load subscriptions" description={error} />;
  if (subs === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading subscriptions…" />
        </CardContent>
      </Card>
    );
  }
  if (subs.length === 0) {
    return <EmptyState title="No subscriptions" description="Mock subscriptions appear here." />;
  }

  return (
    <>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Interval</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Next billing</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-border/40 last:border-0">
                  <td className="max-w-[160px] truncate px-4 py-3">{s.email || s.uid.slice(0, 8)}</td>
                  <td className="px-4 py-3">{s.planSnapshot.planName}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.planVersion ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-primary">
                    {formatMinor(s.planSnapshot.amountMinor, s.planSnapshot.currency)}
                  </td>
                  <td className="px-4 py-3 capitalize">{s.planSnapshot.interval}</td>
                  <td className="px-4 py-3">
                    <Badge tone={s.status === "active" ? "success" : s.status === "cancelled" ? "neutral" : s.status === "past_due" || s.status === "failed" ? "danger" : "gold"}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {s.nextBillingDate ? new Date(s.nextBillingDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.status === "active" ? (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setConfirmTarget({ id: s.id, label: s.planSnapshot.planName, action: "pause" })}
                        >
                          Pause
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmTarget({ id: s.id, label: s.planSnapshot.planName, action: "cancel" })}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : s.status === "paused" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setConfirmTarget({ id: s.id, label: s.planSnapshot.planName, action: "resume" })}
                      >
                        Resume
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground/70">
        Controls operate on the mock subscription model — no real recurring charges occur.
      </p>

      <Modal
        open={confirmTarget !== null}
        onClose={() => (busy ? undefined : setConfirmTarget(null))}
        title={
          confirmTarget?.action === "pause"
            ? "Pause subscription?"
            : confirmTarget?.action === "cancel"
              ? "Cancel subscription?"
              : "Resume subscription?"
        }
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmTarget(null)} disabled={Boolean(busy)}>
              Cancel
            </Button>
            <Button onClick={act} loading={Boolean(busy)}>
              Confirm
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          {confirmTarget ? `${confirmTarget.label} will be ${confirmTarget.action === "resume" ? "resumed" : confirmTarget.action + "led"} for this customer (demo billing).` : ""}
        </p>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function EventsTab() {
  const [events, setEvents] = useState<BillingEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminBilling<{ events: BillingEvent[] }>("events")
      .then((d) => setEvents(d.events))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load events.");
        setEvents((prev) => prev ?? []);
      });
  }, []);

  if (error) return <EmptyState title="Couldn't load events" description={error} />;
  if (events === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading billing events…" />
        </CardContent>
      </Card>
    );
  }
  if (events.length === 0) {
    return <EmptyState title="No billing events" description="The financial event log appears here." />;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-border/40">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-mono text-xs">{e.kind}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {e.createdAt ? new Date(e.createdAt).toLocaleString() : "—"}
                  {e.metadata && Object.keys(e.metadata).length > 0
                    ? ` · ${Object.entries(e.metadata)
                        .filter(([k]) => k !== "reason")
                        .map(([k, v]) => `${k}=${String(v)}`)
                        .join(" · ")}`
                    : ""}
                </p>
              </div>
              {e.amountMinor !== null && e.amountMinor !== undefined ? (
                <span className="font-medium">{formatMinor(e.amountMinor, e.currency ?? "USD")}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
