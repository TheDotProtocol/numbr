"use client";

// =============================================================================
// /reset-password — request a password reset email
// =============================================================================

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/toast";
import { sendResetEmail } from "@/services/authService";

export default function ResetPasswordPage() {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await sendResetEmail(email.trim());
      setSent(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not send reset email.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard>
        <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your account email and we&apos;ll send you a reset link.
        </p>

        {sent ? (
          <div className="mt-6 rounded-lg border border-success/40 bg-success/10 p-4 text-sm text-success">
            <p className="font-medium">Check your inbox</p>
            <p className="mt-1 text-success/80">
              If an account exists for {email}, a password reset link is on its way.
            </p>
            <Link
              href="/login"
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
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
            <Button type="submit" fullWidth size="lg" loading={loading}>
              Send reset link
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-primary">
            Back to sign in
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
