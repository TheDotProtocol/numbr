"use client";

// =============================================================================
// /app/identity — central identity hub (OneNumbr ID + verification status)
// =============================================================================

import { useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, DataRow } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAuthContext } from "@/hooks/useAuth";
import { useKyc } from "@/hooks/useKyc";
import { countryLabel } from "@/lib/countries";
import { deriveIdentityState, REJECTION_REASON_COPY } from "@/types/kyc";
import { ShieldCheck, Clock, XCircle, ArrowRight } from "lucide-react";

export default function IdentityPage() {
  return (
    <AuthGuard>
      <IdentityInner />
    </AuthGuard>
  );
}

function IdentityInner() {
  const { account, firebaseUser } = useAuthContext();
  const { kyc, loaded } = useKyc("once");

  if (!account) return null;
  const { user, profile, identity } = account;
  const identityState = deriveIdentityState(kyc);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Identity"
        description="Your OneNumbr identity, verification status and account information."
      />

      {/* OneNumbr ID */}
      <div className="glass-gold animate-fade-up rounded-2xl px-6 py-7 sm:px-8">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          OneNumbr ID
        </p>
        <p className="gold-gradient-text mt-2 font-mono text-3xl font-bold tracking-wider sm:text-4xl">
          {identity?.onenumbr ?? "—"}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <StatusBadge status={identity?.status ?? "active"} />
          <span className="text-xs text-muted-foreground">
            Permanent · Cannot be changed
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {/* Identity verification — now the live KYC state */}
        <Card>
          <CardHeader>
            <CardTitle>Identity Verification</CardTitle>
          </CardHeader>
          <CardContent>
            {!loaded ? (
              <p className="py-2 text-sm text-muted-foreground">Checking status…</p>
            ) : identityState === "verified" ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-success/40 bg-success/10 text-success">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      Identity verified <Badge tone="success">Verified</Badge>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {kyc?.reviewedAt
                        ? `Verified ${new Date(kyc.reviewedAt).toLocaleDateString()}`
                        : "All services unlocked"}
                    </p>
                  </div>
                </div>
                <Link href="/app/identity/verification">
                  <Button variant="secondary" size="sm">
                    Details
                  </Button>
                </Link>
              </div>
            ) : identityState === "pending" ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      Verification under review <Badge tone="gold">In review</Badge>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      The verification team is reviewing your documents.
                    </p>
                  </div>
                </div>
                <Link href="/app/identity/verification">
                  <Button variant="secondary" size="sm">
                    Status
                  </Button>
                </Link>
              </div>
            ) : identityState === "resubmission_required" ? (
              <ActionRequiredCard kyc={kyc} />
            ) : identityState === "rejected" ? (
              <RejectedCard kyc={kyc} />
            ) : (
              /* not_started */
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Badge tone="neutral">Not started</Badge>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                    Verification will allow you to activate additional OneNumbr
                    services, including your OneNumbr number and eSIM purchases.
                  </p>
                </div>
                <Link href="/app/identity/verification/start">
                  <Button>Start Verification</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account status */}
        <Card>
          <CardHeader>
            <CardTitle>Account status</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/40">
            <DataRow label="Account status">
              <StatusBadge status={user.status} />
            </DataRow>
            <DataRow label="Email">
              <span className="inline-flex items-center gap-2">
                {user.email}
                {firebaseUser?.emailVerified ? (
                  <Badge tone="success">Verified</Badge>
                ) : (
                  <Badge tone="warning">Unverified</Badge>
                )}
              </span>
            </DataRow>
            <DataRow label="Role">
              <Badge>{user.role}</Badge>
            </DataRow>
          </CardContent>
        </Card>

        {/* Profile information */}
        <Card>
          <CardHeader>
            <CardTitle>Profile information</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/40">
            <DataRow label="Name">{profile?.fullName || "—"}</DataRow>
            <DataRow label="Country">
              {profile?.country ? countryLabel(profile.country) : "—"}
            </DataRow>
            <DataRow label="Phone">{profile?.phone || "—"}</DataRow>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// State-specific cards
// -----------------------------------------------------------------------------

function ActionRequiredCard({
  kyc,
}: {
  kyc: ReturnType<typeof useKyc>["kyc"];
}) {
  const reason = kyc?.rejectionReason ?? "other";
  const copy =
    REJECTION_REASON_COPY[reason as keyof typeof REJECTION_REASON_COPY] ??
    REJECTION_REASON_COPY.other;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-warning/40 bg-warning/10 text-warning">
          <XCircle className="h-4 w-4" />
        </div>
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            Action required <Badge tone="warning">Resubmit</Badge>
          </p>
          <p className="mt-0.5 max-w-md text-xs leading-relaxed text-muted-foreground">
            {copy}
          </p>
        </div>
      </div>
      <Link href="/app/identity/verification/start">
        <Button size="sm">Resubmit</Button>
      </Link>
    </div>
  );
}

function RejectedCard({ kyc }: { kyc: ReturnType<typeof useKyc>["kyc"] }) {
  const reason = kyc?.rejectionReason ?? "other";
  const copy =
    REJECTION_REASON_COPY[reason as keyof typeof REJECTION_REASON_COPY] ??
    REJECTION_REASON_COPY.other;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10 text-destructive">
          <XCircle className="h-4 w-4" />
        </div>
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            Verification unsuccessful <Badge tone="danger">Rejected</Badge>
          </p>
          <p className="mt-0.5 max-w-md text-xs leading-relaxed text-muted-foreground">
            {copy}
          </p>
        </div>
      </div>
      <Link href="/app/identity/verification/start">
        <Button size="sm">Submit again</Button>
      </Link>
    </div>
  );
}
