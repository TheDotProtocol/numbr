"use client";

// =============================================================================
// /app/billing — OneNumbr billing dashboard
//
// Sections: Overview / Transactions / Invoices / Subscriptions / Payment
// methods. All data comes from the billing engine (financial source of
// truth); nothing is hardcoded. Amounts are integer minor units formatted
// at the display edge.
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast";
import {
  fetchBillingOverview,
  changeSubscription,
  type BillingOverviewData,
} from "@/services/billingService";
import { formatMinor, type InvoiceRecord, type PaymentStatus } from "@/types/billing";
import { fetchMyPlan } from "@/services/planService";
import type { EntitlementsView } from "@/types/plan";
import { StatusBadge as UnifiedStatusBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/EmptyState";
import { CreditCard, Receipt, Repeat, Wallet } from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";

const TABS = ["Overview", "Transactions", "Invoices", "Subscriptions", "Payment methods"] as const;
type Tab = (typeof TABS)[number];

export default function BillingPage() {
  return (
    <AuthGuard>
      <BillingInner />
    </AuthGuard>
  );
}

function BillingInner() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [data, setData] = useState<BillingOverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingOverview()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load billing."));
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Billing"
        description="Payments, invoices and subscriptions for your OneNumbr account."
      />

      <Tabs
        ariaLabel="Billing sections"
        className="mb-6"
        tabs={TABS.map((t) => ({ value: t, label: t }))}
        value={tab}
        onChange={setTab}
      />

      {error ? (
        <EmptyState title="Couldn't load billing" description={error} />
      ) : data === null ? (
        <Card>
          <CardContent>
            <LoadingState label="Loading billing…" />
          </CardContent>
        </Card>
      ) : tab === "Overview" ? (
        <>
          <PlanSummary />
          <Overview data={data} />
        </>
      ) : tab === "Transactions" ? (
        <Transactions data={data} />
      ) : tab === "Invoices" ? (
        <Invoices invoices={data.invoices} />
      ) : tab === "Subscriptions" ? (
        <Subscriptions data={data} setData={setData} />
      ) : (
        <PaymentMethods data={data} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function Overview({ data }: { data: BillingOverviewData }) {
  const activeSubs = data.subscriptions.filter((s) => s.status === "active" || s.status === "trialing");

  return (
    <div className="space-y-4">
      {/* Active services */}
      <Card>
        <CardHeader>
          <CardTitle>Active services</CardTitle>
        </CardHeader>
        <CardContent>
          {activeSubs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active services with recurring billing. Purchases appear here when they carry a
              plan.
            </p>
          ) : (
            <ul className="space-y-2">
              {activeSubs.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium">{s.planSnapshot.planName}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.planSnapshot.interval} · next billing{" "}
                      {s.nextBillingDate ? new Date(s.nextBillingDate).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {formatMinor(s.planSnapshot.amountMinor, s.planSnapshot.currency)}
                    <span className="text-xs font-normal text-muted-foreground">
                      {" "}
                      / {s.planSnapshot.interval.replace("ly", "")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Recent payments */}
        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
          </CardHeader>
          <CardContent>
            {data.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Your payments will appear here after your first purchase.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.payments.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/app/billing/${p.id}`} className="min-w-0 flex-1 truncate hover:text-primary">
                      {p.description}
                    </Link>
                    <span className="font-medium">{formatMinor(p.amountMinor, p.currency)}</span>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Recent invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {data.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Your invoices will appear here after you make a purchase.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.invoices.slice(0, 5).map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/app/billing/invoices/${inv.id}`} className="font-mono text-xs hover:text-primary">
                      {inv.invoiceNumber}
                    </Link>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {inv.description}
                    </span>
                    <span className="font-medium">{formatMinor(inv.totalMinor, inv.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

function Transactions({ data }: { data: BillingOverviewData }) {
  if (data.payments.length === 0) {
    return (
      <EmptyState
        icon={<Wallet className="h-5 w-5" />}
        title="No transactions yet"
        description="After you buy an eSIM or a number, your payments and receipts appear here — including refunds."
        action={
          <Link href="/app/esim">
            <Button>Explore eSIMs</Button>
          </Link>
        }
      />
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {data.payments.map((p) => {
              const inv = data.invoices.find((i) => i.paymentId === p.id);
              return (
                <tr key={p.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/app/billing/${p.id}`} className="hover:text-primary">
                      {p.description}
                    </Link>
                  </td>
                  <td className="px-4 py-3 capitalize">{p.orderType}</td>
                  <td className="px-4 py-3 font-medium">{formatMinor(p.amountMinor, p.currency)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {inv ? (
                      <Link href={`/app/billing/invoices/${inv.id}`} className="hover:text-primary">
                        {inv.invoiceNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

function Invoices({ invoices }: { invoices: InvoiceRecord[] }) {
  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="h-5 w-5" />}
        title="No invoices yet"
        description="Invoices are issued automatically with each purchase."
      />
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{inv.invoiceDate}</td>
                <td className="px-4 py-3">{inv.description}</td>
                <td className="px-4 py-3 font-medium">{formatMinor(inv.totalMinor, inv.currency)}</td>
                <td className="px-4 py-3">
                  <Badge
                    tone={
                      inv.status === "paid"
                        ? "success"
                        : inv.status === "refunded"
                          ? "warning"
                          : inv.status === "void"
                            ? "neutral"
                            : "gold"
                    }
                  >
                    {inv.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/app/billing/invoices/${inv.id}`}>
                    <Button size="sm" variant="secondary">
                      View
                    </Button>
                  </Link>
                </td>
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

function Subscriptions({
  data,
  setData,
}: {
  data: BillingOverviewData;
  setData: (d: BillingOverviewData) => void;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  if (data.subscriptions.length === 0) {
    return (
      <EmptyState
        icon={<Repeat className="h-5 w-5" />}
        title="No subscriptions"
        description="Plans and recurring services will appear here. Recurring charging is not active in this release."
      />
    );
  }

  async function act(id: string, action: "cancel" | "pause" | "resume") {
    setBusy(id);
    try {
      await changeSubscription(id, action);
      showToast(`Subscription ${action === "resume" ? "resumed" : action}.`);
      setData(await fetchBillingOverview());
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {data.subscriptions.map((s) => (
        <Card key={s.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{s.planSnapshot.planName}</p>
              <p className="text-xs text-muted-foreground">
                {formatMinor(s.planSnapshot.amountMinor, s.planSnapshot.currency)} /{" "}
                {s.planSnapshot.interval} · next billing{" "}
                {s.nextBillingDate ? new Date(s.nextBillingDate).toLocaleDateString() : "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                tone={
                  s.status === "active" ? "success" : s.status === "cancelled" ? "neutral" : s.status === "past_due" || s.status === "failed" ? "danger" : "gold"
                }
              >
                {s.status}
              </Badge>
              {s.status === "active" ? (
                <>
                  <Button size="sm" variant="secondary" loading={busy === s.id} onClick={() => void act(s.id, "pause")}>
                    Pause
                  </Button>
                  <Button size="sm" variant="ghost" loading={busy === s.id} onClick={() => void act(s.id, "cancel")}>
                    Cancel
                  </Button>
                </>
              ) : s.status === "paused" ? (
                <Button size="sm" variant="secondary" loading={busy === s.id} onClick={() => void act(s.id, "resume")}>
                  Resume
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
      <p className="text-xs text-muted-foreground/70">
        Demo billing — subscriptions are modelled but no automatic recurring charges occur in
        this release.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

function PaymentMethods({ data }: { data: BillingOverviewData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment methods</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <CreditCard className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">{data.paymentMethod.label}</p>
            <p className="text-xs text-muted-foreground">
              Development environment — no card data is ever collected or stored.
            </p>
          </div>
          {data.paymentMethod.isDefault ? <Badge tone="neutral">Default</Badge> : null}
        </div>
        <p className="text-xs text-muted-foreground/70">
          Real provider-backed payment methods will be supported when live payments are enabled.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const tone =
    status === "paid"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "refunded" || status === "partially_refunded"
          ? "warning"
          : status === "pending" || status === "authorized"
            ? "gold"
            : "neutral";
  return <Badge tone={tone}>{status.replace("_", " ")}</Badge>;
}

// ---------------------------------------------------------------------------
// Global Plan summary (Prompt 13) — the commercial center of billing
// ---------------------------------------------------------------------------

function PlanSummary() {
  const [plan, setPlan] = useState<EntitlementsView | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyPlan()
      .then(setPlan)
      .catch((err) => setPlanError(err instanceof Error ? err.message : null));
  }, []);

  if (planError) return null; // Non-essential panel; billing data still renders.
  if (plan === null) return <Skeleton className="h-28 w-full" />;

  const p = plan.plan;
  return (
    <Card className="mb-4">
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your OneNumbr plan</p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">{p.name}</p>
            <p className="text-xs text-muted-foreground">
              {p.priceMinor !== null && p.currency
                ? `${formatMinor(p.priceMinor, p.currency)} / month · demo billing — no real charges`
                : "Demo billing — no real charges"}
              {p.currentPeriodEnd ? ` · renews ${new Date(p.currentPeriodEnd).toLocaleDateString()}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <UnifiedStatusBadge status={p.status} />
            <Button size="sm" variant="secondary" onClick={() => (window.location.href = "/app/billing/plan")}>
              View plan
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {plan.usage.primaryNumber
            ? `Includes your number ${plan.usage.primaryNumber}, communications and connected endpoints.`
            : "Activate your OneNumbr Number to start your Global Plan benefits."}
        </p>
      </CardContent>
    </Card>
  );
}

