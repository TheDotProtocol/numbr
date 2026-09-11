"use client";

// =============================================================================
// /app/identity/verification — status timeline (realtime doc listener).
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/EmptyState";
import { useAuthContext } from "@/hooks/useAuth";
import {
  observeKycStatus,
  getKycHistory,
} from "@/services/kycService";
import {
  REJECTION_REASON_COPY,
  type KycRecord,
  type KycHistoryEntry,
  type KycStatus,
} from "@/types/kyc";
import { CheckCircle2, Circle, CircleDot, Clock, Check, XCircle } from "lucide-react";

export default function KycStatusPage() {
  const { firebaseUser } = useAuthContext();
  const [kyc, setKyc] = useState<KycRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<KycHistoryEntry[]>([]);

  const uid = firebaseUser?.uid;

  // Single doc listener — genuine UX value (status changes without refresh).
  useEffect(() => {
    if (!uid) return;
    const unsub = observeKycStatus(uid, (record) => {
      setKyc(record);
      setLoaded(true);
    });
    return () => unsub();
  }, [uid]);

  // One-shot history read (no listener needed).
  useEffect(() => {
    if (!uid) return;
    getKycHistory(uid)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [uid, kyc?.status, kyc?.attempt]);

  if (!loaded) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Identity Verification" />
        <Card>
          <CardContent>
            <LoadingState label="Loading verification status…" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = kyc?.status ?? "not_started";

  if (status === "not_started" || status === "draft") {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Identity Verification" />
        <EmptyStart />
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Identity Verification" />
        <Card className="animate-fade-up border-success/30">
          <CardContent className="py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-success/40 bg-success/10 text-success">
              <Check className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">Identity verified</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your OneNumbr identity has been verified.
            </p>
            {kyc?.reviewedAt ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Verified {new Date(kyc.reviewedAt).toLocaleDateString()}
              </p>
            ) : null}
            <div className="mt-6">
              <Link href="/app">
                <Button variant="secondary">Back to dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        <HistoryCard history={history} />
      </div>
    );
  }

  if (status === "rejected" || status === "resubmission_required") {
    const reason = kyc?.rejectionReason ?? "other";
    const copy = REJECTION_REASON_COPY[reason as keyof typeof REJECTION_REASON_COPY] ?? REJECTION_REASON_COPY.other;
    const isResubmission = status === "resubmission_required";
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Identity Verification" />
        <Card className="animate-fade-up border-warning/30">
          <CardContent className="py-8">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-warning/40 bg-warning/10 text-warning">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  {isResubmission ? "Your document could not be verified" : "Verification unsuccessful"}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{copy}</p>
                <div className="mt-4">
                  <Link href="/app/identity/verification/start">
                    <Button>{isResubmission ? "Resubmit verification" : "Submit again"}</Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <HistoryCard history={history} />
      </div>
    );
  }

  // submitted / under_review → pending timeline
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Identity Verification" />
      <Card className="animate-fade-up">
        <CardHeader>
          <CardTitle>Current status</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline status={status} />
          <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <Badge tone="gold">{status === "under_review" ? "Under review" : "Submitted"}</Badge>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your documents have been submitted and are being reviewed by the
              OneNumbr verification team. We&apos;ll notify you here and by
              email when the review is complete.
            </p>
            {kyc?.submittedAt ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Submitted {new Date(kyc.submittedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <HistoryCard history={history} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Timeline
// -----------------------------------------------------------------------------

function Timeline({ status }: { status: KycStatus }) {
  const stages = [
    { label: "Information submitted", at: "submitted" },
    { label: "Documents received", at: "documents" },
    { label: "Manual review", at: "review" },
    { label: "Verification complete", at: "complete" },
  ];

  const reached = (at: string): boolean => {
    if (status === "submitted") return at === "submitted";
    if (status === "under_review") return at === "submitted" || at === "documents" || at === "review";
    return true; // approved
  };

  const current = (at: string): boolean =>
    (status === "submitted" && at === "documents") ||
    (status === "under_review" && at === "review");

  return (
    <ol className="space-y-4" aria-label="Verification progress">
      {stages.map((s) => {
        const Icon = reached(s.at) ? CheckCircle2 : current(s.at) ? CircleDot : Circle;
        const tone = reached(s.at)
          ? "text-success"
          : current(s.at)
            ? "text-primary"
            : "text-muted-foreground/50";
        return (
          <li key={s.label} className="flex items-center gap-3">
            <Icon className={`h-5 w-5 shrink-0 ${tone}`} />
            <span
              className={`text-sm ${
                reached(s.at) || current(s.at) ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
            </span>
            {current(s.at) ? (
              <span className="ml-auto text-xs text-primary">In progress</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function HistoryCard({ history }: { history: KycHistoryEntry[] }) {
  if (history.length === 0) return null;
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border/40">
          {history.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <span>{humanAction(h.action)}</span>
              <span className="text-xs text-muted-foreground">
                {h.createdAt ? new Date(h.createdAt).toLocaleString() : "—"}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function humanAction(action: string): string {
  switch (action) {
    case "kyc.submitted":
      return "Verification submitted";
    case "kyc.review_started":
      return "Review started";
    case "kyc.approved":
      return "Approved";
    case "kyc.rejected":
      return "Rejected";
    case "kyc.resubmission_requested":
      return "Resubmission requested";
    case "kyc.draft_saved":
      return "Draft saved";
    default:
      return action;
  }
}

function EmptyStart() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/30 px-6 py-14 text-center">
      <h3 className="text-base font-semibold">Your identity verification hasn&apos;t started yet</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
        Verification unlocks services that require a verified identity.
      </p>
      <div className="mt-5">
        <Link href="/app/identity/verification/start">
          <Button>Start verification</Button>
        </Link>
      </div>
    </div>
  );
}
