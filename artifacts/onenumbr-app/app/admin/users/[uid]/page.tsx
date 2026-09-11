"use client";

// =============================================================================
// /admin/users/[uid] — user detail + support actions
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, DataRow } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LoadingState, EmptyState } from "@/components/ui/EmptyState";
import { Timeline, ErrorState } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/toast";

interface AdminUserDetail {
  uid: string;
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: number | null;
  lastLoginAt: number | null;
  profile: {
    fullName: string;
    country: string;
    phone: string;
    timezone: string;
    avatarUrl: string;
  } | null;
  identity: {
    onenumbr: string;
    status: string;
    createdAt: number | null;
  } | null;
  accountSupport?: {
    kycState: string;
    activeNumbers: number;
    activeEsims: number;
    accountState: string;
    twoFactorState: string;
    activeSessions: number;
  } | null;
}

export default function AdminUserDetailPage() {
  const params = useParams<{ uid: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [roleModal, setRoleModal] = useState(false);
  const [nextRole, setNextRole] = useState("user");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${params.uid}`);
      if (!res.ok) throw new Error(`Failed to load user (${res.status})`);
      setData((await res.json()) as AdminUserDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user.");
    }
  }, [params.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleStatusChange(newStatus: "active" | "suspended") {
    if (!data) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${data.uid}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Failed (${res.status})`);
      }
      showToast(`Account ${newStatus === "active" ? "reactivated" : "suspended"}.`, "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange() {
    if (!data) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${data.uid}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Failed (${res.status})`);
      }
      showToast("Role updated.", "success");
      setRoleModal(false);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="Couldn't load user"
          description={error}
          action={
            <Button variant="secondary" onClick={() => router.push("/admin/users")}>
              Back to users
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent>
            <LoadingState label="Loading user…" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={data.profile?.fullName || data.email}
        description={data.email}
        actions={
          <Link href="/admin/users">
            <Button variant="secondary">Back to users</Button>
          </Link>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/40">
            <DataRow label="UID">
              <span className="font-mono text-xs">{data.uid}</span>
            </DataRow>
            <DataRow label="OneNumbr ID">
              {data.identity ? (
                <span className="font-mono text-primary">{data.identity.onenumbr}</span>
              ) : (
                <span className="text-muted-foreground">Not issued</span>
              )}
            </DataRow>
            <DataRow label="Status">
              <span className="inline-flex items-center gap-2">
                <StatusBadge status={data.status} />
              </span>
            </DataRow>
            <DataRow label="Role">
              <span className="inline-flex items-center gap-2">
                <Badge>{data.role}</Badge>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setNextRole(data.role);
                    setRoleModal(true);
                  }}
                >
                  Change
                </button>
              </span>
            </DataRow>
            <DataRow label="Email verified">
              {data.emailVerified ? (
                <Badge tone="success">Verified</Badge>
              ) : (
                <Badge tone="warning">Unverified</Badge>
              )}
            </DataRow>
            <DataRow label="Created">
              {data.createdAt ? new Date(data.createdAt).toLocaleString() : "—"}
            </DataRow>
            <DataRow label="Last login">
              {data.lastLoginAt ? new Date(data.lastLoginAt).toLocaleString() : "—"}
            </DataRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/40">
            <DataRow label="Name">{data.profile?.fullName || "—"}</DataRow>
            <DataRow label="Country">{data.profile?.country || "—"}</DataRow>
            <DataRow label="Phone">{data.profile?.phone || "—"}</DataRow>
            <DataRow label="Timezone">{data.profile?.timezone || "—"}</DataRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account support</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/40">
            <DataRow label="KYC state">
              {data.accountSupport ? (
                <Badge tone={data.accountSupport.kycState === "verified" ? "success" : data.accountSupport.kycState === "pending" ? "warning" : "neutral"}>
                  {data.accountSupport.kycState}
                </Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DataRow>
            <DataRow label="Active numbers">
              {data.accountSupport?.activeNumbers ?? "—"}
            </DataRow>
            <DataRow label="Active eSIMs">
              {data.accountSupport?.activeEsims ?? "—"}
            </DataRow>
            <DataRow label="Account state">
              {data.accountSupport ? (
                <StatusBadge status={data.accountSupport.accountState} />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DataRow>
            <DataRow label="Two-factor">
              {data.accountSupport ? (
                <Badge>{data.accountSupport.twoFactorState}</Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DataRow>
            <DataRow label="Active sessions">
              {data.accountSupport?.activeSessions ?? "—"}
            </DataRow>
          </CardContent>
        </Card>

        <Customer360Card uid={data.uid} />

        <Card>
          <CardHeader>
            <CardTitle>Support actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-xs text-muted-foreground">
              Every action is audit-logged with your admin identity.
            </p>
            <div className="flex flex-wrap gap-3">
              {data.status === "active" ? (
                <Button
                  variant="danger"
                  loading={busy}
                  onClick={() => handleStatusChange("suspended")}
                >
                  Suspend account
                </Button>
              ) : (
                <Button loading={busy} onClick={() => handleStatusChange("active")}>
                  Reactivate account
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role change modal */}
      <Modal
        open={roleModal}
        onClose={() => setRoleModal(false)}
        title="Change user role"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRoleModal(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={handleRoleChange}>
              Update role
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted-foreground">
          The role is stored as a server-side custom claim. The user cannot
          change it, and the change is audit-logged.
        </p>
        <div className="space-y-2">
          {["user", "support", "admin"].map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50"
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={nextRole === r}
                onChange={() => setNextRole(r)}
                className="accent-[hsl(44_55%_54%)]"
              />
              <span className="uppercase tracking-wide">{r}</span>
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}

// =============================================================================
// Customer 360 — unified operational profile (Prompt 7). Data comes from the
// staff-only timeline API; no credentials, tokens or payment instruments are
// ever included.
// =============================================================================

function Customer360Card({ uid }: { uid: string }) {
  const [data, setData] = useState<Customer360 | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/users/${uid}/timeline`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const json = (await res.json()) as Customer360;
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load the customer 360 view.");
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer 360</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState title="Couldn't load customer state" description={error} />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer 360</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState label="Loading customer state…" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer 360</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MiniSection title="Number">
            {data.number.active.length === 0 ? (
              <span className="text-muted-foreground">No active numbers</span>
            ) : (
              data.number.active.map((n) => (
                <p key={n.id} className="font-mono text-sm text-primary">
                  {n.onenumbrNumber}
                </p>
              ))
            )}
            <p className="text-xs text-muted-foreground">{data.number.orders.length} recent order(s)</p>
          </MiniSection>
          <MiniSection title="Connectivity">
            {data.connectivity.connection ? (
              <p className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="capitalize">{data.connectivity.connection.mechanism.replaceAll("_", " ")}</span>
                <StatusBadge status={data.connectivity.connection.status} />
                <span className="text-xs text-muted-foreground">({data.connectivity.connection.environment})</span>
              </p>
            ) : data.connectivity.esims.length === 0 ? (
              <span className="text-muted-foreground">No connection</span>
            ) : null}
            {data.connectivity.esims.length > 0 ? (
              <p className="text-xs text-muted-foreground">+ {data.connectivity.esims.length} legacy eSIM(s)</p>
            ) : null}
          </MiniSection>
          <MiniSection title="Billing">
            {data.billing.recentPayments.length === 0 ? (
              <span className="text-muted-foreground">No payments</span>
            ) : (
              data.billing.recentPayments.slice(0, 3).map((p) => (
                <p key={p.id} className="text-sm">
                  {(p.amount / 100).toFixed(2)} {p.currency} · {p.status}
                </p>
              ))
            )}
          </MiniSection>
          <MiniSection title="Security">
            <p className="text-sm">{data.security.activeSessions} active session(s)</p>
            {data.security.currentDevice && <p className="text-xs text-muted-foreground">{data.security.currentDevice}</p>}
          </MiniSection>
          <MiniSection title="Support">
            {data.support.openTickets.length === 0 ? (
              <span className="text-muted-foreground">No open cases</span>
            ) : (
              data.support.openTickets.map((t) => (
                <Link key={t.id} href={`/admin/support/${t.id}`} className="block text-sm text-primary hover:underline">
                  {t.ticketNumber} · {t.subject}
                </Link>
              ))
            )}
          </MiniSection>
          <MiniSection title="Account state">
            <StatusBadge status={data.identity.accountStatus} />
          </MiniSection>
          <MiniSection title="Communications">
            {data.communications.primaryNumber ? (
              <p className="font-mono text-sm text-primary">{data.communications.primaryNumber}</p>
            ) : (
              <span className="text-muted-foreground">No primary number</span>
            )}
            <p className="text-xs text-muted-foreground">
              {data.communications.calls.length} call(s) · {data.communications.messages.length} message(s) ·{" "}
              {data.communications.voicemails.length} voicemail(s) — demo provider
            </p>
          </MiniSection>
          <MiniSection title="Endpoints">
            {data.communications.endpoints.length === 0 ? (
              <span className="text-muted-foreground">No endpoints connected</span>
            ) : (
              data.communications.endpoints.map((e) => (
                <p key={e.id} className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="truncate">{e.name}</span>
                  <span className="text-xs text-muted-foreground">({e.type.replaceAll("_", " ").toLowerCase()})</span>
                  <StatusBadge status={e.status} />
                  {e.isPrimary ? <StatusBadge status="primary" /> : null}
                </p>
              ))
            )}
          </MiniSection>
          <MiniSection title="Global Plan">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm">{data.plan.name}</span>
              <StatusBadge status={data.plan.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {data.plan.planVersion ? `Version ${data.plan.planVersion}` : "Version: pre-catalog"}
              {data.plan.amountMinor !== null && data.plan.currency
                ? ` · ${(data.plan.amountMinor / 100).toFixed(2)} ${data.plan.currency}/mo`
                : ""}
              {data.plan.provider ? ` · ${data.plan.provider} (demo)` : ""}
            </p>
          </MiniSection>
          <MiniSection title="Provider readiness">
            <p className="text-xs text-muted-foreground">
              {data.providerReadiness.summary.note}
            </p>
            {data.providerReadiness.providers.slice(0, 8).map((p) => (
              <div key={p.id} className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="truncate">{p.name}</span>
                <span className="text-muted-foreground">{p.category} · {p.availability}</span>
              </div>
            ))}
            {data.providerReadiness.providers.length > 8 && (
              <p className="mt-1 text-xs text-muted-foreground">+{data.providerReadiness.providers.length - 8} more provider slots</p>
            )}
          </MiniSection>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium">Unified activity timeline</p>
          <Timeline
            items={data.timeline.slice(0, 12).map((e) => ({
              at: e.at,
              title: e.title,
              detail: e.detail,
              tag: e.source,
            }))}
            emptyLabel="No recorded activity yet."
          />
        </div>
      </CardContent>
    </Card>
  );
}

function MiniSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

type Customer360 = {
  identity: { accountStatus: string };
  number: { active: { id: string; onenumbrNumber: string; status: string }[]; orders: unknown[] };
  connectivity: {
    esims: { id: string; label: string; status: string; planName: string }[];
    connection: { mechanism: string; status: string; providerId: string; environment: string } | null;
  };
  billing: { recentPayments: { id: string; amount: number; currency: string; status: string }[] };
  security: { activeSessions: number; currentDevice: string | null };
  support: { openTickets: { id: string; ticketNumber: string; subject: string; status: string; priority: string }[] };
  communications: {
    primaryNumber: string | null;
    calls: { id: string; direction: string; status: string; createdAt: number }[];
    messages: { id: string; direction: string; status: string; createdAt: number }[];
    voicemails: { id: string; caller: string; status: string; createdAt: number }[];
    endpoints: { id: string; name: string; type: string; status: string; isPrimary: boolean; lastActiveAt: number | null }[];
  };
  plan: {
    status: string;
    name: string;
    planId: string | null;
    planVersion: string | null;
    amountMinor: number | null;
    currency: string | null;
    interval: string | null;
    currentPeriodEnd: number | null;
    provider: string | null;
  };
  providerReadiness: {
    providers: { id: string; name: string; category: string; environment: string; availability: string; configState: string; note: string }[];
    summary: { available: number; demo: number; disabled: number; configured: number; note: string };
  };
  timeline: { at: number; source: string; title: string; detail?: string }[];
};
