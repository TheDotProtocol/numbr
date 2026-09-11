"use client";

// =============================================================================
// /admin/numbers — Number console (Inventory / Orders / Assignments / Providers)
//
// Inventory: create/edit mock inventory via /api/admin/numbers (duplicate
//   OneNumbr numbers and per-provider duplicate provider numbers are rejected
//   server-side). Ownership fields (uid, reservations) are not editable here.
// Orders: all number orders + retry provisioning for paid-but-failed orders.
// Assignments: history-preserving view (active + released).
// Providers: honest "development" status for the mock telecom provider.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Card, CardContent } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast";
import type { NumberRecord } from "@/types/number";
import { Hash, Plus, RefreshCw } from "lucide-react";

const TABS = ["Inventory", "Orders", "Assignments", "Providers"] as const;
type Tab = (typeof TABS)[number];

export default function AdminNumbersPage() {
  return (
    <AdminGuard>
      <Console />
    </AdminGuard>
  );
}

function Console() {
  const [tab, setTab] = useState<Tab>("Inventory");
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Numbers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inventory, orders, assignments and providers.
        </p>
      </div>

      <Tabs
        ariaLabel="Number console"
        className="mb-6"
        tabs={TABS.map((t) => ({ value: t, label: t }))}
        value={tab}
        onChange={setTab}
      />

      {tab === "Inventory" ? <InventoryTab /> : null}
      {tab === "Orders" ? <OrdersTab /> : null}
      {tab === "Assignments" ? <AssignmentsTab /> : null}
      {tab === "Providers" ? <ProvidersTab /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

const EMPTY_FORM = {
  onenumbrNumber: "+",
  providerNumber: "",
  countryCode: "US",
  region: "OneNumbr Global",
  type: "mobile" as "mobile" | "local" | "toll_free" | "international",
  capabilities: ["SMS", "VOICE"] as string[],
  monthlyPrice: 5,
  currency: "USD",
  provider: "mock-telecom",
  status: "available" as NumberRecord["status"],
};

function InventoryTab() {
  const { showToast } = useToast();
  const [numbers, setNumbers] = useState<(NumberRecord & { email: string })[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/numbers");
      if (!res.ok) throw new Error(`Failed to load inventory (${res.status})`);
      const data = (await res.json()) as { numbers: (NumberRecord & { email: string })[] };
      setNumbers(data.numbers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory.");
      setNumbers((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = (numbers ?? []).filter((n) => {
    if (statusFilter && n.status !== statusFilter) return false;
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (
      n.onenumbrNumber.includes(s) ||
      n.displayNumber.toLowerCase().includes(s) ||
      n.countryCode.toLowerCase() === s
    );
  });

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) throw new Error(payload?.message ?? "Failed to save number.");
      showToast("Number added to inventory.");
      setCreating(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save number.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search numbers…"
            aria-label="Search inventory"
            className="w-52"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Status filter"
            className="h-10 rounded-lg border border-border bg-surface-2 px-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="provisioning">Provisioning</option>
            <option value="active">Active</option>
            <option value="failed">Failed</option>
            <option value="released">Released</option>
          </select>
        </div>
        <Button
          onClick={() => {
            setForm(EMPTY_FORM);
            setCreating(true);
          }}
        >
          <Plus className="mr-1.5 inline h-4 w-4" /> Add number
        </Button>
      </div>

      {error ? (
        <EmptyState title="Couldn't load inventory" description={error} />
      ) : numbers === null ? (
        <Card>
          <CardContent>
            <LoadingState label="Loading inventory…" />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Hash className="h-5 w-5" />}
          title="No numbers found"
          description={
            q || statusFilter
              ? "Nothing matches the current filters."
              : "Add mock numbers to the inventory to open the marketplace."
          }
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Number</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium">Capabilities</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Assigned user</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => (
                  <tr key={n.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-3 font-mono">{n.displayNumber}</td>
                    <td className="px-4 py-3">{n.type.replace("_", " ")}</td>
                    <td className="px-4 py-3">{n.countryCode}</td>
                    <td className="px-4 py-3">{n.capabilities.join(" · ")}</td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          n.status === "active"
                            ? "success"
                            : n.status === "available"
                              ? "gold"
                              : n.status === "failed"
                                ? "danger"
                                : "neutral"
                        }
                      >
                        {n.status}
                      </Badge>
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3">{n.email || "—"}</td>
                    <td className="px-4 py-3 font-medium text-primary">
                      ${n.monthlyPrice} {n.currency}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{n.provider}</td>
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
        title="Add number to inventory"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="OneNumbr number (E.164)">
            <Input
              value={form.onenumbrNumber}
              onChange={(e) => setForm({ ...form, onenumbrNumber: e.target.value })}
              placeholder="+1739284739"
            />
          </Field>
          <Field label="Provider number">
            <Input
              value={form.providerNumber}
              onChange={(e) => setForm({ ...form, providerNumber: e.target.value })}
              placeholder="MOCK-TELECOM-0001"
            />
          </Field>
          <Field label="Country code">
            <Input
              value={form.countryCode}
              onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase().slice(0, 2) })}
            />
          </Field>
          <Field label="Region">
            <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </Field>
          <Field label="Type">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
              aria-label="Number type"
              className="h-10 w-full rounded-lg border border-border bg-surface-2 px-2 text-sm"
            >
              <option value="mobile">Mobile</option>
              <option value="international">International</option>
              <option value="local">Local</option>
              <option value="toll_free">Toll-free</option>
            </select>
          </Field>
          <Field label="Monthly price">
            <Input
              type="number"
              min={0}
              step="0.5"
              value={form.monthlyPrice}
              onChange={(e) => setForm({ ...form, monthlyPrice: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Currency">
            <Input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })}
            />
          </Field>
          <Field label="Provider">
            <Input
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as NumberRecord["status"] })}
              aria-label="Number status"
              className="h-10 w-full rounded-lg border border-border bg-surface-2 px-2 text-sm"
            >
              <option value="available">Available</option>
              <option value="suspended">Suspended</option>
              <option value="released">Released</option>
            </select>
          </Field>
          <div className="flex items-center gap-6 sm:col-span-2">
            {(["SMS", "VOICE"] as const).map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.capabilities.includes(c)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      capabilities: e.target.checked
                        ? [...form.capabilities, c]
                        : form.capabilities.filter((x) => x !== c),
                    })
                  }
                  className="h-4 w-4"
                />
                {c}
              </label>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Duplicates are rejected automatically — each OneNumbr number must be globally unique,
          and provider numbers unique per provider.
        </p>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Orders + Assignments
// ---------------------------------------------------------------------------

interface AdminNumberOrder {
  id: string;
  email: string;
  numberSnapshot: { displayNumber: string; onenumbrNumber: string };
  totalAmount: number;
  currency: string;
  paymentStatus: string;
  orderStatus: string;
  createdAt: number | null;
}

interface AdminAssignment {
  id: string;
  email: string;
  displayNumber: string;
  onenumbrNumber: string;
  status: string;
  assignedAt: number | null;
  releasedAt: number | null;
}

function OrdersTab() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<AdminNumberOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/number-data");
      if (!res.ok) throw new Error(`Failed to load orders (${res.status})`);
      const data = (await res.json()) as {
        orders: AdminNumberOrder[];
        assignments: AdminAssignment[];
      };
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
      const res = await fetch("/api/admin/number-data", {
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
        <EmptyState title="No number orders yet" description="Customer orders will appear here." />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Number</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-border/40 last:border-0">
                    <td className="max-w-[180px] truncate px-4 py-3">{o.email || "—"}</td>
                    <td className="px-4 py-3 font-mono">{o.numberSnapshot?.displayNumber ?? "—"}</td>
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
                          o.orderStatus === "active"
                            ? "success"
                            : o.orderStatus === "failed"
                              ? "danger"
                              : o.orderStatus === "provisioning"
                                ? "gold"
                                : "neutral"
                        }
                      >
                        {o.orderStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {o.orderStatus === "failed" ? (
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

function AssignmentsTab() {
  const [assignments, setAssignments] = useState<AdminAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/number-data")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load (${r.status})`);
        return r.json() as Promise<{ assignments: AdminAssignment[] }>;
      })
      .then((d) => setAssignments(d.assignments))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load assignments.");
        setAssignments((prev) => prev ?? []);
      });
  }, []);

  if (error) return <EmptyState title="Couldn't load assignments" description={error} />;
  if (assignments === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading assignments…" />
        </CardContent>
      </Card>
    );
  }
  if (assignments.length === 0) {
    return (
      <EmptyState title="No assignments yet" description="Assignment history will appear here." />
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Assigned</th>
              <th className="px-4 py-3 font-medium">Released</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-3 font-mono">{a.displayNumber}</td>
                <td className="max-w-[180px] truncate px-4 py-3">{a.email || "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={a.status === "active" ? "success" : a.status === "released" ? "neutral" : "warning"}>
                    {a.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {a.assignedAt ? new Date(a.assignedAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {a.releasedAt ? new Date(a.releasedAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ProvidersTab() {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Mock Telecom Provider</p>
          <Badge tone="warning">Development</Badge>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Simulates availability, reservation, assignment, activation and release with clearly
          demo-marked references (provider name “mock-telecom”). Capabilities modelled: SMS,
          VOICE. Numbers are not connected to the public telephone network. A real carrier
          adapter plugs into the same TelecomProvider interface without UI changes.
        </p>
      </CardContent>
    </Card>
  );
}
