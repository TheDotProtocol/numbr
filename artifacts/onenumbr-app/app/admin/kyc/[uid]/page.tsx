"use client";

// =============================================================================
// /admin/kyc/[uid] — verification review workstation
//
// Layout: applicant panel (left) · document viewer (center) · decision
// panel (right). Documents load through short-lived server-signed URLs —
// never public. Decisions require confirmation and are audit-logged.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LoadingState, EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast";
import type { KycRecord, KycHistoryEntry, KycRejectionReason } from "@/types/kyc";
import {
  KYC_REJECTION_REASONS,
  REJECTION_REASON_COPY,
  getDocumentTypeInfo,
} from "@/types/kyc";
import { ZoomIn, ZoomOut, RotateCw, ScanFace, FileText } from "lucide-react";

interface DetailPayload {
  kyc: KycRecord;
  applicant: {
    uid: string;
    email: string;
    fullName: string;
    country: string;
    onenumbr: string | null;
    accountCreatedAt: number | null;
  };
  fileUrls: { front?: string; back?: string; selfie?: string };
  history: KycHistoryEntry[];
}

type Decision = "approve" | "reject" | "resubmission";

export default function AdminKycDetailPage() {
  const params = useParams<{ uid: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const [data, setData] = useState<DetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Decision modal state
  const [modal, setModal] = useState<Decision | null>(null);
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/kyc/admin/${params.uid}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Failed to load case (${res.status})`);
      }
      setData((await res.json()) as DetailPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load case.");
    }
  }, [params.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  async function commitDecision() {
    if (!data || !modal) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/kyc/admin/${data.kyc.uid}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: modal,
          reason: modal === "approve" ? undefined : reason,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Decision failed (${res.status})`);
      }
      showToast(
        modal === "approve"
          ? "Identity approved."
          : modal === "reject"
            ? "Verification rejected."
            : "Resubmission requested.",
        "success",
      );
      setModal(null);
      setReason("");
      setNotes("");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Decision failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <EmptyState
          title="Couldn't load verification case"
          description={error}
          action={
            <Button variant="secondary" onClick={() => router.push("/admin/kyc")}>
              Back to queue
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardContent>
            <LoadingState label="Loading verification case…" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { kyc, applicant, fileUrls, history } = data;
  const typeInfo = kyc.documentType ? getDocumentTypeInfo(kyc.documentType) : undefined;
  const reviewable = kyc.status === "submitted" || kyc.status === "under_review";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={applicant.fullName || applicant.email}
        description={`Verification review · attempt ${kyc.attempt}`}
        actions={
          <Link href="/admin/kyc">
            <Button variant="secondary" size="sm">
              Back to queue
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* ---------------- LEFT: applicant ---------------- */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Applicant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <Info label="Name" value={applicant.fullName || "—"} />
            <Info label="Email" value={applicant.email} />
            <Info label="Account country" value={applicant.country || "—"} />
            <Info
              label="OneNumbr ID"
              value={applicant.onenumbr ?? "—"}
              mono
            />
            <Info label="Document" value={typeInfo?.label ?? "—"} />
            <Info label="Issuing country" value={kyc.documentCountry || "—"} />
            <Info
              label="Submitted"
              value={kyc.submittedAt ? new Date(kyc.submittedAt).toLocaleString() : "—"}
            />
            <Info label="Attempts" value={String(kyc.attempt)} />
            <div className="pt-2">
              <StatusBadge status={kyc.status} />
            </div>
          </CardContent>
        </Card>

        {/* ---------------- CENTER: document viewer ---------------- */}
        <div className="space-y-4 lg:col-span-6">
          {fileUrls.front ? (
            <DocumentViewer
              title={typeInfo?.requiresBack ? "Document — front" : "Identity document"}
              src={fileUrls.front}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Document unavailable.
              </CardContent>
            </Card>
          )}
          {fileUrls.back ? (
            <DocumentViewer title="Document — back" src={fileUrls.back} />
          ) : null}
          {fileUrls.selfie ? (
            <DocumentViewer title="Selfie" src={fileUrls.selfie} selfie />
          ) : null}
        </div>

        {/* ---------------- RIGHT: decision panel ---------------- */}
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reviewable ? (
                <>
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => setModal("approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => {
                      setReason("");
                      setModal("reject");
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => {
                      setReason("");
                      setModal("resubmission");
                    }}
                  >
                    Request resubmission
                  </Button>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Decisions require confirmation and are audit-logged with
                    your admin identity.
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {kyc.status === "approved"
                    ? "This identity has been verified."
                    : kyc.status === "rejected"
                      ? "This submission was rejected. The user can submit again."
                      : kyc.status === "resubmission_required"
                        ? "A resubmission was requested. Waiting for the user."
                        : "This case is not awaiting review."}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Review history */}
          <Card>
            <CardHeader>
              <CardTitle>Review history</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {history.map((h) => (
                    <li key={h.id} className="px-5 py-2.5">
                      <p className="text-xs font-medium">{humanAction(h.action)}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {h.createdAt ? new Date(h.createdAt).toLocaleString() : "—"}
                        {h.metadata?.attempt ? ` · attempt ${h.metadata.attempt}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---------------- Decision confirmation modal ---------------- */}
      <Modal
        open={modal !== null}
        onClose={() => (busy ? undefined : setModal(null))}
        title={
          modal === "approve"
            ? "Approve identity"
            : modal === "reject"
              ? "Reject verification"
              : "Request resubmission"
        }
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              Cancel
            </Button>
            <Button
              variant={modal === "approve" ? "primary" : "danger"}
              loading={busy}
              disabled={modal !== "approve" && !reason}
              onClick={commitDecision}
            >
              {modal === "approve"
                ? "Confirm approval"
                : modal === "reject"
                  ? "Confirm rejection"
                  : "Confirm request"}
            </Button>
          </>
        }
      >
        {modal === "approve" ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            This will mark the user&apos;s identity as verified and unlock
            verified-only services. The user will be notified.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {modal === "reject"
                ? "The selected reason is shown to the user. Internal notes stay private."
                : "The user will be asked to submit a corrected verification."}
            </p>
            <div className="space-y-1.5" role="radiogroup" aria-label="Reason">
              {KYC_REJECTION_REASONS.filter(
                (r) => !(modal === "resubmission" && r === "other"),
              ).map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50"
                >
                  <input
                    type="radio"
                    name="kyc-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="mt-1 accent-[hsl(44_55%_54%)]"
                  />
                  <span>
                    {reasonLabel(r)}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {REJECTION_REASON_COPY[r as KycRejectionReason]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Internal reviewer note (optional — never shown to the user)
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function reasonLabel(r: string): string {
  return r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanAction(action: string): string {
  switch (action) {
    case "kyc.submitted":
      return "Submitted";
    case "kyc.review_started":
      return "Review started";
    case "kyc.approved":
      return "Approved";
    case "kyc.rejected":
      return "Rejected";
    case "kyc.resubmission_requested":
      return "Resubmission requested";
    default:
      return action;
  }
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`truncate text-right text-sm ${mono ? "font-mono text-primary" : ""}`}>
        {value}
      </span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// DocumentViewer — zoom / fit / rotate over a signed URL
// -----------------------------------------------------------------------------

function DocumentViewer({
  title,
  src,
  selfie,
}: {
  title: string;
  src: string;
  selfie?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const isPdf = src.toLowerCase().includes(".pdf") || src.includes("pdf");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              {selfie ? (
                <ScanFace className="h-4 w-4 text-primary" />
              ) : (
                <FileText className="h-4 w-4 text-primary" />
              )}
              {title}
            </span>
          </CardTitle>
          <div className="flex items-center gap-1">
            <IconBtn
              label="Zoom out"
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            >
              <ZoomOut className="h-4 w-4" />
            </IconBtn>
            <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <IconBtn
              label="Zoom in"
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
            >
              <ZoomIn className="h-4 w-4" />
            </IconBtn>
            <IconBtn
              label="Fit to screen"
              onClick={() => {
                setZoom(1);
                setRotation(0);
              }}
            >
              <span className="text-[10px] font-semibold">FIT</span>
            </IconBtn>
            <IconBtn label="Rotate" onClick={() => setRotation((r) => (r + 90) % 360)}>
              <RotateCw className="h-4 w-4" />
            </IconBtn>
            <a
              href={src}
              target="_blank"
              rel="noreferrer noopener"
              className="ml-1 text-xs text-primary hover:underline"
            >
              Open larger
            </a>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[520px] overflow-auto rounded-lg border border-border bg-black/30 p-3">
          {isPdf ? (
            <object
              data={src}
              type="application/pdf"
              className="h-[480px] w-full rounded-md"
              aria-label={title}
            >
              <p className="p-4 text-sm text-muted-foreground">
                PDF preview unavailable.{" "}
                <a href={src} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                  Open in a new tab
                </a>
                .
              </p>
            </object>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={title}
              className="mx-auto rounded-md transition-transform"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                maxHeight: 480,
              }}
            />
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Secure time-limited access — links expire shortly and are never public.
        </p>
      </CardContent>
    </Card>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </button>
  );
}
