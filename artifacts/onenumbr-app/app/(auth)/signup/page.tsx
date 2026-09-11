"use client";

// =============================================================================
// /signup — create account (name, email, password, confirm)
// =============================================================================

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/toast";
import { signUp } from "@/services/authService";
import { signUpSchema, firstZodMessage } from "@/lib/validation";
import { AppError } from "@/lib/errors";

export default function SignupPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);

    const parsed = signUpSchema.safeParse({ fullName, email, password, confirmPassword });
    if (!parsed.success) {
      setFieldError(firstZodMessage(parsed.error));
      return;
    }

    setLoading(true);
    try {
      await signUp({
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        password: parsed.data.password,
      });
      // Straight to the verification gate; onboarding continues after verify.
      router.replace("/verify-email");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Sign up failed.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard>
        <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One identity. One number. Anywhere.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <Field label="Full name" htmlFor="fullName">
            <Input
              id="fullName"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ada Lovelace"
            />
          </Field>
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
          <Field
            label="Password"
            htmlFor="password"
            hint="At least 8 characters."
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Field label="Confirm password" htmlFor="confirmPassword">
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          {fieldError ? (
            <p role="alert" className="text-sm text-destructive">
              {fieldError}
            </p>
          ) : null}

          <Button type="submit" fullWidth size="lg" loading={loading}>
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
