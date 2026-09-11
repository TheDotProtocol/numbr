"use client";

// =============================================================================
// /app/esim/activation/[esimId] — "Your eSIM is ready" + QR + install guide
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast";
import { fetchEsimDetail, type MyEsimDetail } from "@/services/esimService";
import { formatData } from "@/types/esim";
import QRCode from "qrcode";
import { Copy, Check } from "lucide-react";

export default function ActivationPage() {
  return (
    <AuthGuard>
      <ActivationInner />
    </AuthGuard>
  );
}

function ActivationInner() {
  const params = useParams<{ esimId: string }>();
  const { showToast } = useToast();
  const [data, setData] = useState<MyEsimDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchEsimDetail(params.esimId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load eSIM."));
  }, [params.esimId]);

  useEffect(() => {
    const payload = data?.esim?.qrPayload;
    if (!payload) return;
    QRCode.toDataURL(payload, {
      width: 480,
      margin: 1,
      color: { dark: "#0a0a12", light: "#f5f2e8" },
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [data?.esim?.qrPayload]);

  if (error) {
    return (
      <EmptyState
        title="eSIM unavailable"
        description={error}
        action={
          <Link href="/app/esim/active">
            <Button variant="secondary">My eSIMs</Button>
          </Link>
        }
      />
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading your eSIM…" />
        </CardContent>
      </Card>
    );
  }

  const { esim } = data;

  async function copyActivation() {
    try {
      await navigator.clipboard.writeText(esim.activationCode);
      setCopied(true);
      showToast("Activation code copied.", "success");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Copy failed — select the code manually.", "error");
    }
  }

  return (
    <>
      <div className="glass-gold animate-fade-up rounded-2xl px-6 py-8 text-center sm:px-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-success/40 bg-success/10 text-success">
          <Check className="h-7 w-7" />
        </div>
        <h1 className="onenumbr-mark mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          Your eSIM is ready.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {esim.flag} {esim.countryName} · {esim.planName}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Badge tone="success">{esim.status}</Badge>
          <Badge tone="gold">DEMO eSIM</Badge>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* QR + activation */}
        <Card>
          <CardHeader>
            <CardTitle>Activation QR code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {qrDataUrl ? (
              <div className="mx-auto w-fit rounded-xl border border-border bg-surface-2 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="eSIM activation QR code"
                  className="h-56 w-56"
                />
                <p className="mt-2 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  Demo activation code
                </p>
              </div>
            ) : (
              <LoadingState label="Generating QR code…" />
            )}

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Activation code (LPA)
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs">
                  {esim.activationCode}
                </code>
                <Button variant="secondary" size="sm" onClick={copyActivation}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy
                </Button>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <Info label="ICCID" value={esim.iccid} mono />
              <Info label="Provider" value={esim.provider} />
              <Info
                label="Data"
                value={formatData(esim.dataAmount, esim.dataUnit)}
              />
              <Info label="Validity" value={`${esim.durationDays} days`} />
            </dl>
          </CardContent>
        </Card>

        {/* Installation guide */}
        <Card>
          <CardHeader>
            <CardTitle>Installation guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <InstallGuide
              title="iPhone"
              steps={[
                "Open Settings",
                "Tap Mobile Service (or Cellular)",
                "Tap Add eSIM",
                "Choose Use QR Code and scan",
                "Follow the on-screen steps to activate",
              ]}
            />
            <InstallGuide
              title="Android"
              steps={[
                "Open Settings",
                "Tap Network & Internet",
                "Tap SIMs (or Network → SIMs)",
                "Tap Add eSIM",
                "Scan the QR code and confirm",
              ]}
            />
            <div className="rounded-lg border border-border bg-surface-2/50 p-3 text-xs leading-relaxed text-muted-foreground">
              Install when you're ready to use the plan — validity starts on
              activation. This is a demo eSIM for development and will not
              connect to a live mobile network.
            </div>
            <Link href={`/app/esim/s/${esim.id}`}>
              <Button variant="secondary" fullWidth>
                Open eSIM details
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function InstallGuide({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <ol className="mt-2 space-y-1.5">
        {steps.map((s, i) => (
          <li key={s} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] text-foreground">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`truncate ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
