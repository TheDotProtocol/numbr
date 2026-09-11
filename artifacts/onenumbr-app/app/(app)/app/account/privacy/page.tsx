"use client";

// =============================================================================
// /app/account/privacy — privacy settings.
// Only controls the backend actually honours are shown; unavailable controls
// are labeled honestly. No invented privacy promises.
// =============================================================================

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast";
import { fetchPrivacySettings, updatePrivacySettings } from "@/services/accountService";
import type { PrivacySettings } from "@/types/account";

export default function PrivacyPage() {
  return (
    <AuthGuard>
      <PrivacyInner />
    </AuthGuard>
  );
}

type PrefKey = Exclude<keyof PrivacySettings, "uid" | "updatedAt">;

const CONTROLS: Array<{
  key: PrefKey;
  label: string;
  description: string;
  available: boolean;
}> = [
  {
    key: "productCommunications",
    label: "Product & service communications",
    description: "Essential updates about your account, services and security.",
    available: true,
  },
  {
    key: "marketingCommunications",
    label: "Marketing communications",
    description: "Optional announcements. No marketing emails are sent yet — the preference is stored for when they are.",
    available: true,
  },
];

function PrivacyInner() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<PrefKey | null>(null);

  useEffect(() => {
    fetchPrivacySettings()
      .then((d) => setSettings(d.settings))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load privacy settings."));
  }, []);

  async function toggle(key: PrefKey) {
    if (!settings) return;
    setSavingKey(key);
    try {
      const d = await updatePrivacySettings({ [key]: !settings[key] });
      setSettings(d.settings);
      showToast("Privacy settings saved.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save setting.", "error");
    } finally {
      setSavingKey(null);
    }
  }

  if (error) return <EmptyState title="Couldn't load privacy settings" description={error} />;
  if (settings === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading privacy settings…" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Communications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {CONTROLS.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-4 rounded-lg px-2 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings[c.key]}
                aria-label={c.label}
                disabled={savingKey === c.key}
                onClick={() => void toggle(c.key)}
                className={
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
                  (settings[c.key] ? "bg-primary" : "bg-muted")
                }
              >
                <span
                  aria-hidden
                  className={
                    "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all " +
                    (settings[c.key] ? "left-[22px]" : "left-0.5")
                  }
                />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data &amp; privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Badge tone="neutral">Always on</Badge>
            Sign-in events record a privacy-safe device description only — IP addresses are
            hashed and locations are never inferred.
          </p>
          <p className="flex items-center gap-2">
            <Badge tone="neutral">Retention</Badge>
            Invoices, payments and audit records are retained as required even after account
            deletion requests; personal access is locked instead of erasing history.
          </p>
          <p className="flex items-center gap-2">
            <Badge tone="neutral">Analytics</Badge>
            OneNumbr does not run product analytics in this release.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
