"use client";

// =============================================================================
// /admin/esim — eSIM console (Plans / Orders / eSIMs / Providers)
//
// Plans:    full CRUD via /api/admin/esim/plans (incl. wholesale & margin —
//           admin-only fields that never reach customer APIs)
// Orders:   all orders + retry provisioning for paid-but-failed orders
// eSIMs:    provisioned SIMs with ICCID and provider refs
// Providers: registry status (mock = development only)
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Card, CardContent } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Field, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast";
import type { EsimPlan } from "@/types/esim";
import { formatData } from "@/types/esim";
import { SignalHigh, Plus, RefreshCw } from "lucide-react";

const TABS = ["Plans", "Orders", "eSIMs", "Providers"] as const;
type Tab = (typeof TABS)[number];

export default function AdminEsimPage() {
  return (
    <AdminGuard>
      <Console />
    </AdminGuard>
  );
}

function Console() {
  const [tab, setTab] = useState<Tab>("Plans");
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">eSIM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plans, orders, provisioned eSIMs and providers.
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-[10px] uppercase tracking-widest text-primary">
          <SignalHigh className="h-3 w-3" /> Development provider
        </span>
      </div>

      <Tabs
        ariaLabel="eSIM console"
        className="mb-6"
        tabs={TABS.map((t) => ({ value: t, label: t }))}
        value={tab}
        onChange={setTab}
      />

      {tab === "Plans" ? <PlansTab /> : null}
      {tab === "Orders" ? <OrdersTab /> : null}
      {tab === "eSIMs" ? <EsimsTab /> : null}
      {tab === "Providers" ? <ProvidersTab /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

const EMPTY_FORM = {
  countryCode: "",
  countryName: "",
  region: "Global",
  flag: "🌐",
  planName: "",
  dataAmount: 1,
  dataUnit: "GB" as "GB" | "MB",
  durationDays: 7,
  speed: "5G / LTE",
  networkType: "5G / LTE",
  coverage: "Nationwide",
  hotspot: true,
  activationPolicy: "Validity starts on activation",
  price: 5,
  currency: "USD",
  wholesaleCost: 2,
  margin: 3,
  status: "active" as "active" | "inactive" | "archived",
  featured: false,
  sortOrder: 100,
};

function PlansTab() {
  const { showToast } = useToast();
  const [plans, setPlans] = useState<EsimPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<EsimPlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/esim/plans");
      if (!res.ok) throw new Error(`Failed to load plans (${res.status})`);
      const data = (await res.json()) as { plans: EsimPlan[] };
      setPlans(data.plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plans.");
      setPlans((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = (plans ?? []).filter((p) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (
      p.countryName.toLowerCase().includes(s) ||
      p.countryCode.toLowerCase() === s ||
      p.planName.toLowerCase().includes(s)
    );
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setCreating(true);
  }
  function openEdit(p: EsimPlan) {
    setForm({
      countryCode: p.countryCode,
      countryName: p.countryName,
      region: p.region,
      flag: p.flag,
      planName: p.planName,
      dataAmount: p.dataAmount,
      dataUnit: p.dataUnit,
      durationDays: p.durationDays,
      speed: p.speed,
      networkType: p.networkType,
      coverage: p.coverage,
      hotspot: p.hotspot,
      activationPolicy: p.activationPolicy,
      price: p.price,
      currency: p.currency,
      wholesaleCost: p.wholesaleCost,
      margin: p.margin,
      status: p.status,
      featured: p.featured,
      sortOrder: p.sortOrder,
    });
    setEditing(p);
    setCreating(true);
  }

  async function save() {
    setSaving(true);
    try {
      const body = editing ? { id: editing.id, ...form } : form;
      const res = await fetch("/api/admin/esim/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) throw new Error(payload?.message ?? "Failed to save plan.");
      showToast(editing ? "Plan updated." : "Plan created.");
      setCreating(false);
      setEditing(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save plan.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search plans…"
          aria-label="Search plans"
          className="max-w-xs"
        />
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 inline h-4 w-4" /> New plan
        </Button>
      </div>

      {error ? (
        <EmptyState title="Couldn't load plans" description={error} />
      ) : plans === null ? (
        <Card>
          <CardContent>
            <LoadingState label="Loading plans…" />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No plans found"
          description={q ? `Nothing matches “${q}”.` : "Create the first plan to open the marketplace."}
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Destination</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Wholesale</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-3">
                      {p.flag} {p.countryName}
                    </td>
                    <td className="px-4 py-3">
                      {p.planName}
                      {p.featured ? (
                        <Badge tone="gold" className="ml-2">
                          Featured
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{formatData(p.dataAmount, p.dataUnit)}</td>
                    <td className="px-4 py-3">{p.durationDays}</td>
                    <td className="px-4 py-3 font-medium text-primary">
                      ${p.price} {p.currency}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      ${p.wholesaleCost} · m {p.margin}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          p.status === "active" ? "success" : p.status === "inactive" ? "warning" : "neutral"
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Modal
        open={creating}
        onClose={() => (saving ? undefined : setCreating(false))}
        title={editing ? `Edit plan — ${editing.planName}` : "New plan"}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {editing ? "Save changes" : "Create plan"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Country code">
            <Input
              value={form.countryCode}
              onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase().slice(0, 2) })}
              placeholder="JP"
              maxLength={2}
            />
          </Field>
          <Field label="Country name">
            <Input
              value={form.countryName}
              onChange={(e) => setForm({ ...form, countryName: e.target.value })}
              placeholder="Japan"
            />
          </Field>
          <Field label="Region">
            <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </Field>
          <Field label="Flag emoji">
            <Input value={form.flag} onChange={(e) => setForm({ ...form, flag: e.target.value })} />
          </Field>
          <Field label="Plan name">
            <Input
              value={form.planName}
              onChange={(e) => setForm({ ...form, planName: e.target.value })}
              placeholder="Japan Explorer"
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Data">
              <Input
                type="number"
                min={1}
                step="0.5"
                value={form.dataAmount}
                onChange={(e) => setForm({ ...form, dataAmount: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Unit">
              <select
                value={form.dataUnit}
                onChange={(e) => setForm({ ...form, dataUnit: e.target.value as "GB" | "MB" })}
                aria-label="Data unit"
                className="h-10 w-full rounded-lg border border-border bg-surface-2 px-2 text-sm"
              >
                <option value="GB">GB</option>
                <option value="MB">MB</option>
              </select>
            </Field>
            <Field label="Days">
              <Input
                type="number"
                min={1}
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) || 1 })}
              />
            </Field>
          </div>
          <Field label="Speed / network">
            <Input value={form.speed} onChange={(e) => setForm({ ...form, speed: e.target.value })} />
          </Field>
          <Field label="Coverage">
            <Input value={form.coverage} onChange={(e) => setForm({ ...form, coverage: e.target.value })} />
          </Field>
          <Field label="Activation policy">
            <Input
              value={form.activationPolicy}
              onChange={(e) => setForm({ ...form, activationPolicy: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Price">
              <Input
                type="number"
                min={0}
                step="0.5"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Wholesale">
              <Input
                type="number"
                min={0}
                step="0.5"
                value={form.wholesaleCost}
                onChange={(e) => setForm({ ...form, wholesaleCost: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Margin">
              <Input
                type="number"
                step="0.5"
                value={form.margin}
                onChange={(e) => setForm({ ...form, margin: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
              aria-label="Plan status"
              className="h-10 w-full rounded-lg border border-border bg-surface-2 px-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field label="Sort order">
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
            />
          </Field>
          <div className="flex items-center gap-6 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.hotspot}
                onChange={(e) => setForm({ ...form, hotspot: e.target.checked })}
                className="h-4 w-4 accent-[--primary]"
              />
              Hotspot allowed
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                className="h-4 w-4 accent-[--primary]"
              />
              Featured on marketplace
            </label>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Orders + eSIMs
// ---------------------------------------------------------------------------

interface AdminOrder {
  id: string;
  uid: string;
  email: string;
  planSnapshot: { countryName: string; flag: string; planName: string; dataAmount: number; dataUnit: string; durationDays: number };
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  orderStatus: string;
  provisioningStatus: string;
  esimId: string | null;
  createdAt: number | null;
}

interface AdminEsim {
  id: string;
  uid: string;
  email: string;
  countryName: string;
  flag: string;
  planName: string;
  status: string;
  iccid: string;
  provider: string;
  createdAt: number | null;
}

function OrdersTab() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/esim/data");
      if (!res.ok) throw new Error(`Failed to load orders (${res.status})`);
      const data = (await res.json()) as { orders: AdminOrder[]; esims: AdminEsim[] };
      setOrders(data.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders.");
      setOrders((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function retry(orderId: string) {
    setRetrying(orderId);
    try {
      const res = await fetch("/api/admin/esim/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action: "retry_provisioning" }),
      });
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) throw new Error(payload?.message ?? "Retry failed.");
      showToast("Provisioning retried.");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Retry failed.", "error");
    } finally {
      setRetrying(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" /> Refresh
        </Button>
      </div>
      {error ? (
        <EmptyState title="Couldn't load orders" description={error} />
      ) : orders === null ? (
        <Card>
          <CardContent>
            <LoadingState label="Loading orders…" />
          </CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <EmptyState title="No orders yet" description="Customer orders will appear here." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Destination</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Provisioning</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border/40 last:border-0">
                    <td className="max-w-[180px] truncate px-4 py-3">{o.email || o.uid.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      {o.planSnapshot?.flag} {o.planSnapshot?.countryName}
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">
                      ${o.totalAmount?.toFixed?.(2) ?? o.totalAmount} {o.currency}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={o.paymentStatus === "paid" ? "success" : o.paymentStatus === "failed" ? "danger" : "neutral"}>
                        {o.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          o.provisioningStatus === "succeeded"
                            ? "success"
                            : o.provisioningStatus === "failed"
                              ? "danger"
                              : o.provisioningStatus === "in_progress"
                                ? "gold"
                                : "neutral"
                        }
                      >
                        {o.provisioningStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {o.provisioningStatus === "failed" || o.orderStatus === "failed" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={retrying === o.id}
                          onClick={() => void retry(o.id)}
                        >
                          Retry
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function EsimsTab() {
  const [esims, setEsims] = useState<AdminEsim[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/esim/data")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load (${r.status})`);
        return r.json() as Promise<{ esims: AdminEsim[] }>;
      })
      .then((d) => setEsims(d.esims))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load eSIMs.");
        setEsims((prev) => prev ?? []);
      });
  }, []);

  if (error) return <EmptyState title="Couldn't load eSIMs" description={error} />;
  if (esims === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading eSIMs…" />
        </CardContent>
      </Card>
    );
  }
  if (esims.length === 0) {
    return <EmptyState title="No eSIMs provisioned" description="Provisioned eSIMs will appear here." />;
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Destination</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">ICCID</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Provider</th>
            </tr>
          </thead>
          <tbody>
            {esims.map((e) => (
              <tr key={e.id} className="border-b border-border/40 last:border-0">
                <td className="max-w-[180px] truncate px-4 py-3">{e.email || e.uid.slice(0, 8)}</td>
                <td className="px-4 py-3">
                  {e.flag} {e.countryName}
                </td>
                <td className="px-4 py-3">{e.planName}</td>
                <td className="px-4 py-3 font-mono text-xs">{e.iccid}</td>
                <td className="px-4 py-3">
                  <Badge tone={e.status === "ready" || e.status === "active" ? "success" : e.status === "failed" ? "danger" : "neutral"}>
                    {e.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{e.provider}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

function ProvidersTab() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Mock eSIM Provider</p>
            <Badge tone="warning">Development</Badge>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Generates clearly-marked demo ICCIDs and activation codes. No live carrier
            connectivity. The real provider plugs into the same EsimProvider interface.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Mock Payment Provider</p>
            <Badge tone="warning">Development</Badge>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Confirms payments deterministically in development. No card data is ever collected
            or stored. Stripe plugs into the same PaymentProvider interface.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
