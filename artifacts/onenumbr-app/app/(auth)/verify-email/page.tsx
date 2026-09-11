"use client";

// =============================================================================
// /verify-email — verification gate shown after sign-up until verified.
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast";
import { useAuthContext } from "@/hooks/useAuth";
import { reloadUser, resendVerificationEmail, logout } from "@/services/authService";
import { MailCheck, RefreshCw } from "lucide-react";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { status, firebaseUser, logout: ctxLogout } = useAuthContext();

  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [ cooldown, setCooldown ] = useState(0);

  // Countdown to prevent spamming the resend button.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  // If the user somehow arrives here already verified, move on.
  useEffect(() => {
    if (status === "authenticated" && firebaseUser?.emailVerified) {
      router.replace("/onboarding");
    }
  }, [status, firebaseUser, router]);

  async function handleResend() {
    setResending(true);
    try {
      await resendVerificationEmail();
      setCooldown(45);
      showToast("Verification email sent.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not resend.", "error");
    } finally {
      setResending(false);
    }
  }

  async function handleCheck() {
    setChecking(true);
    try {
      const user = await reloadUser();
      if (user?.emailVerified) {
        showToast("Email verified. Welcome to OneNumbr.", "success");
        router.replace("/onboarding");
      } else {
        showToast("Not verified yet — click the link in your inbox first.", "info");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Check failed.", "error");
    } finally {
      setChecking(false);
    }
  }

  async function handleUseDifferentAccount() {
    await logout();
    ctxLogout();
    router.replace("/login");
  }

  return (
    <AuthShell>
      <AuthCard>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <MailCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            Verify your email
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We sent a verification link to{" "}
            <span className="text-foreground">{firebaseUser?.email ?? "your email"}</span>.
            Click it to activate your OneNumbr identity.
          </p>

          <div className="mt-6 flex w-full flex-col gap-3">
            <Button fullWidth size="lg" loading={checking} onClick={handleCheck}>
              <RefreshCw className="mr-1 h-4 w-4" />
              I&apos;ve verified — continue
            </Button>
            <Button
              variant="secondary"
              fullWidth
              loading={resending}
              disabled={cooldown > 0}
              onClick={handleResend}
            >
              {cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend verification email"}
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Wrong account?{" "}
            <button
              type="button"
              onClick={handleUseDifferentAccount}
              className="text-primary hover:underline"
            >
              Sign out
            </button>
          </p>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
