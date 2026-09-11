"use client";

// =============================================================================
// /app/account/notifications — notification preferences.
// securityNewLogin is MANDATORY: the toggle is locked and the server forces
// it on regardless of what the client sends.
// =============================================================================

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from "@/services/accountService";
import type { NotificationPreferences } from "@/types/account";
import { Lock } from "lucide-react";

export default function NotificationPreferencesPage() {
  return (
    <AuthGuard>
      <PrefsInner />
    </AuthGuard>
  );
}

type PrefKey = Exclude<keyof NotificationPreferences, "uid" | "updatedAt">;

const GROUPS: Array<{ title: string; items: Array<{ key: PrefKey; label: string; description: string; mandatory?: boolean }> }> = [
  {
    title: "Security",
    items: [
      { key: "securityNewLogin", label: "New sign-in alerts", description: "Email me when a new device signs in to my account.", mandatory: true },
      { key: "securitySessionChanges", label: "Session changes", description: "Sessions revoked or signed out remotely." },
      { key: "securityChanges", label: "Security changes", description: "Password and security-setting updates." },
    ],
  },
  {
    title: "Identity",
    items: [
      { key: "identityKycUpdates", label: "Verification updates", description: "Status changes to my identity verification." },
    ],
  },
  {
    title: "Connectivity",
    items: [
      { key: "connectivityEsimActivation", label: "eSIM activation", description: "When an eSIM becomes ready to install." },
      { key: "connectivityEsimStatus", label: "eSIM status", description: "Status and provisioning updates." },
    ],
  },
  {
    title: "Number",
    items: [
      { key: "numberActivation", label: "Number activation", description: "When my OneNumbr number is activated." },
      { key: "numberRelease", label: "Number release", description: "Confirmation when a number is released." },
    ],
  },
  {
    title: "Billing",
    items: [
      { key: "billingPayments", label: "Payments", description: "Payment confirmations and failures." },
      { key: "billingInvoices", label: "Invoices", description: "New invoices issued to my account." },
      { key: "billingRefunds", label: "Refunds", description: "Refund processing updates." },
      { key: "billingSubscriptionChanges", label: "Subscription changes", description: "Activation, pause and cancellation." },
    ],
  },
  {
    title: "Product",
    items: [
      { key: "marketingProductNews", label: "Product announcements", description: "Occasional news about new OneNumbr features. Optional." },
    ],
  },
];

function PrefsInner() {
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<PrefKey | null>(null);

  useEffect(() => {
    fetchNotificationPreferences()
      .then((d) => setPrefs(d.preferences))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load preferences."));
  }, []);

  async function toggle(key: PrefKey) {
    if (!prefs || key === "securityNewLogin") return;
    setSavingKey(key);
    try {
      const d = await updateNotificationPreferences({ [key]: !prefs[key] });
      setPrefs(d.preferences);
      showToast("Preferences saved.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save preference.", "error");
    } finally {
      setSavingKey(null);
    }
  }

  if (error) return <EmptyState title="Couldn't load preferences" description={error} />;
  if (prefs === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading preferences…" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {GROUPS.map((g) => (
        <Card key={g.title}>
          <CardHeader>
            <CardTitle>{g.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {g.items.map((item) => {
              const checked = prefs[item.key];
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-4 rounded-lg px-2 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {item.label}
                      {item.mandatory ? (
                        <Badge tone="neutral">
                          <Lock className="mr-1 inline h-2.5 w-2.5" /> Always on
                        </Badge>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    aria-label={item.label}
                    disabled={item.mandatory || savingKey === item.key}
                    onClick={() => void toggle(item.key)}
                    className={
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors " +
                      (checked ? "bg-primary" : "bg-muted") +
                      (item.mandatory ? " cursor-not-allowed opacity-70" : "")
                    }
                  >
                    <span
                      aria-hidden
                      className={
                        "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all " +
                        (checked ? "left-[22px]" : "left-0.5")
                      }
                    />
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
