"use client";

// =============================================================================
// /app/settings — profile, account, preferences, danger zone
// =============================================================================

import { useState, type FormEvent } from "react";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, DataRow } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { useToast } from "@/components/ui/toast";
import { useAuthContext } from "@/hooks/useAuth";
import { changeLifecycle, type LifecycleAction } from "@/services/accountService";
import { updateProfile } from "@/services/profileService";
import { profileUpdateSchema } from "@/lib/validation";
import { Badge } from "@/components/ui/Badge";
import { AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsInner />
    </AuthGuard>
  );
}

function SettingsInner() {
  const { account, firebaseUser, refreshAccount } = useAuthContext();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(account?.profile?.fullName ?? "");
  const [country, setCountry] = useState(account?.profile?.country ?? "");
  const [phone, setPhone] = useState(account?.profile?.phone ?? "");
  const [timezone, setTimezone] = useState(account?.profile?.timezone ?? "");
  const [saving, setSaving] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState<LifecycleAction | null>(null);

  async function runLifecycle(action: LifecycleAction) {
    setLifecycleBusy(action);
    try {
      await changeLifecycle(action);
      showToast(
        action === "request_deletion"
          ? "Your deletion request has been submitted."
          : "Account deactivated. Sign in again to reactivate.",
        "success",
      );
      if (action !== "reactivate") {
        setTimeout(() => {
          window.location.href = "/login";
        }, 900);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed.", "error");
      setLifecycleBusy(null);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!account) return;

    const parsed = profileUpdateSchema.safeParse({ fullName, country, phone, timezone });
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message ?? "Invalid data.", "error");
      return;
    }

    setSaving(true);
    try {
      await updateProfile(account.user.uid, {
        fullName: parsed.data.fullName,
        country: parsed.data.country,
        phone: parsed.data.phone ?? "",
        timezone: parsed.data.timezone ?? "",
      });
      await refreshAccount();
      showToast("Profile updated.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        description="Manage your profile, account and preferences."
      />

      <div className="space-y-4">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <Field label="Full name" htmlFor="settings-name">
                <Input
                  id="settings-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>
              <Field label="Country" htmlFor="settings-country">
                <CountrySelect
                  id="settings-country"
                  value={country}
                  onChange={setCountry}
                />
              </Field>
              <Field label="Phone" htmlFor="settings-phone" hint="Optional.">
                <Input
                  id="settings-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field label="Timezone" htmlFor="settings-tz">
                <Input
                  id="settings-tz"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Europe/London"
                />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" loading={saving}>
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/40">
            <DataRow label="Email">
              <span className="inline-flex items-center gap-2">
                {account?.user.email}
                {firebaseUser?.emailVerified ? (
                  <Badge tone="success">Verified</Badge>
                ) : (
                  <Badge tone="warning">Unverified</Badge>
                )}
              </span>
            </DataRow>
            <DataRow label="OneNumbr ID">
              <span className="font-mono text-primary">
                {account?.identity?.onenumbr ?? "—"}
              </span>
            </DataRow>
            <DataRow label="Account role">
              <Badge>{account?.user.role ?? "user"}</Badge>
            </DataRow>
          </CardContent>
        </Card>

        {/* Notifications — future */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Notification preferences will be available when notifications
              launch.
            </p>
          </CardContent>
        </Card>

        {/* Security shortcut */}
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Password, sessions and 2FA are managed in{" "}
              <a href="/app/security" className="text-primary hover:underline">
                Security settings
              </a>
              .
            </p>
          </CardContent>
        </Card>

        {/* Preferences — future */}
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Language, currency and appearance preferences are coming soon.
            </p>
          </CardContent>
        </Card>

        {/* Danger zone — safe lifecycle (records preserved, access locked) */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm">Deactivate account</p>
                  <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                    Sign out everywhere and lock access. Your identity, invoices,
                    payments and audit history are preserved — sign in again to
                    reactivate.
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                loading={lifecycleBusy === "deactivate"}
                onClick={() => void runLifecycle("deactivate")}
              >
                Deactivate
              </Button>
            </div>
            <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm">Request account deletion</p>
                  <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                    Submits a deletion request through the safe lifecycle
                    system: access is locked immediately, while invoices,
                    payments, KYC and audit records are retained as required.
                  </p>
                </div>
              </div>
              <Button
                variant="danger"
                loading={lifecycleBusy === "request_deletion"}
                onClick={() => void runLifecycle("request_deletion")}
              >
                Request deletion
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
