"use client";

// =============================================================================
// /app/account — Account Center overview (control plane for the platform).
// One summary call (GET /api/account) feeds the whole page — free-tier
// friendly, no per-card reads.
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, DataRow } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { fetchAccountSummary } from "@/services/accountService";
import { formatMinor } from "@/types/billing";
import type { AccountSummary } from "@/types/account";
import { Fingerprint, Hash, SignalHigh, ShieldCheck, CreditCard, ArrowRight } from "lucide-react";

export default function AccountOverviewPage() {
  return (
    <AuthGuard>
      <OverviewInner />
    </AuthGuard>
  );
}

function OverviewInner() {
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccountSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load account."));
  }, []);

  if (error) {
    return <EmptyState title="Couldn't load your account" description={error} />;
  }
  if (summary === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading your account…" />
        </CardContent>
      </Card>
    );
  }

  const s = summary;

  return (
    <>
      <PageHeader
        title="Account"
        description="Your OneNumbr control center — identity, connectivity, security and billing in one place."
      />

      {/* Identity hero */}
      <div className="glass-gold rounded-2xl px-6 py-8 text-center sm:px-8">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          OneNumbr ID
        </p>
        <p className="mt-2 font-mono text-4xl font-semibold tracking-wider text-primary">
          {s.onenumbrId ?? "—"}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <KycBadge state={s.kycState} />
          {s.security.emailVerified ? (
            <Badge tone="success">Email verified</Badge>
          ) : (
            <Badge tone="warning">Email unverified</Badge>
          )}
        </div>
      </div>

      {/* Unified state grid */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SummaryCard
          icon={<Hash className="h-4 w-4" />}
          title="Number"
          value={s.number ? s.number.displayNumber : "Not activated"}
          hint={s.number ? `Active · ${s.number.capabilities.join(" · ")}` : "Choose your OneNumbr number"}
          href={s.number ? `/app/number/${s.number.numberId}` : "/app/number"}
        />
        <SummaryCard
          icon={<SignalHigh className="h-4 w-4" />}
          title="Connectivity"
          value={s.esim ? `${s.esim.flag} ${s.esim.countryName}` : "No active eSIM"}
          hint={s.esim ? `${s.esim.planName} · ${s.esim.status}` : "Browse the eSIM marketplace"}
          href="/app/esim"
        />
        <SummaryCard
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Security"
          value={s.security.securityStatus === "good" ? "Protected" : "Needs attention"}
          hint={`${s.security.activeSessionCount} active ${s.security.activeSessionCount === 1 ? "session" : "sessions"}${
            s.device?.deviceName ? ` · ${s.device.deviceName}` : ""
          }`}
          href="/app/security"
        />
        <SummaryCard
          icon={<CreditCard className="h-4 w-4" />}
          title="Billing"
          value={
            s.billing.lastPaymentDescription
              ? s.billing.lastPaymentDescription
              : "No payments yet"
          }
          hint={
            s.billing.lastPaymentAt
              ? `${new Date(s.billing.lastPaymentAt).toLocaleDateString()} · ${s.billing.lastPaymentStatus}`
              : "Payments and invoices appear here"
          }
          href="/app/billing"
        />
      </div>

      {/* Account details */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <DataRow label="Name">{s.profile?.fullName || "—"}</DataRow>
          <DataRow label="Email">{s.profile?.email || "—"}</DataRow>
          <DataRow label="Identity verification">
            <KycBadge state={s.kycState} />
          </DataRow>
          <DataRow label="Two-factor authentication">
            {s.security.twoFactorState === "unavailable" ? (
              <Badge tone="neutral">Coming soon</Badge>
            ) : (
              <Badge tone={s.security.twoFactorState === "enabled" ? "success" : "neutral"}>
                {s.security.twoFactorState.replace("_", " ")}
              </Badge>
            )}
          </DataRow>
          <DataRow label="Current device">{s.device?.deviceName ?? "—"}</DataRow>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/app/account/sessions">
          <Button variant="secondary" size="sm">
            Manage sessions <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
          </Button>
        </Link>
        <Link href="/app/account/activity">
          <Button variant="secondary" size="sm">
            Security activity <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
          </Button>
        </Link>
        <Link href="/app/settings">
          <Button variant="secondary" size="sm">
            Profile settings <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </>
  );
}

function KycBadge({ state }: { state: AccountSummary["kycState"] }) {
  const map = {
    verified: <Badge tone="success">Verified</Badge>,
    pending: <Badge tone="gold">In review</Badge>,
    resubmission_required: <Badge tone="warning">Action required</Badge>,
    rejected: <Badge tone="danger">Unverified</Badge>,
    not_verified: <Badge tone="neutral">Not verified</Badge>,
  } as const;
  return map[state];
}

function SummaryCard({
  icon,
  title,
  value,
  hint,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint: string;
  href: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="transition-colors group-hover:border-primary/40">
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              {icon}
              {title}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-colors group-hover:text-primary" />
          </div>
          <p className="mt-2 truncate text-sm font-medium">{value}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
