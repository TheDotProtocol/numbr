"use client";

// =============================================================================
// /onboarding — profile setup → OneNumbr ID issued → welcome.
// Server-generated ID (POST /api/onboarding/generate-id). No KYC here.
// =============================================================================

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button, Spinner } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { useToast } from "@/components/ui/toast";
import { useAuthContext } from "@/hooks/useAuth";
import { submitProfileSetup, requestOneNumbrId } from "@/services/onboardingService";
import { trackProductEvent } from "@/lib/product-state";
import { profileSetupSchema, firstZodMessage } from "@/lib/validation";
import { LoadingState } from "@/components/ui/EmptyState";
import { countryLabel } from "@/lib/countries";

type Step = "loading" | "profile" | "generating" | "welcome" | "blocked";

export default function OnboardingPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { status, firebaseUser, account, refreshAccount } = useAuthContext();

  const [step, setStep] = useState<Step>("loading");

  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Gate: must be authenticated AND email-verified to onboard.
  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (firebaseUser && !firebaseUser.emailVerified) {
      router.replace("/verify-email");
      return;
    }
    if (account?.identity) {
      setStep("welcome"); // already has an ID — show the welcome/summary
      return;
    }
    setStep("profile");
    // Prefill from the signup data where available.
    setFullName((prev) => prev || account?.profile?.fullName || "");
    setTimezone((prev) => {
      if (prev) return prev;
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      } catch {
        return "";
      }
    });
  }, [status, firebaseUser, account, router]);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);

    const parsed = profileSetupSchema.safeParse({ fullName, country, phone, timezone });
    if (!parsed.success) {
      setFieldError(firstZodMessage(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      await submitProfileSetup({
        fullName: parsed.data.fullName,
        country: parsed.data.country,
        phone: parsed.data.phone || undefined,
        timezone: parsed.data.timezone || undefined,
      });
      setStep("generating");
      trackProductEvent("onboarding_started");
      await requestOneNumbrId();
      await refreshAccount();
      setStep("welcome");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Onboarding failed.", "error");
      setStep("profile");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "loading") {
    return (
      <AuthShell>
        <AuthCard>
          <LoadingState label="Preparing your OneNumbr identity…" />
        </AuthCard>
      </AuthShell>
    );
  }

  if (step === "generating") {
    return (
      <AuthShell>
        <AuthCard>
          <div className="flex flex-col items-center py-10 text-center">
            <Spinner className="h-8 w-8 text-primary" />
            <h1 className="mt-6 text-lg font-semibold">Allocating your OneNumbr ID…</h1>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
              Generating your permanent, unique identity identifier. This only
              happens once.
            </p>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  if (step === "profile") {
    return (
      <AuthShell>
        <AuthCard>
          <p className="text-xs uppercase tracking-[0.25em] text-primary">
            Step 1 of 2 — Profile
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            Set up your profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us who you are. Your OneNumbr ID is generated right after.
          </p>

          <form onSubmit={handleProfileSubmit} className="mt-6 space-y-4" noValidate>
            <Field label="Full name" htmlFor="fullName">
              <Input
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ada Lovelace"
              />
            </Field>
            <Field label="Country" htmlFor="country">
              <CountrySelect id="country" value={country} onChange={setCountry} />
            </Field>
            <Field
              label="Phone (optional)"
              htmlFor="phone"
              hint="You can add this later — a OneNumbr number is separate."
            >
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
              />
            </Field>
            <Field label="Timezone" htmlFor="timezone" hint="Detected automatically; editable in Settings.">
              <Input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Europe/London"
              />
            </Field>

            {fieldError ? (
              <p role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
            ) : null}

            <Button type="submit" fullWidth size="lg" loading={submitting}>
              Continue
            </Button>
          </form>
        </AuthCard>
      </AuthShell>
    );
  }

  // step === "welcome" → concept walkthrough, then dashboard handoff
  const onenumbr = account?.identity?.onenumbr;
  if (onenumbr) {
    return (
      <AuthShell>
        <WelcomeWalkthrough
          onenumbr={onenumbr}
          name={account?.profile?.fullName?.split(" ")[0] ?? ""}
          onDone={() => {
            trackProductEvent("onboarding_completed");
            router.push("/app");
          }}
        />
      </AuthShell>
    );
  }
  return (
    <AuthShell>
      <AuthCard>
        <div className="flex flex-col items-center py-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">
            {onenumbr ? "Welcome to OneNumbr" : "Almost there"}
          </p>
          {onenumbr ? (
            <>
              <h1 className="onenumbr-mark mt-4 text-3xl font-bold tracking-tight">
                Your global identity starts here.
              </h1>
              <div className="glass-gold mt-8 rounded-xl px-10 py-6">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                  Your OneNumbr ID
                </p>
                <p className="gold-gradient-text mt-2 font-mono text-4xl font-bold tracking-wider">
                  {onenumbr}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Permanent · Unique · Verified ownership
                </p>
              </div>
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
                This is your identity across the OneNumbr platform. Numbers,
                eSIMs and verification connect to it — keep it safe.
              </p>
              <div className="mt-8 grid w-full gap-2 text-left text-sm">
                <SummaryRow label="Name" value={account?.profile?.fullName || "—"} />
                <SummaryRow
                  label="Country"
                  value={account?.profile?.country ? countryLabel(account.profile.country) : "—"}
                />
                <SummaryRow label="Identity verification" value="Not started" />
              </div>
              <Button
                size="lg"
                className="mt-8"
                fullWidth
                onClick={() => router.push("/app")}
              >
                Enter your dashboard
              </Button>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-xl font-semibold">ID generation pending</h1>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Your OneNumbr ID is being finalized. It will appear on your
                dashboard shortly.
              </p>
              <Button className="mt-8" onClick={() => router.push("/app")}>
                Go to dashboard
              </Button>
            </>
          )}
        </div>
      </AuthCard>
      </AuthShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-2/50 px-4 py-2.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

// =============================================================================
// WelcomeWalkthrough — short concept explanation (3 panels) + guided next
// step. Education, not a questionnaire: the user can skip straight through.
// =============================================================================

function WelcomeWalkthrough({
  onenumbr,
  name,
  onDone,
}: {
  onenumbr: string;
  name: string;
  onDone: () => void;
}) {
  const steps = [
    {
      eyebrow: "Welcome to OneNumbr",
      title: name ? `Hi ${name} — one identity. One number. Anywhere.` : "One identity. One number. Anywhere.",
      body: "OneNumbr keeps your digital identity, your number and your connectivity together, wherever you are.",
      render: null,
    },
    {
      eyebrow: "Your identity",
      title: "This is your OneNumbr ID",
      body: "It identifies you across OneNumbr. It's permanent, it's yours, and it stays the same even if you change your number later.",
      render: (
        <div className="glass-gold mx-auto w-full max-w-xs rounded-xl px-8 py-6 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">OneNumbr ID</p>
          <p className="gold-gradient-text mt-2 font-mono text-3xl font-bold tracking-wider">{onenumbr}</p>
        </div>
      ),
    },
    {
      eyebrow: "Verification",
      title: "Why verification matters",
      body: "Verifying your identity keeps your account safe and unlocks your OneNumbr Number — the way people reach you. It's a one-time review by our team.",
      render: null,
    },
  ] as const;

  const nextSteps = [
    { title: "Verify your identity", description: "Unlock your OneNumbr Number.", href: "/app/identity", cta: "Start verification" },
    { title: "Choose your Number", description: "Pick the number that represents you.", href: "/app/number", cta: "Explore numbers" },
    { title: "Get an eSIM", description: "Stay connected, wherever you go.", href: "/app/esim", cta: "Browse eSIMs" },
  ];

  const [step, setStep] = useState(0);
  const isLast = step === steps.length - 1;
  const current = steps[step];

  return (
    <AuthCard>
      <div className="flex min-h-[380px] flex-col py-4">
        {/* Progress dots */}
        <div className="mb-6 flex items-center justify-center gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>

        <div className="flex flex-1 flex-col items-center text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-primary">{current.eyebrow}</p>
          <h1 className="mt-3 max-w-sm text-xl font-semibold leading-snug">{current.title}</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{current.body}</p>
          {current.render ? <div className="mt-6 w-full">{current.render}</div> : null}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={onDone}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            <Button onClick={() => (isLast ? onDone() : setStep((s) => s + 1))}>
              {isLast ? "Get started" : "Continue"}
            </Button>
          </div>
        </div>

        {isLast ? (
          <div className="mt-6 space-y-2 border-t border-border/60 pt-5">
            <p className="text-center text-xs uppercase tracking-wider text-muted-foreground">
              Choose your next step
            </p>
            {nextSteps.map((n) => (
              <button
                key={n.href}
                type="button"
                onClick={onDone}
                className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-left transition-colors hover:border-primary/40"
              >
                <span>
                  <span className="block text-sm font-medium">{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.description}</span>
                </span>
                <span className="text-xs text-primary">{n.cta} →</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </AuthCard>
  );
}
