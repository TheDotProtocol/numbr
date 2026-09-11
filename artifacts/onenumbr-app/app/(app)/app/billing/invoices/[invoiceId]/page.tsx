"use client";

// =============================================================================
// /app/billing/invoices/[invoiceId] — invoice detail (owner-checked).
// Print-friendly: browser print produces a clean A4 document (window.print()).
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { useAuthContext } from "@/hooks/useAuth";
import { fetchInvoice } from "@/services/billingService";
import { formatMinor, type InvoiceRecord } from "@/types/billing";
import { Printer } from "lucide-react";

export default function InvoiceDetailPage() {
  return (
    <AuthGuard>
      <InvoiceInner />
    </AuthGuard>
  );
}

function InvoiceInner() {
  const params = useParams<{ invoiceId: string }>();
  const { account } = useAuthContext();
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoice(params.invoiceId)
      .then((d) => setInvoice(d.invoice))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load invoice."));
  }, [params.invoiceId]);

  if (error) {
    return (
      <EmptyState
        title="Invoice unavailable"
        description={error}
        action={
          <Link href="/app/billing">
            <Button variant="secondary">Back to billing</Button>
          </Link>
        }
      />
    );
  }

  if (invoice === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading invoice…" />
        </CardContent>
      </Card>
    );
  }

  const inv = invoice;
  const profile = account?.profile;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/app/billing" className="text-xs text-muted-foreground hover:text-primary">
          ← Billing
        </Link>
        <Button size="sm" variant="secondary" onClick={() => window.print()}>
          <Printer className="mr-1.5 inline h-3.5 w-3.5" /> Print / Save PDF
        </Button>
      </div>

      {/* Invoice document */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
            <div>
              <p className="onenumbr-mark text-xl font-bold tracking-tight">
                <span className="gold-gradient-text">ONE</span>NUMBR
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                One identity. One number. Anywhere.
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-semibold">{inv.invoiceNumber}</p>
              <p className="mt-1 text-xs text-muted-foreground">Invoice date: {inv.invoiceDate}</p>
              <div className="mt-2">
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
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="grid gap-4 border-b border-border py-6 sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Billed to</p>
              <p className="mt-1 text-sm font-medium">{profile?.fullName ?? "OneNumbr customer"}</p>
              <p className="text-xs text-muted-foreground">{account?.user.email ?? ""}</p>
              {profile?.country ? (
                <p className="text-xs text-muted-foreground">{profile.country}</p>
              ) : null}
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Issued by</p>
              <p className="mt-1 text-sm font-medium">AR Holdings — OneNumbr</p>
              <p className="text-xs text-muted-foreground">Global digital identity &amp; connectivity</p>
            </div>
          </div>

          {/* Line items */}
          <div className="py-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Unit price</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/40">
                  <td className="py-3">{inv.description}</td>
                  <td className="py-3 text-right">1</td>
                  <td className="py-3 text-right">{formatMinor(inv.subtotalMinor, inv.currency)}</td>
                  <td className="py-3 text-right">{formatMinor(inv.subtotalMinor, inv.currency)}</td>
                </tr>
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMinor(inv.subtotalMinor, inv.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{inv.taxMinor ? formatMinor(inv.taxMinor, inv.currency) : "—"}</span>
              </div>
              {inv.discountMinor ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-{formatMinor(inv.discountMinor, inv.currency)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Total</span>
                <span className="text-primary">{formatMinor(inv.totalMinor, inv.currency)}</span>
              </div>
              <p className="pt-1 text-right text-[10px] text-muted-foreground">
                Tax not configured in this release.
              </p>
            </div>
          </div>

          <p className="border-t border-border pt-4 text-[10px] leading-relaxed text-muted-foreground">
            This invoice was issued electronically by OneNumbr. Development note: payments in this
            environment are processed by the Mock Payment Provider; no real funds are transferred.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
