"use client";

// =============================================================================
// /app/security — Security Center
//
// EXTENDS the Prompt-1 page (the working Firebase password change is
// preserved) and now consumes the account engine: live sessions/devices
// (current resolved server-side), explainable security status (no fake
// scores), honest 2FA availability, and account lifecycle controls.
// =============================================================================

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, DataRow } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast";
import { useAuthContext } from "@/hooks/useAuth";
import { changePassword, resendVerificationEmail } from "@/services/authService";
import { passwordSchema } from "@/lib/validation";
import {
  fetchSecurityCenter,
  revokeOtherSessions,
  changeLifecycle,
  type SecurityCenterData,
} from "@/services/accountService";
import { formatMinor } from "@/types/billing";
import { ShieldCheck, KeyRound, LaptopMinimalCheck, History, TriangleAlert } from "lucide-react";

export default function SecurityPage() {
  return (
    <AuthGuard>
      <SecurityInner />
    </AuthGuard>
  );
}

function SecurityInner() {
  const { account, firebaseUser, refreshAccount } = useAuthContext();
  const { showToast } = useToast();

  const [data, setData] = useState<SecurityCenterData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Password change (existing Firebase flow preserved)
  const [pwOpen, setPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Resend verification
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // 2FA modal
  const [twoFaOpen, setTwoFaOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setData(await fetchSecurityCenter());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load security data.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startCooldown() {
    setCooldown(45);
    const timer = window.setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function handleResend() {
    setResending(true);
    try {
      await resendVerificationEmail();
      startCooldown();
      showToast("Verification email sent.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not resend.", "error");
    } finally {
      setResending(false);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPwError(null);

    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      setPwError(parsed.error.issues[0]?.message ?? "Invalid password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }

    setPwLoading(true);
    try {
      await changePassword(newPassword);
      // Record the security event server-side (audit + timeline + email).
      const { recordPasswordChangedClient } = await import("@/services/accountService");
      await recordPasswordChangedClient();
      showToast("Password updated.", "success");
      setPwOpen(false);
      setNewPassword("");
      setConfirmPassword("");
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not change password.", "error");
    } finally {
      setPwLoading(false);
    }
  }

  const verified = firebaseUser?.emailVerified ?? data?.security.emailVerified ?? false;
  const security = data?.security;
  const currentSession = data?.sessions.find((s) => s.currentSession);
  const otherSessions = data?.sessions.filter((s) => !s.currentSession) ?? [];

  async function signOutOthers() {
    try {
      const n = await revokeOtherSessions();
      showToast(n === 0 ? "No other active sessions." : `Signed out ${n} other ${n === 1 ? "session" : "sessions"}.`);
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Sign-out failed.", "error");
    }
  }

  if (loadError) {
    return <EmptyState title="Couldn't load security center" description={loadError} />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Security"
        description="How you sign in, where you're signed in, and what's protecting your account."
      />

      {/* Security status banner (explainable, not a fake score) */}
      <Card className={security?.securityStatus === "good" ? "border-primary/30" : "border-warning/50"}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {security?.securityStatus === "good" ? (
              <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            ) : (
              <TriangleAlert className="mt-0.5 h-5 w-5 text-warning" />
            )}
            <div>
              <p className="text-sm font-medium">
                {security?.securityStatus === "good" ? "Your account is protected" : "Your account needs attention"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {verified
                  ? `${data?.sessions.length ?? 0} active ${data?.sessions.length === 1 ? "session" : "sessions"} · last activity ${
                      data?.sessions[0]?.lastSeenAt
                        ? new Date(data.sessions[0].lastSeenAt).toLocaleString()
                        : "—"
                    }`
                  : "Verify your email to secure your account."}
              </p>
            </div>
          </div>
          <Link href="/app/account/activity">
            <Button size="sm" variant="secondary">
              <History className="mr-1.5 inline h-3.5 w-3.5" /> Activity
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="mt-4 space-y-4">
        {/* Email verification */}
        <Card>
          <CardHeader>
            <CardTitle>Email verification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-sm">
                  {account?.user.email}
                  {verified ? (
                    <Badge tone="success">Verified</Badge>
                  ) : (
                    <Badge tone="warning">Unverified</Badge>
                  )}
                </p>
              </div>
              {!verified ? (
                <Button
                  variant="secondary"
                  loading={resending}
                  disabled={cooldown > 0}
                  onClick={handleResend}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Password */}
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {security?.lastPasswordChangeAt
                  ? `Last changed ${new Date(security.lastPasswordChangeAt).toLocaleDateString()}.`
                  : "Use a strong, unique password for OneNumbr."}
              </p>
              <Button variant="secondary" onClick={() => setPwOpen(true)}>
                <KeyRound className="mr-1.5 inline h-3.5 w-3.5" /> Change password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Two-factor authentication — honest availability from the provider registry */}
        <Card>
          <CardHeader>
            <CardTitle>Two-factor authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Badge tone={data?.twoFactorAvailable ? "gold" : "neutral"}>
                  {data?.twoFactorAvailable ? "Setup ready" : "Coming soon"}
                </Badge>
                <p className="mt-2 text-sm text-muted-foreground">
                  {data?.twoFactorAvailable
                    ? "A second factor can be configured for your account."
                    : "2FA isn't available in this environment yet. We won't show a fake toggle — it will appear here when a provider is live."}
                </p>
              </div>
              <Button variant="secondary" onClick={() => setTwoFaOpen(true)}>
                Learn more
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Active sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data === null ? (
              <LoadingState label="Loading sessions…" />
            ) : (
              <>
                {currentSession ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <LaptopMinimalCheck className="h-4 w-4 text-primary" />
                        {currentSession.deviceDescription}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {currentSession.location} · last active{" "}
                        {currentSession.lastSeenAt
                          ? new Date(currentSession.lastSeenAt).toLocaleString()
                          : "—"}
                      </p>
                    </div>
                    <Badge tone="success">This session</Badge>
                  </div>
                ) : null}
                {otherSessions.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm">{s.deviceDescription}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.location} · last active{" "}
                        {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : "—"}
                      </p>
                    </div>
                  </div>
                ))}
                {otherSessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No other active sessions.</p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href="/app/account/sessions">
                    <Button size="sm" variant="secondary">Manage sessions</Button>
                  </Link>
                  {otherSessions.length > 0 ? (
                    <Button size="sm" variant="ghost" onClick={() => void signOutOthers()}>
                      Sign out other sessions
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Devices */}
        <Card>
          <CardHeader>
            <CardTitle>Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {data?.devices.filter((d) => !d.revokedAt).length ?? 0} registered{" "}
                {(data?.devices.filter((d) => !d.revokedAt).length ?? 0) === 1 ? "device" : "devices"}
                {data?.devices.find((d) => d.current)?.deviceName
                  ? ` · this device: ${data.devices.find((d) => d.current)!.deviceName}`
                  : ""}
              </p>
              <Link href="/app/devices">
                <Button variant="secondary">Manage devices</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Change password modal (Firebase flow preserved) */}
      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Change password"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPwOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="change-pw-form" loading={pwLoading}>
              Update password
            </Button>
            <form id="change-pw-form" onSubmit={handlePasswordChange} className="hidden" />
          </>
        }
      >
        <form id="change-pw-form-inner" onSubmit={handlePasswordChange} className="space-y-4">
          <Field label="New password" htmlFor="new-password" hint="At least 8 characters.">
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm-password">
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Field>
          {pwError ? (
            <p role="alert" className="text-sm text-destructive">
              {pwError}
            </p>
          ) : null}
        </form>
      </Modal>

      {/* 2FA modal */}
      <Modal
        open={twoFaOpen}
        onClose={() => setTwoFaOpen(false)}
        title="Two-factor authentication"
        footer={
          <Button variant="secondary" onClick={() => setTwoFaOpen(false)}>
            Close
          </Button>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          OneNumbr will support authenticator apps and passkeys. A second factor is
          <span className="font-medium text-foreground"> not active in this environment</span> —
          until a provider is enabled, a strong password and a verified email protect your
          account. The architecture is already prepared, so enabling 2FA later won&apos;t change
          this page.
        </p>
      </Modal>
    </div>
  );
}
