"use client";

// =============================================================================
// /app/number/[numberId] — number detail & management (owner only).
//
// States: activating (provisioning) → active (manage + release) → failed
// (payment recorded, needs attention) → released (history). Coming-soon
// features are labelled honestly — no fake functionality.
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle, DataRow } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast";
import {
  fetchNumberDetail,
  releaseNumber,
  NumberApiError,
} from "@/services/numberService";
import type { MyNumber } from "@/types/number";
import { PhoneCall, MessageSquare, Forward, Voicemail, Settings2, AlertTriangle } from "lucide-react";

export default function NumberDetailPage() {
  return (
    <AuthGuard>
      <DetailInner />
    </AuthGuard>
  );
}

function DetailInner() {
  const params = useParams<{ numberId: string }>();
  const { showToast } = useToast();
  const [number, setNumber] = useState<MyNumber | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [justActivated, setJustActivated] = useState(false);

  useEffect(() => {
    setJustActivated(window.location.search.includes("activated=1"));
    fetchNumberDetail(params.numberId)
      .then((d) => setNumber(d.number))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load number."));
  }, [params.numberId]);

  async function handleRelease() {
    if (!number || releasing) return;
    setReleasing(true);
    try {
      await releaseNumber(number.numberId);
      showToast("Number released.");
      setReleaseOpen(false);
      // Refresh state — assignment history is preserved.
      fetchNumberDetail(params.numberId)
        .then((d) => setNumber(d.number))
        .catch(() => undefined);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Release failed.", "error");
    } finally {
      setReleasing(false);
    }
  }

  if (error) {
    return (
      <EmptyState
        title="Number unavailable"
        description={error}
        action={
          <Link href="/app/number">
            <Button variant="secondary">Back to numbers</Button>
          </Link>
        }
      />
    );
  }

  if (number === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading your number…" />
        </CardContent>
      </Card>
    );
  }

  const n = number;
  const active = n.status === "active";

  return (
    <div className="mx-auto max-w-3xl">
      {justActivated && active ? (
        <div
          role="status"
          className="animate-fade-up mb-4 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm"
        >
          Your OneNumbr number is active. It&apos;s linked to your OneNumbr ID and stays
          yours until you release it.
        </div>
      ) : null}

      {/* Number hero */}
      <div className="glass-gold rounded-2xl px-6 py-8 text-center sm:px-8">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Your OneNumbr Number
        </p>
        <p className="mt-3 font-mono text-4xl font-semibold tracking-wider text-primary">
          {n.displayNumber}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
          <StatusBadge status={n.status} />
          {n.capabilities.map((c) => (
            <Badge key={c} tone="neutral">{c}</Badge>
          ))}
        </div>
        {n.status === "provisioning" ? (
          <p className="mt-3 text-sm text-muted-foreground">Activating… this usually takes a moment.</p>
        ) : null}
        {n.status === "failed" ? (
          <p className="mt-3 text-sm text-destructive">
            We couldn&apos;t activate your number. Your payment has been recorded and activation
            needs attention — our team can retry it.
          </p>
        ) : null}
      </div>

      {/* Failure / non-active guidance */}
      {n.status === "failed" ? (
        <Card className="mt-4 border-destructive/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-sm">Activation needs attention. You won&apos;t be charged again for a retry.</p>
            </div>
            <Link href="/app/number/checkout?number=missing">
              <Button size="sm" variant="secondary">View details below</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {/* Details */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <DataRow label="Status">
            <StatusBadge status={n.status} />
          </DataRow>
          <DataRow label="Capabilities">{n.capabilities.join(" · ")}</DataRow>
          <DataRow label="Plan">
            ${n.monthlyPrice.toFixed(2)} {n.currency} / month
          </DataRow>
          <DataRow label="Type">{n.type.replace("_", " ")}</DataRow>
          <DataRow label="Activated">
            {n.activatedAt ? new Date(n.activatedAt).toLocaleDateString() : "—"}
          </DataRow>
          {n.releasedAt ? (
            <DataRow label="Released">
              {new Date(n.releasedAt).toLocaleDateString()}
            </DataRow>
          ) : null}
          <DataRow label="Provider">
            {n.provider === "mock-telecom" ? "Mock Telecom Provider (development)" : n.provider}
          </DataRow>
        </CardContent>
      </Card>

      {/* Settings (honest coming-soon states) */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Number settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <SettingRow icon={<PhoneCall className="h-4 w-4" />} label="Call settings" />
          <SettingRow icon={<MessageSquare className="h-4 w-4" />} label="SMS settings" />
          <SettingRow icon={<Forward className="h-4 w-4" />} label="Call forwarding" />
          <SettingRow icon={<Voicemail className="h-4 w-4" />} label="Voicemail" />
          <SettingRow icon={<Settings2 className="h-4 w-4" />} label="Advanced routing" />
        </CardContent>
      </Card>

      {/* Actions */}
      {active ? (
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setReleaseOpen(true)}>
            Release number
          </Button>
        </div>
      ) : null}

      <Modal
        open={releaseOpen}
        onClose={() => (releasing ? undefined : setReleaseOpen(false))}
        title="Release this number?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReleaseOpen(false)} disabled={releasing}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRelease} loading={releasing}>
              Release number
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Releasing <span className="font-mono text-foreground">{n.displayNumber}</span> may make
          it unavailable for future use, and others could claim it later. Your OneNumbr ID is
          unaffected — you can activate a new number anytime.
        </p>
      </Modal>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "released"
          ? "neutral"
          : status === "suspended"
            ? "warning"
            : "gold";
  const label = status === "provisioning" ? "activating" : status;
  return <Badge tone={tone}>{label}</Badge>;
}

function SettingRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3 py-2.5">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
        Coming soon
      </span>
    </div>
  );
}
