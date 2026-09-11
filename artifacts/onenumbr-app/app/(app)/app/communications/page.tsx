"use client";

// =============================================================================
// /app/communications — the communications layer of OneNumbr (Prompt 11).
//
// HONESTY CONTRACT: this environment runs the mock-communications provider.
// Every action here is a clearly-labeled simulation ("Demo communication").
// Nothing places real calls, delivers real SMS, or touches the PSTN.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, DataRow } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState, Skeleton } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { HelpLink } from "@/components/app/HelpLink";
import { ConfirmDialog } from "@/components/ui/Feedback";
import { fetchCommunicationsOverview, initiateCall, markMessageRead, sendMessage, updateRouting } from "@/services/communicationsService";
import { endpointAction, listMyEndpoints, registerEndpoint, setPrimaryEndpoint, simulateRouting } from "@/services/endpointsService";
import { toAppError } from "@/lib/errors";
import { updateCall } from "@/services/communicationsService";
import type { CommunicationsOverview, MessageRecord, RoutingAction, VoicemailRecord } from "@/types/communications";
import { ENDPOINT_TYPE_AVAILABILITY, ENDPOINT_TYPE_LABELS } from "@/types/endpoints";
import type { EndpointRoutingDecision, EndpointType, EndpointView } from "@/types/endpoints";

const REGISTRABLE_ENDPOINTS: EndpointType[] = ["web", "tau_phone", "tau_talk", "mobile_app"];

type Tab = "voice" | "messages" | "voicemail" | "routing" | "endpoints";

function formatTs(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CommunicationsPage() {
  const [overview, setOverview] = useState<CommunicationsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("voice");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Endpoint manager state (Prompt 12)
  const [endpoints, setEndpoints] = useState<EndpointView[] | null>(null);
  const [newType, setNewType] = useState<EndpointType>("tau_phone");
  const [newName, setNewName] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<EndpointView | null>(null);
  const [routingDecision, setRoutingDecision] = useState<EndpointRoutingDecision | null>(null);

  // demo compose state
  const [callTarget, setCallTarget] = useState("");
  const [msgTarget, setMsgTarget] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [vmCaller, setVmCaller] = useState("");
  const [vmText, setVmText] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      setOverview(await fetchCommunicationsOverview());
    } catch (err) {
      setError(toAppError(err).message);
    }
  }, []);

  const loadEndpoints = useCallback(async () => {
    try {
      setEndpoints(await listMyEndpoints());
    } catch {
      setEndpoints([]); // endpoints unavailable — page still works
    }
  }, []);

  useEffect(() => {
    void load();
    void loadEndpoints();
  }, [load, loadEndpoints]);

  async function run(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice(successMessage);
      await load();
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !overview) {
    return (
      <div>
        <PageHeader title="Communications" description="Your OneNumbr Number is how people reach you." />
        <ErrorState
          title="We couldn't load your communications"
          description={error}
          action={
            <Button variant="secondary" onClick={load}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { number, plan, provider } = overview;

  if (!number) {
    return (
      <div>
        <PageHeader
          title="Communications"
          description="Voice, messaging and voicemail run on your OneNumbr Number."
        />
        <EmptyState
          title="Choose your OneNumbr Number first"
          description="Communications are built on your OneNumbr Number — the public identity people use to reach you."
          action={
            <Button variant="secondary" onClick={() => (window.location.href = "/app/number")}>
              Choose a Number
            </Button>
          }
        />
      </div>
    );
  }

  const readMessages = overview.recentMessages.filter((m) => m.status !== "read").length;
  const newVoicemails = overview.recentVoicemails.filter((v) => v.status === "new").length;

  return (
    <div>
      <PageHeader
        title="Communications"
        description="Voice, messaging and voicemail — all on your OneNumbr Number."
        actions={<HelpLink slug="how-does-number-work" label="What is a OneNumbr Number?" />}
      />

      {/* Number + plan identity block */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Your OneNumbr Number</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xl tracking-wide text-foreground">{number.displayNumber}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status="primary" />
              <StatusBadge status={number.numberingStatus} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Application-level identity — not yet connected to the public telephone network.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Global Plan</CardTitle>
          </CardHeader>
          <CardContent>
            {plan.active ? (
              <>
                <p className="text-sm font-medium text-foreground">{plan.planName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.amountMinor != null && plan.currency
                    ? `${new Intl.NumberFormat("en-US", { style: "currency", currency: plan.currency }).format(plan.amountMinor / 100)} / ${plan.interval ?? "month"}`
                    : "Active"}
                  {plan.currentPeriodEnd ? ` · renews ${formatTs(plan.currentPeriodEnd)}` : ""}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Demo billing — no real charges are made.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">No active plan yet.</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => (window.location.href = "/app/number")}>
                  Activate your number plan
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-foreground">
              Demo communications provider
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Voice, messaging and voicemail are simulations in this environment (reference prefix{" "}
              <span className="font-mono">MOCK-*</span>). They become live only with a real
              communications provider.
            </p>
          </CardContent>
        </Card>
      </div>

      {notice ? (
        <div role="status" className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-foreground">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm text-foreground">
          {error}
        </div>
      ) : null}

      <div className="mt-6">
        <Tabs<Tab>
          ariaLabel="Communications sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "voice", label: "Voice", count: overview.recentCalls.length },
            { value: "messages", label: "Messages", count: overview.recentMessages.length },
            { value: "voicemail", label: "Voicemail", count: overview.recentVoicemails.length },
            { value: "routing", label: "Routing" },
            { value: "endpoints", label: "Endpoints", count: endpoints?.length },
          ]}
        />
      </div>

      {/* VOICE */}
      {tab === "voice" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Simulate a demo call</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="block text-sm text-foreground">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Call target</span>
                <Input placeholder="e.g. Demo Contact" value={callTarget} onChange={(e) => setCallTarget(e.target.value)} maxLength={60} />
              </label>
              <Button
                disabled={busy || !callTarget.trim()}
                onClick={() =>
                  run(async () => {
                    await initiateCall(callTarget.trim());
                    setCallTarget("");
                  }, "Demo call placed (simulation — no real call was made).")
                }
              >
                Start demo call
              </Button>
              <p className="text-xs text-muted-foreground">
                Starts an outbound demo call from {number.displayNumber}. You can answer or end it
                from the list below.
              </p>
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader><CardTitle>Recent calls</CardTitle></CardHeader>
            <CardContent>
              {overview.recentCalls.length === 0 ? (
                <EmptyState
                  title="No calls yet"
                  description="Demo calls you start will appear here with their lifecycle."
                />
              ) : (
                <ul className="divide-y divide-border/60">
                  {overview.recentCalls.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {c.direction === "outbound" ? `To ${c.to.label}` : `From ${c.from.label}`}
                          <span className="ml-2 text-xs text-muted-foreground">demo</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{formatTs(c.startedAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={c.status} />
                        {c.status !== "ended" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              run(
                                async () => {
                                  await updateCall({ callId: c.id, status: "ended", terminationReason: "hangup" });
                                },
                                "Demo call ended.",
                              )
                            }
                          >
                            End
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* MESSAGES */}
      {tab === "messages" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Send a demo message</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="block text-sm text-foreground">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">To</span>
                <Input placeholder="e.g. Demo Contact" value={msgTarget} onChange={(e) => setMsgTarget(e.target.value)} maxLength={60} />
              </label>
              <label className="block text-sm text-foreground">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Message</span>
                <Input placeholder="Type your message…" value={msgBody} onChange={(e) => setMsgBody(e.target.value)} maxLength={1000} />
              </label>
              <Button
                disabled={busy || !msgTarget.trim() || !msgBody.trim()}
                onClick={() =>
                  run(async () => {
                    await sendMessage(msgTarget.trim(), msgBody.trim());
                    setMsgTarget("");
                    setMsgBody("");
                  }, "Demo message delivered (simulation — not PSTN SMS).")
                }
              >
                Send demo message
              </Button>
              <p className="text-xs text-muted-foreground">
                OneNumbr messaging is an application feature in this environment. It is not carrier SMS.
              </p>
            </CardContent>
          </Card>
          <Card className="lg:col-span-3">
            <CardHeader><CardTitle>Recent messages</CardTitle></CardHeader>
            <CardContent>
              {overview.recentMessages.length === 0 ? (
                <EmptyState title="No messages yet" description="Demo messages you send will appear here." />
              ) : (
                <ul className="divide-y divide-border/60">
                  {overview.recentMessages.map((m) => (
                    <MessageRow key={m.id} message={m} busy={busy} onRead={() => run(async () => { await markMessageRead(m.id); }, "Message marked as read.")} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* VOICEMAIL */}
      {tab === "voicemail" ? (
        <Card className="mt-6">
          <CardHeader><CardTitle>Voicemail</CardTitle></CardHeader>
          <CardContent>
            {overview.recentVoicemails.length === 0 ? (
              <EmptyState
                title="No voicemails"
                description="When the routing fallback takes a demo call, the voicemail will appear here."
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {overview.recentVoicemails.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        From {v.caller.label} · {v.durationSeconds}s
                        <span className="ml-2 text-xs text-muted-foreground">demo</span>
                      </p>
                      {v.transcript ? <p className="mt-0.5 truncate text-xs text-muted-foreground">“{v.transcript}”</p> : null}
                      <p className="text-xs text-muted-foreground">{formatTs(v.createdAt)}</p>
                    </div>
                    <StatusBadge status={v.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* ROUTING */}
      {tab === "routing" ? (
        <RoutingPanel overview={overview} busy={busy} onSaved={(msg) => run(async () => {}, msg)} />
      ) : null}

      {/* ENDPOINTS (Prompt 12) */}
      {tab === "endpoints" && number ? (
        <EndpointsPanel
          number={number}
          oneNumbrId={null}
          endpoints={endpoints}
          busy={busy}
          setBusy={setBusy}
          setNotice={setNotice}
          setError={setError}
          reload={async () => {
            await loadEndpoints();
            await load();
          }}
          newType={newType}
          setNewType={setNewType}
          newName={newName}
          setNewName={setNewName}
          revokeTarget={revokeTarget}
          setRevokeTarget={setRevokeTarget}
          routingDecision={routingDecision}
          setRoutingDecision={setRoutingDecision}
        />
      ) : null}

      {/* Revoke confirmation */}
      <ConfirmDialog
        title="Revoke endpoint?"
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={async () => {
          if (!revokeTarget) return;
          const target = revokeTarget;
          setRevokeTarget(null);
          setBusy(true);
          try {
            await endpointAction(target.id, "revoke");
            setNotice(`${target.name} revoked. Your number and identity are unchanged.`);
            await loadEndpoints();
          } catch (err) {
            setError(toAppError(err).message);
          } finally {
            setBusy(false);
          }
        }}
        confirmLabel="Revoke endpoint"
        danger
        busy={busy}
      >
        {revokeTarget
          ? `${revokeTarget.name} will immediately lose access to ${number.displayNumber}. This endpoint can't be reactivated — you'd connect it again as a new endpoint. Your OneNumbr ID and number are NOT affected.`
          : ""}
      </ConfirmDialog>
    </div>
  );
}

function MessageRow({ message: m, busy, onRead }: { message: MessageRecord; busy: boolean; onRead: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {m.direction === "outbound" ? `To ${m.to.label}` : `From ${m.from.label}`}
          <span className="ml-2 text-xs text-muted-foreground">demo</span>
        </p>
        <p className="truncate text-sm text-muted-foreground">{m.body}</p>
        <p className="text-xs text-muted-foreground">{formatTs(m.createdAt)}</p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={m.status} />
        {m.status !== "read" ? (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onRead}>
            Mark read
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function RoutingPanel({
  overview,
  busy,
  onSaved,
}: {
  overview: CommunicationsOverview;
  busy: boolean;
  onSaved: (msg: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const steps = overview.routing?.steps ?? ["app", "voicemail"];
  const [selected, setSelected] = useState<RoutingAction[]>(steps);
  const [timeout_, setTimeout_] = useState(overview.routing?.ringTimeoutSeconds ?? 25);
  const numberId = overview.number?.numberId ?? "";
  const voicemails = overview.recentVoicemails;

  const toggle = (action: RoutingAction) => {
    setSelected((prev) => {
      if (prev.includes(action)) return prev.filter((a) => a !== action && a !== "voicemail");
      return [...prev, action];
    });
  };

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Inbound routing (application-level)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Chooses how a demo inbound call to {overview.number?.displayNumber} is handled inside
            OneNumbr. No carrier forwarding is performed. Voicemail is always the final fallback.
          </p>
          <div className="space-y-2">
            {([
              { action: "app" as RoutingAction, label: "OneNumbr app (web)" },
              { action: "tau_phone" as RoutingAction, label: "TauPhone (coming later)" },
              { action: "verified_device" as RoutingAction, label: "Verified device (coming later)" },
              { action: "forward" as RoutingAction, label: "Forward to endpoint (coming later)" },
            ]).map(({ action, label }) => (
              <label key={action} className="flex items-center gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={selected.includes(action)}
                  onChange={() => toggle(action)}
                  className="h-4 w-4 accent-[var(--primary)]"
                  disabled={action !== "app"}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="max-w-[200px]">
            <label className="block text-sm text-foreground">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Ring timeout (seconds)</span>
              <Input type="number" min={5} max={60} value={String(timeout_)} onChange={(e) => setTimeout_(Number(e.target.value) || 25)} />
            </label>
          </div>
          <Button
            disabled={busy || saving || !numberId}
            onClick={async () => {
              try {
                setSaving(true);
                await updateRouting({ steps: selected.includes("voicemail") ? selected : [...selected, "voicemail"], ringTimeoutSeconds: timeout_ });
                onSaved("Routing rules saved (application-level).");
              } finally {
                setSaving(false);
              }
            }}
          >
            Save routing
          </Button>
          {voicemails.length > 0 ? (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground">{voicemails.filter((v) => v.status === "new").length} new voicemail(s) as fallback evidence.</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Communication endpoints</CardTitle></CardHeader>
        <CardContent>
          {overview.endpoints.length === 0 ? (
            <EmptyState
              title="No extra endpoints"
              description="Your OneNumbr app is the default endpoint. Devices like TauPhone or verified devices will appear here later."
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {overview.endpoints.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{e.label}</p>
                    <p className="text-xs text-muted-foreground">{e.kind}</p>
                  </div>
                  <StatusBadge status={e.enabled ? "active" : "inactive"} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            One Number, many endpoints — future devices and providers attach here without changing
            your number.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Endpoint manager (Prompt 12) — "Your number belongs to your identity, not
// your device." Registration, primary preference, revocation and the
// deterministic routing simulation. All demo-labeled.
// =============================================================================

function EndpointsPanel({
  number,
  oneNumbrId,
  endpoints,
  busy,
  setBusy,
  setNotice,
  setError,
  reload,
  newType,
  setNewType,
  newName,
  setNewName,
  revokeTarget,
  setRevokeTarget,
  routingDecision,
  setRoutingDecision,
}: {
  number: { displayNumber: string };
  oneNumbrId: string | null;
  endpoints: EndpointView[] | null;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setNotice: (v: string | null) => void;
  setError: (v: string | null) => void;
  reload: () => Promise<void>;
  newType: EndpointType;
  setNewType: (t: EndpointType) => void;
  newName: string;
  setNewName: (v: string) => void;
  revokeTarget: EndpointView | null;
  setRevokeTarget: (v: EndpointView | null) => void;
  routingDecision: EndpointRoutingDecision | null;
  setRoutingDecision: (d: EndpointRoutingDecision | null) => void;
}) {
  async function act(action: () => Promise<void>, message: string) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await action();
      setNotice(message);
      await reload();
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Promise banner */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
        <p className="text-sm font-medium text-foreground">Your number belongs to your identity — not your device.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Connect as many endpoints as you like. Your OneNumbr ID and {number.displayNumber} stay
          exactly the same when endpoints change, disappear or come back.
        </p>
      </div>

      {/* Endpoint cards */}
      {endpoints === null ? (
        <Skeleton className="h-32 w-full" />
      ) : endpoints.length === 0 ? (
        <EmptyState
          title="No endpoints yet"
          description={`Connect this browser, TauPhone or TauTalk to reach ${number.displayNumber}.`}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {endpoints.map((e) => (
            <Card key={e.id} className={e.isPrimary ? "border-primary/60" : undefined}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{e.typeLabel}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={e.status} />
                    {e.isPrimary ? <StatusBadge status="primary" /> : null}
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {e.availability === "demo" ? "Demo endpoint" : "Active"}
                  {e.verificationStatus === "verified" ? " · verified device" : ""}
                  {" · "}{e.capabilities.slice(0, 3).join(", ")}
                  {e.capabilities.length > 3 ? ` +${e.capabilities.length - 3}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Last active {formatTs(e.lastActiveAt)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!e.isPrimary && e.status === "active" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => act(() => setPrimaryEndpoint(e.id).then(() => undefined), `${e.name} is now your primary endpoint.`)}
                    >
                      Set primary
                    </Button>
                  ) : null}
                  {e.status === "active" || e.status === "suspended" ? (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRevokeTarget(e)}>
                      Revoke
                    </Button>
                  ) : null}
                  {e.status === "revoked" ? <span className="text-xs text-muted-foreground">Revoked — connect again to restore</span> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Registration */}
      <Card>
        <CardHeader><CardTitle>Connect an endpoint</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {REGISTRABLE_ENDPOINTS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setNewType(t)}
                aria-pressed={newType === t}
                className={
                  newType === t
                    ? "rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-sm text-primary"
                    : "rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                }
              >
                {ENDPOINT_TYPE_LABELS[t]}
                {ENDPOINT_TYPE_AVAILABILITY[t] === "demo" ? " (demo)" : ""}
              </button>
            ))}
          </div>
          <label className="block max-w-sm text-sm text-foreground">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Endpoint name</span>
            <Input placeholder={`e.g. My ${ENDPOINT_TYPE_LABELS[newType]}`} value={newName} onChange={(e2) => setNewName(e2.target.value)} maxLength={60} />
          </label>
          <Button
            disabled={busy || !newName.trim()}
            onClick={() =>
              act(async () => {
                await registerEndpoint({ type: newType, name: newName.trim() });
                setNewName("");
              }, `Connected to ${number.displayNumber}. Demo endpoint — no real telecom connectivity.`)
            }
          >
            Connect endpoint
          </Button>
          <p className="text-xs text-muted-foreground">
            You&apos;re connecting this endpoint to {number.displayNumber}. Demo endpoints are
            simulated — no PSTN, carrier or TauCore connection is established.
          </p>
        </CardContent>
      </Card>

      {/* Routing simulation */}
      <Card>
        <CardHeader><CardTitle>Routing simulation (demo)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Deterministic application-level routing: primary endpoint → fallback → voicemail. No
            PSTN involved.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => act(async () => setRoutingDecision((await simulateRouting("call")).decision), "Routing simulated.")}
            >
              Simulate inbound demo call
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => act(async () => setRoutingDecision((await simulateRouting("message")).decision), "Routing simulated.")}
            >
              Simulate inbound demo message
            </Button>
          </div>
          {routingDecision ? (
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="text-foreground">{routingDecision.reason}</p>
              {routingDecision.evaluated.length > 0 ? (
                <ol className="mt-2 list-inside list-decimal text-xs text-muted-foreground">
                  {routingDecision.evaluated.map((c) => (
                    <li key={c.endpointId}>{c.name} ({c.type.replaceAll("_", " ")})</li>
                  ))}
                </ol>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">Terminal fallback: voicemail — always.</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
