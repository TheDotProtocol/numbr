"use client";

// =============================================================================
// /app/devices — device management (server-coordinated).
//
// Current device is resolved SERVER-side from the registered session/device;
// client hints are only correlation keys. Honest metadata only — no invented
// hardware or location claims.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast";
import {
  fetchDevices,
  renameDevice,
  setDeviceTrusted,
  removeDevice,
} from "@/services/accountService";
import type { DeviceView } from "@/types/account";
import { Monitor, Smartphone, Tablet } from "lucide-react";

export default function DevicesPage() {
  return (
    <AuthGuard>
      <DevicesInner />
    </AuthGuard>
  );
}

function DevicesInner() {
  const { showToast } = useToast();
  const [devices, setDevices] = useState<DeviceView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<DeviceView | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<DeviceView | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await fetchDevices();
      setDevices(d.devices.filter((d) => !d.revokedAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices.");
      setDevices((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRename() {
    if (!renaming) return;
    setBusy(renaming.id);
    try {
      await renameDevice(renaming.id, newName);
      showToast("Device renamed.");
      setRenaming(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Rename failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function toggleTrust(d: DeviceView) {
    setBusy(d.id);
    try {
      await setDeviceTrusted(d.id, !d.trusted);
      showToast(d.trusted ? "Trust removed." : "Device marked trusted.");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(removing.id);
    try {
      await removeDevice(removing.id);
      showToast("Device removed and its sessions revoked.");
      setRemoving(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Remove failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (error) return <EmptyState title="Couldn't load devices" description={error} />;
  if (devices === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading devices…" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Devices"
        description="Browsers and devices that have accessed your account."
      />

      {devices.length === 0 ? (
        <EmptyState
          icon={<Monitor className="h-5 w-5" />}
          title="No additional devices"
          description="Devices appear here automatically as you sign in from new browsers or apps."
        />
      ) : (
        <div className="space-y-3">
          {devices.map((d) => {
            const Icon = d.deviceType === "mobile" ? Smartphone : d.deviceType === "tablet" ? Tablet : Monitor;
            return (
              <Card key={d.id} className={d.current ? "border-primary/40" : undefined}>
                <CardContent>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {d.deviceName}
                          {d.current ? <Badge tone="success">This device</Badge> : null}
                          {d.trusted ? <Badge tone="neutral">Trusted</Badge> : null}
                          {!d.current && d.activeSessions > 0 ? (
                            <Badge tone="gold">Active</Badge>
                          ) : !d.current ? (
                            <Badge tone="neutral">Signed out</Badge>
                          ) : null}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {d.activeSessions > 0
                            ? `${d.activeSessions} active ${d.activeSessions === 1 ? "session" : "sessions"} · `
                            : ""}
                          first seen {d.firstSeenAt ? new Date(d.firstSeenAt).toLocaleDateString() : "—"}
                          {" · "}
                          last active {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRenaming(d);
                          setNewName(d.deviceName);
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy === d.id}
                        onClick={() => void toggleTrust(d)}
                      >
                        {d.trusted ? "Remove trust" : "Trust"}
                      </Button>
                      {!d.current ? (
                        <Button size="sm" variant="ghost" onClick={() => setRemoving(d)}>
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rename modal */}
      <Modal
        open={renaming !== null}
        onClose={() => (busy ? undefined : setRenaming(null))}
        title="Rename device"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenaming(null)} disabled={Boolean(busy)}>
              Cancel
            </Button>
            <Button onClick={saveRename} loading={Boolean(busy)}>
              Save
            </Button>
          </div>
        }
      >
        <Field label="Device name" htmlFor="device-name">
          <Input
            id="device-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={60}
            placeholder="MacBook Pro · Work"
          />
        </Field>
      </Modal>

      {/* Remove confirmation */}
      <Modal
        open={removing !== null}
        onClose={() => (busy ? undefined : setRemoving(null))}
        title="Remove this device?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRemoving(null)} disabled={Boolean(busy)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmRemove} loading={Boolean(busy)}>
              Remove device
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          {removing ? removing.deviceName : ""} will be signed out everywhere and removed from
          your device list. It will reappear if it signs in again.
        </p>
      </Modal>
    </div>
  );
}
