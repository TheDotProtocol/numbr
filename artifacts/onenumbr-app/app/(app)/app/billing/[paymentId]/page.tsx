"use client";

// =============================================================================
// /app/billing/[paymentId] — transaction detail (owner-checked server-side).
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle, DataRow } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { fetchPayment, fetchInvoices } from "@/services/billingService";
import { formatMinor, type InvoiceRecord, type PaymentRecord } from "@/types/billing";
import { StatusBadge } from "@/app/(app)/app/billing/page";

export default function TransactionDetailPage() {
  return (
    <AuthGuard>
      <DetailInner />
    </AuthGuard>
  );
}

function DetailInner() {
  const params = useParams<{ paymentId: string }>();
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPayment(params.paymentId)
      .then(async (d) => {
        setPayment(d.payment);
        const inv = await fetchInvoices();
        setInvoice(inv.invoices.find((i) => i.paymentId === d.payment.id) ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load transaction."));
  }, [params.paymentId]);

  if (error) {
    return (
      <EmptyState
        title="Transaction unavailable"
        description={error}
        action={
          <Link href="/app/billing">
            <Button variant="secondary">Back to billing</Button>
          </Link>
        }
      />
    );
  }

  if (payment === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading transaction…" />
        </CardContent>
      </Card>
    );
  }

  const p = payment;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link href="/app/billing" className="text-xs text-muted-foreground hover:text-primary">
          ← Billing
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Transaction</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{p.description}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataRow label="Amount">
            <span className="text-base font-semibold text-primary">
              {formatMinor(p.amountMinor, p.currency)}
            </span>
          </DataRow>
          <DataRow label="Status">
            <StatusBadge status={p.status} />
          </DataRow>
          <DataRow label="Type">{p.orderType}</DataRow>
          <DataRow label="Date">
            {p.createdAt ? new Date(p.createdAt).toLocaleString() : "—"}
          </DataRow>
          <DataRow label="Payment ID">
            <span className="font-mono text-xs">{p.id}</span>
          </DataRow>
          <DataRow label="Provider">
            {p.provider === "mock" ? "Mock Payment Provider" : p.provider}
          </DataRow>
          {p.status === "refunded" || p.status === "partially_refunded" ? (
            <DataRow label="Refunded">
              {formatMinor(p.refundedAmountMinor, p.currency)}
              {p.refundReason ? ` — ${p.refundReason}` : ""}
            </DataRow>
          ) : null}
          {invoice ? (
            <DataRow label="Invoice">
              <Link
                href={`/app/billing/invoices/${invoice.id}`}
                className="font-mono text-xs text-primary hover:underline"
              >
                {invoice.invoiceNumber}
              </Link>
            </DataRow>
          ) : null}
          {p.relatedOrderFailed ? (
            <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-muted-foreground">
              The payment succeeded but the service activation needs attention — our team has
              been notified and can retry it. You won&apos;t be charged again.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
