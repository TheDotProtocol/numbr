"use client";

// =============================================================================
// /app/identity/verification/start — manual KYC wizard
//
// Steps: 1 Personal info → 2 Identity document → 3 Selfie → 4 Review/Submit.
// Business logic lives in services/kycService; this file is orchestration+UI.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { useToast } from "@/components/ui/toast";
import { useAuthContext } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/Badge";
import { HelpLink } from "@/components/app/HelpLink";
import {
  createKycDraft,
  saveKycDraft,
  uploadKycFile,
  deleteKycFile,
  submitKyc,
  getKycStatus,
  type UploadResult,
} from "@/services/kycService";
import {
  DOCUMENT_TYPES,
  getDocumentTypeInfo,
  type KycDocumentType,
} from "@/types/kyc";
import {
  Plane,
  IdCard,
  Car,
  Check,
  ShieldCheck,
  Upload,
  Trash2,
} from "lucide-react";

type Step = 1 | 2 | 3;

const DOC_ICONS = {
  passport: Plane,
  national_id: IdCard,
  driving_licence: Car,
} as const;

export default function KycStartPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { account, firebaseUser, refreshAccount } = useAuthContext();

  const [step, setStep] = useState<Step>(1);
  const [booting, setBooting] = useState(true);

  // Case state
  const [documentType, setDocumentType] = useState<KycDocumentType | null>(null);
  const [documentCountry, setDocumentCountry] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [front, setFront] = useState<(UploadResult & { name: string }) | null>(null);
  const [back, setBack] = useState<(UploadResult & { name: string }) | null>(null);
  const [selfie, setSelfie] = useState<(UploadResult & { name: string }) | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const uid = firebaseUser?.uid ?? null;
  const draftReady = useRef(false);

  // Redirect if a submission is already in flight / decided.
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const kyc = await getKycStatus(uid);
        if (
          kyc &&
          (kyc.status === "submitted" ||
            kyc.status === "under_review" ||
            kyc.status === "approved")
        ) {
          router.replace("/app/identity/verification");
          return;
        }
        if (kyc?.status === "draft") {
          setDocumentType(kyc.documentType);
          setDocumentCountry(kyc.documentCountry);
          setDocumentNumber(kyc.documentNumber);
          // Ensure a draft exists for client-side saves (draft status only —
          // rules deny draft edits on submitted/rejected cases).
          await createKycDraft(uid);
          draftReady.current = true;
        } else if (!kyc) {
          await createKycDraft(uid);
          draftReady.current = true;
        }
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Could not prepare verification.",
          "error",
        );
      } finally {
        setBooting(false);
      }
    })();
  }, [uid, router, showToast]);

  /** Persist draft fields as the user advances (best-effort). */
  const persistDraft = useCallback(
    async (patch: Parameters<typeof saveKycDraft>[1]) => {
      if (!uid || !draftReady.current) return;
      try {
        await saveKycDraft(uid, patch);
      } catch (err) {
        console.error("[OneNumbr] draft save failed:", err);
      }
    },
    [uid],
  );

  const typeInfo = useMemo(
    () => (documentType ? getDocumentTypeInfo(documentType) : undefined),
    [documentType],
  );

  const canSubmit =
    documentType !== null &&
    /^[A-Z]{2}$/.test(documentCountry) &&
    documentNumber.trim().length > 0 &&
    front !== null &&
    selfie !== null &&
    (!typeInfo?.requiresBack || back !== null);

  async function handleSubmit() {
    if (!uid || !documentType || !front || !selfie || submitting) return;
    setSubmitting(true);
    try {
      await submitKyc({
        documentType,
        documentCountry,
        documentNumber: documentNumber.trim(),
        documentFrontPath: front.path,
        documentBackPath: back?.path ?? null,
        selfiePath: selfie.path,
      });
      await refreshAccount();
      router.replace("/app/identity/verification");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Submission failed.", "error");
      setSubmitting(false);
    }
  }

  if (booting) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent>
            <LoadingLine label="Preparing verification…" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Verify your identity"
        description="Identity verification helps protect your OneNumbr account and unlock services that require verified identity."
        actions={
          <Link href="/app/identity/verification">
            <Button variant="secondary" size="sm">
              Status
            </Button>
          </Link>
        }
      />

      <StepBar step={step} />

      <div className="mb-4">
        <HelpLink slug="kyc-verification-pending" label="Why do I need verification?" />
      </div>

      {/* ------------------------- STEP 1: personal info ------------------------- */}
      {step === 1 ? (
        <Card className="animate-fade-up">
          <CardHeader>
            <CardTitle>Step 1 — Personal information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              We use the details from your OneNumbr profile. Confirm they are
              correct — they must match your identity document.
            </p>
            <InfoRow label="Full name" value={account?.profile?.fullName || "—"} />
            <InfoRow label="Email" value={account?.user.email || "—"} />
            <InfoRow
              label="Account country"
              value={
                account?.profile?.country
                  ? `${account.profile.country}`
                  : "Not set — add it in Settings"
              }
            />
            <div className="rounded-lg border border-border bg-surface-2/50 p-3 text-xs leading-relaxed text-muted-foreground">
              Your account country and your document&apos;s issuing country can
              differ — you&apos;ll pick the issuing country in the next step.
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setStep(2);
                  void persistDraft({});
                }}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ------------------------- STEP 2: document ------------------------- */}
      {step === 2 ? (
        <div className="animate-fade-up space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Step 2 — Identity document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">Choose your document.</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {DOCUMENT_TYPES.map((t) => {
                  const Icon = DOC_ICONS[t.value];
                  const selected = documentType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setDocumentType(t.value);
                        // Reset incompatible uploads when the type changes.
                        if (!t.requiresBack) setBack(null);
                      }}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        selected
                          ? "border-primary/60 bg-primary/5"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon
                          className={`h-5 w-5 ${selected ? "text-primary" : "text-muted-foreground"}`}
                        />
                        {selected ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-medium">{t.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {t.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {documentType ? (
                <>
                  <Field
                    label="Issuing country"
                    htmlFor="doc-country"
                    hint="The country that issued this document — can differ from your account country."
                  >
                    <CountrySelect
                      id="doc-country"
                      value={documentCountry}
                      onChange={setDocumentCountry}
                    />
                  </Field>
                  <Field label="Document number" htmlFor="doc-number">
                    <Input
                      id="doc-number"
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      placeholder="As printed on the document"
                      maxLength={40}
                    />
                  </Field>

                  <div className="space-y-3">
                    <UploadTile
                      label={typeInfo?.requiresBack ? "Document — front side" : "Upload document"}
                      accept={typeInfo?.accept ?? ["image/png", "image/jpeg", "application/pdf"]}
                      role="document_front"
                      existing={front}
                      onUploaded={(r, name) => {
                        if (front && front.path !== r.path) void deleteKycFile(front.path);
                        setFront({ ...r, name });
                        void persistDraft({ documentFrontPath: r.path });
                      }}
                      onRemoved={() => {
                        if (front) void deleteKycFile(front.path);
                        setFront(null);
                        void persistDraft({ documentFrontPath: null });
                      }}
                    />
                    {typeInfo?.requiresBack ? (
                      <UploadTile
                        label="Document — back side"
                        accept={typeInfo.accept}
                        role="document_back"
                        existing={back}
                        onUploaded={(r, name) => {
                          if (back && back.path !== r.path) void deleteKycFile(back.path);
                          setBack({ ...r, name });
                          void persistDraft({ documentBackPath: r.path });
                        }}
                        onRemoved={() => {
                          if (back) void deleteKycFile(back.path);
                          setBack(null);
                          void persistDraft({ documentBackPath: null });
                        }}
                      />
                    ) : null}
                    <UploadTile
                      label="Selfie — a clear photo of your face"
                      accept={["image/png", "image/jpeg"]}
                      role="selfie"
                      existing={selfie}
                      onUploaded={(r, name) => {
                        if (selfie && selfie.path !== r.path) void deleteKycFile(selfie.path);
                        setSelfie({ ...r, name });
                        void persistDraft({ selfiePath: r.path });
                      }}
                      onRemoved={() => {
                        if (selfie) void deleteKycFile(selfie.path);
                        setSelfie(null);
                        void persistDraft({ selfiePath: null });
                      }}
                    />
                  </div>

                  <div className="rounded-lg border border-border bg-surface-2/50 p-3 text-xs leading-relaxed text-muted-foreground">
                    <ShieldCheck className="mr-1.5 -mt-0.5 inline h-3.5 w-3.5 text-primary" />
                    Your documents are stored securely and are only accessible
                    to authorized OneNumbr verification staff.
                  </div>
                </>
              ) : null}

              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  disabled={!documentType || !/^[A-Z]{2}$/.test(documentCountry) || documentNumber.trim().length === 0 || !front || !selfie || (typeInfo?.requiresBack === true && !back)}
                  onClick={() => setStep(3)}
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* ------------------------- STEP 3: review ------------------------- */}
      {step === 3 ? (
        <Card className="animate-fade-up">
          <CardHeader>
            <CardTitle>Step 3 — Review your information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Make sure everything is correct before submitting.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Full name" value={account?.profile?.fullName || "—"} />
              <InfoRow label="Email" value={account?.user.email || "—"} />
              <InfoRow label="Document" value={typeInfo?.label ?? "—"} />
              <InfoRow label="Issuing country" value={documentCountry || "—"} />
              <InfoRow label="Document number" value={documentNumber || "—"} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {front?.downloadUrl && !front.path.endsWith(".pdf") ? (
                <PreviewPane label="Document front" src={front.downloadUrl} />
              ) : (
                <FilePane label="Document front" name={front?.name ?? "—"} />
              )}
              {typeInfo?.requiresBack ? (
                back?.downloadUrl && !back.path.endsWith(".pdf") ? (
                  <PreviewPane label="Document back" src={back.downloadUrl} />
                ) : (
                  <FilePane label="Document back" name={back?.name ?? "—"} />
                )
              ) : null}
              {selfie?.downloadUrl ? (
                <PreviewPane label="Selfie" src={selfie.downloadUrl} />
              ) : (
                <FilePane label="Selfie" name={selfie?.name ?? "—"} />
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button loading={submitting} disabled={!canSubmit} onClick={handleSubmit}>
                Submit verification
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function StepBar({ step }: { step: Step }) {
  const steps = ["Information", "Document", "Review"];
  return (
    <ol className="mb-6 flex items-center gap-2 text-xs" aria-label="Verification steps">
      {steps.map((label, i) => {
        const n = (i + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : done
                    ? "border-success/50 bg-success/10 text-success"
                    : "border-border text-muted-foreground"
              }`}
            >
              {done ? "✓" : n}
            </span>
            <span className={active ? "text-foreground" : "text-muted-foreground"}>
              {label}
            </span>
            {i < steps.length - 1 ? (
              <span className="mx-1 h-px w-6 bg-border" aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="truncate text-sm">{value}</span>
    </div>
  );
}

function PreviewPane({ label, src }: { label: string; src: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${label} preview`}
        className="max-h-40 w-full rounded-md object-contain"
      />
    </div>
  );
}

function FilePane({ label, name }: { label: string; name: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="flex items-center gap-2 truncate text-sm">
        <ShieldCheck className="h-4 w-4 text-primary" />
        {name}
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// UploadTile — upload with progress, preview, remove/replace/retry
// -----------------------------------------------------------------------------

interface UploadTileProps {
  label: string;
  accept: string[];
  role: "document_front" | "document_back" | "selfie";
  existing: (UploadResult & { name: string }) | null;
  onUploaded: (result: UploadResult, name: string) => void;
  onRemoved: () => void;
}

function UploadTile({ label, accept, role, existing, onUploaded, onRemoved }: UploadTileProps) {
  const { showToast } = useToast();
  const { firebaseUser } = useAuthContext();
  const inputRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existing?.downloadUrl ?? null);

  useEffect(() => {
    setPreviewUrl(existing?.downloadUrl ?? null);
  }, [existing]);

  function validate(file: File): string | null {
    if (!accept.includes(file.type)) {
      return "Unsupported file. Use PNG, JPG or PDF.";
    }
    if (file.size > 5 * 1024 * 1024) {
      return "File is larger than 5 MB.";
    }
    return null;
  }

  async function handleFile(file: File) {
    const problem = validate(file);
    if (problem) {
      setError(problem);
      return;
    }
    if (!firebaseUser) {
      setError("Session expired — please sign in again.");
      return;
    }
    setError(null);
    setLastFile(file);
    setProgress(0);

    try {
      const result = await uploadKycFile(firebaseUser.uid, file, role, setProgress);
      setProgress(null);
      setPreviewUrl(result.downloadUrl);
      onUploaded(result, file.name);
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : "Upload failed. Please retry.");
      showToast(err instanceof Error ? err.message : "Upload failed.", "error");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface-2/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        {existing ? <Badge tone="success">Uploaded</Badge> : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void handleFile(f);
        }}
      />

      {!existing ? (
        progress === null ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-3 flex w-full flex-col items-center gap-1.5 rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Upload className="h-5 w-5" />
            Choose file
            <span className="text-[11px] text-muted-foreground/60">
              PNG, JPG{role === "selfie" ? "" : " or PDF"} · max 5 MB
            </span>
          </button>
        ) : (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Uploading… {progress}%</p>
          </div>
        )
      ) : (
        <div className="mt-3 flex items-center gap-3">
          {previewUrl && !existing.path.endsWith(".pdf") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={label}
              className="h-16 w-16 rounded-md border border-border object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-md border border-border text-xs text-muted-foreground">
              PDF
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{existing.name}</p>
            <div className="mt-1 flex gap-3 text-xs">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </button>
              <button
                type="button"
                className="text-destructive hover:underline"
                onClick={() => {
                  onRemoved();
                  setPreviewUrl(null);
                }}
              >
                <Trash2 className="mr-1 inline h-3 w-3" />
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {progress !== null && existing ? (
        <p className="mt-2 text-xs text-muted-foreground">Uploading… {progress}%</p>
      ) : null}

      {error ? (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-destructive">
          <span role="alert">{error}</span>
          {lastFile ? (
            <button
              type="button"
              className="shrink-0 text-primary hover:underline"
              onClick={() => lastFile && void handleFile(lastFile)}
            >
              Retry
            </button>
          ) : (
            <button
              type="button"
              className="shrink-0 text-primary hover:underline"
              onClick={() => inputRef.current?.click()}
            >
              Try another file
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function LoadingLine({ label }: { label: string }) {
  return (
    <p className="animate-pulse py-6 text-center text-sm text-muted-foreground">{label}</p>
  );
}
