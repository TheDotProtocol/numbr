"use client";

// =============================================================================
// /app/account/sessions — active session management.
// The current session is resolved SERVER-side; revocation is owner-checked
// server-side. Location is shown honestly ("Location unavailable").
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/app/AuthGuard";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/toast";
import {
  fetchSessions,
  revokeSession,
  revokeOtherSessions,
  revokeAllSessions,
} from "@/services/accountService";
import type { SessionView } from "@/types/account";
import { MonitorSmartphone, LogOut } from "lucide-react";

export default function SessionsPage() {
  return (
    <AuthGuard>
      <SessionsInner />
    </AuthGuard>
  );
}

function SessionsInner() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await fetchSessions();
      setSessions(d.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions.");
      setSessions((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(sessionId: string) {
    setBusy(sessionId);
    try {
      await revokeSession(sessionId);
      showToast("Session revoked.");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Revoke failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function revokeOthers() {
    setBusy("others");
    try {
      const n = await revokeOtherSessions();
      showToast(n === 0 ? "No other active sessions." : `Signed out ${n} other ${n === 1 ? "session" : "sessions"}.`);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Sign-out failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function revokeEverything() {
    setBusy("all");
    try {
      await revokeAllSessions();
      showToast("Signed out everywhere. Redirecting…");
      setTimeout(() => {
        window.location.href = "/login";
      }, 800);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Sign-out failed.", "error");
      setBusy(null);
    }
  }

  if (error) return <EmptyState title="Couldn't load sessions" description={error} />;
  if (sessions === null) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading sessions…" />
        </CardContent>
      </Card>
    );
  }

  const others = sessions.filter((s) => !s.currentSession);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {sessions.length} active {sessions.length === 1 ? "session" : "sessions"}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void revokeOthers()}
            loading={busy === "others"}
            disabled={others.length === 0}
          >
            Sign out other sessions
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmAll(true)}>
            Sign out everywhere
          </Button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={<MonitorSmartphone className="h-5 w-5" />}
          title="No active sessions"
          description="Sessions appear here as you sign in on devices."
        />
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card key={s.id} className={s.currentSession ? "border-primary/40" : undefined}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{s.deviceDescription}</p>
                    {s.currentSession ? <Badge tone="success">This session</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.location} · last active{" "}
                    {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : "—"} · started{" "}
                    {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}
                  </p>
                </div>
                {!s.currentSession ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busy === s.id}
                    onClick={() => void revoke(s.id)}
                  >
                    <LogOut className="mr-1 inline h-3.5 w-3.5" /> Revoke
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={confirmAll}
        onClose={() => (busy === "all" ? undefined : setConfirmAll(false))}
        title="Sign out everywhere?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmAll(false)} disabled={busy === "all"}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void revokeEverything()} loading={busy === "all"}>
              Sign out all sessions
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          You will be signed out on every device, including this one. In-progress checkouts will
          not be lost, but you&apos;ll need to sign in again to continue.
        </p>
      </Modal>
    </>
  );
}
