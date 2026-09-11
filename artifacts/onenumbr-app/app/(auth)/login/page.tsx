"use client";

// =============================================================================
// /login — email + password sign in
// =============================================================================

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/toast";
import { login, resendVerificationEmail } from "@/services/authService";
import { AppError } from "@/lib/errors";

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setNeedsVerification(false);
    try {
      await login({ email, password });
      router.replace("/app");
    } catch (err) {
      if (err instanceof AppError && err.code === "auth/unverified-email") {
        setNeedsVerification(true);
        showToast("Please verify your email to continue.", "error");
      } else {
        showToast(err instanceof Error ? err.message : "Sign in failed.", "error");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await resendVerificationEmail();
      showToast("Verification email sent. Check your inbox.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not resend.", "error");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard>
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to your OneNumbr account.
        </p>

        {needsVerification ? (
          <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            <p className="font-medium">Email not verified</p>
            <p className="mt-1 text-warning/80">
              Check your inbox for the verification link.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              loading={resending}
              onClick={handleResend}
            >
              Resend verification email
            </Button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Button type="submit" fullWidth size="lg" loading={loading}>
            Sign in
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/reset-password" className="text-muted-foreground hover:text-primary">
            Forgot password?
          </Link>
          <Link href="/signup" className="text-primary hover:underline">
            Create account
          </Link>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
