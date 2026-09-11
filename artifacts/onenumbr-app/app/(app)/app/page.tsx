"use client";

// =============================================================================
// /app — Dashboard (command center)
//
// One summary call (GET /api/account) feeds every card — no per-card fan-out.
// Hierarchy follows the product priority: identity hero → state grid
// (Identity / Number / eSIM / Billing / Security) → next steps.
// =============================================================================

import Link from "next/link";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { Skeleton } from "@/components/ui/EmptyState";
import { useAuthContext } from "@/hooks/useAuth";
import { useKyc } from "@/hooks/useKyc";
import { useEffect, useState } from "react";
import { fetchAccountSummary } from "@/services/accountService";
import { getNextBestAction } from "@/lib/product-state";
import type { AccountSummary } from "@/types/account";
import {
  Fingerprint,
  Hash,
  MessagesSquare,
  SignalHigh,
  CreditCard,
  ShieldCheck,
  Gem,
  ArrowRight,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardInner />
    </AuthGuard>
  );
}

function DashboardInner() {
  const { account } = useAuthContext();
  const { kyc } = useKyc("live");

  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);

  useEffect(() => {
    fetchAccountSummary()
      .then(setSummary)
      .catch(() => setSummaryError(true));
  }, []);

  if (!account) return null;

  const { profile } = account;
  const s = summary;
  const name = profile?.fullName?.split(" ")[0] ?? "";

  const kycLabel =
    !s ? null
    : s.kycState === "verified" ? "verified"
    : s.kycState === "pending" ? "under_review"
    : s.kycState === "resubmission_required" ? "resubmission_required"
    : s.kycState === "rejected" ? "unverified"
    : "not_verified";

  // Next best action — deterministic, from the product state engine.
  const nba = s ? renderNextBestAction(getNextBestAction(s)) : (
    <Skeleton className="h-24 w-full rounded-xl" />
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={`Welcome${name ? `, ${name}` : ""}`}
        description="One identity. One number. Anywhere. This is your OneNumbr home."
      />

      {/* Action-needed banners (only when relevant) */}
      {s && !s.profile?.emailVerified ? (
        <Alert tone="warning" title="Verify your email" className="mb-6">
          Some features stay locked until your email is verified.{" "}
          <Link href="/verify-email" className="underline">
            Resend verification
          </Link>
        </Alert>
      ) : null}
      {s && s.kycState === "resubmission_required" ? (
        <Alert tone="warning" title="Identity verification needs attention" className="mb-6">
          We couldn't accept your previous submission.{" "}
          <Link href="/app/identity" className="underline">
            Review and resubmit
          </Link>
        </Alert>
      ) : null}

      {/* OneNumbr ID hero (live identity listener preserved) */}
      <div className="glass-gold animate-fade-up rounded-2xl px-6 py-8 sm:px-10">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          OneNumbr ID
        </p>
        <p className="onenumbr-mark mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
          {account.identity?.onenumbr ?? "—"}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={account.identity?.status === "active" ? "active" : "inactive"} />
          {kycLabel ? <StatusBadge status={kycLabel} /> : <Skeleton className="h-5 w-24 rounded-full" />}
        </div>
      </div>

      {/* Unified state grid — from the account summary */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StateCard
          href="/app/identity"
          icon={<Fingerprint className="h-4 w-4" />}
          label="Identity"
          value={
            !s ? <Skeleton className="h-4 w-24" />
            : <StatusBadge status={kycLabel ?? "not_verified"} />
          }
          hint={
            !s ? ""
            : s.kycState === "verified" ? "All services unlocked"
            : s.kycState === "pending" ? "Team is reviewing your documents"
            : "Unlock number activation and more"
          }
          highlight={s?.kycState === "verified"}
        />
        <StateCard
          href={s?.number ? `/app/number/${s.number.numberId}` : "/app/number"}
          icon={<Hash className="h-4 w-4" />}
          label="Number"
          value={!s ? <Skeleton className="h-4 w-20" /> : s.number ? <span className="font-mono text-primary">{s.number.displayNumber}</span> : <span className="text-muted-foreground">Not activated</span>}
          hint={
            !s ? ""
            : s.number ? `Active · ${s.number.capabilities.join(" • ")}`
            : s.kycState === "verified" ? "Choose your OneNumbr number"
            : "Available after identity verification"
          }
          highlight={Boolean(s?.number)}
        />
        <StateCard
          href="/app/communications"
          icon={<MessagesSquare className="h-4 w-4" />}
          label="Communications"
          value={!s ? <Skeleton className="h-4 w-28" /> : s.number ? <span className="font-mono">{s.number.displayNumber}</span> : <span className="text-muted-foreground">Requires your Number</span>}
          hint={
            !s ? ""
            : s.number ? "Voice · Messages · Voicemail (demo provider)"
            : "Available after you activate a Number"
          }
          highlight={Boolean(s?.number)}
        />
        <StateCard
          href="/app/connectivity"
          icon={<SignalHigh className="h-4 w-4" />}
          label="Connectivity"
          value={!s ? <Skeleton className="h-4 w-28" /> : s.esim ? `${s.esim.flag} ${s.esim.countryName}` : <span className="text-muted-foreground">Not set up</span>}
          hint={
            s?.esim ? `${s.esim.planName} · ${s.esim.status} (demo)`
            : "Included with your Global Plan — demo environment"
          }
          highlight={Boolean(s?.esim)}
        />
        <StateCard
          href="/app/billing"
          icon={<CreditCard className="h-4 w-4" />}
          label="Billing"
          value={!s ? <Skeleton className="h-4 w-24" /> : s.billing.lastPaymentDescription ?? <span className="text-muted-foreground">No payments yet</span>}
          hint={
            s?.billing.lastPaymentAt
              ? `${new Date(s.billing.lastPaymentAt).toLocaleDateString()}`
              : "Payments and invoices"
          }
          highlight={s?.billing.lastPaymentStatus === "paid"}
        />
        <StateCard
          href="/app/security"
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Security"
          value={
            !s ? <Skeleton className="h-4 w-20" />
            : <StatusBadge status={s.security.securityStatus === "good" ? "good" : "needs_attention"} />
          }
          hint={
            !s ? ""
            : `${s.security.activeSessionCount} active ${s.security.activeSessionCount === 1 ? "session" : "sessions"}${
                s.device?.deviceName ? ` · ${s.device.deviceName}` : ""
              }`
          }
          highlight={s?.security.securityStatus === "good"}
        />
        <StateCard
          href="/app/billing/plan"
          icon={<Gem className="h-4 w-4" />}
          label="Global Plan"
          value={
            !s ? <Skeleton className="h-4 w-24" />
            : <StatusBadge status={s.plan.status} />
          }
          hint={
            !s ? ""
            : s.plan.status === "none"
              ? "Included with your number activation"
              : `${s.plan.name} · demo billing — no real charges`
          }
          highlight={s?.plan.status === "active"}
        />
      </div>

      {/* Next best action — ONE dominant recommendation */}
      <div className="mt-8">{nba}</div>
    </div>
  );
}

function StateCard({
  href,
  icon,
  label,
  value,
  hint,
  highlight,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href} className="group block">
      <Card className={highlight ? "h-full border-primary/30 transition-colors group-hover:border-primary/50" : "h-full transition-colors group-hover:border-primary/40"}>
        <CardContent>
          <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            {icon}
            {label}
          </span>
          <p className="mt-2 truncate text-sm font-medium">{value}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function NextAction({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/40"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        {title}
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 transition-colors group-hover:text-primary" aria-hidden="true" />
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </Link>
  );
}

/** The one dominant recommendation card. */
function renderNextBestAction(nba: NonNullable<ReturnType<typeof getNextBestAction>>) {
  return (
    <div className="glass-gold flex flex-col gap-4 rounded-xl px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">What's next</p>
        <p className="mt-1 text-base font-semibold">{nba.title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{nba.explanation}</p>
      </div>
      <Link href={nba.href} className="shrink-0">
        <Button size="lg">{nba.cta}</Button>
      </Link>
    </div>
  );
}
