"use client";

// =============================================================================
// /admin/support — Support Center (admin + support roles)
//
// Queue:  status/category/priority/assignment filters, search, pagination.
// Detail: conversation, internal notes (never customer-visible), assignment,
//         status/priority transitions — every action via the staff API.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { StaffGuard } from "@/components/admin/StaffGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/toast";
import {
  adminAddNote,
  adminAssign,
  adminReply,
  adminSetPriority,
  adminSetStatus,
  getAdminTicket,
  listAdminTickets,
  type AdminTicketDetail,
  type AdminTicketList,
  type AdminTicketRow,
} from "@/services/supportService";
import { TICKET_CATEGORY_OPTIONS } from "@/types/support";
import { statusLabel as statusLabelLib, statusTone as statusToneLib } from "@/lib/status";

const STATUS_FILTERS = [
  { value: "open_work", label: "Open work" },
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_for_customer", label: "Waiting for customer" },
  { value: "waiting_for_provider", label: "Waiting for provider" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "gold"> = {
  low: "neutral",
  normal: "neutral",
  high: "warning",
  urgent: "danger",
};

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" | "gold" | "info" {
  return statusToneLib(status);
}

export default function AdminSupportPage() {
  return (
    <StaffGuard>
      <Queue />
    </StaffGuard>
  );
}

type Row = AdminTicketRow;

function Queue() {
  const params = useParams<{ ticketId?: string }>();
  return params?.ticketId ? <TicketDetail /> : <QueueTable />;
}

function QueueTable() {
  const { showToast } = useToast();
  const [status, setStatus] = useState("open_work");
  const [category, setCategory] = useState("all");
  const [priority, setPriority] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminTicketList | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(
        await listAdminTickets({ status, category, priority, search, page, pageSize: 20 }),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the queue.");
    }
  }, [status, category, priority, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Category</span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
          >
            <option value="all">All</option>
            {TICKET_CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Priority</span>
          <select
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>
        <div className="min-w-56 flex-1">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search subject or ticket number…"
            type="search"
          />
        </div>
      </div>

      {error ? (
        <EmptyState title="Couldn't load the queue" description={error} />
      ) : data === null ? (
        <LoadingState label="Loading queue…" />
      ) : data.tickets.length === 0 ? (
        <EmptyState title="No cases match" description="Try clearing filters or widening the status selection." />
      ) : (
        <>
          <div className="space-y-2">
            {data.tickets.map((t: Row) => (
              <Link key={t.id} href={`/admin/support/${t.id}`} className="block">
                <Card className="transition-colors hover:bg-muted/30">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{t.ticketNumber}</span>
                        <Badge tone={statusTone(t.status)}>{statusLabelLib(t.status)}</Badge>
                        {t.priority !== "normal" && <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>}
                        {t.assignedTo ? (
                          <span className="text-xs text-muted-foreground">→ {t.assignedTo}</span>
                        ) : (
                          <Badge tone="gold">Unassigned</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate font-medium">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.customerEmail} · updated {new Date(t.lastMessageAt ?? t.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {data.page} of {data.pages} · {data.total} case{data.total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="secondary" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const [ticket, setTicket] = useState<AdminTicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [waitReply, setWaitReply] = useState(true);
  const [note, setNote] = useState("");
  const [assignTarget, setAssignTarget] = useState<string>("");
  const [showAssign, setShowAssign] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setTicket(await getAdminTicket(ticketId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the case.");
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      showToast(ok, "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <EmptyState
        title="Case unavailable"
        description={error}
        action={
          <Button variant="secondary" onClick={() => router.push("/admin/support")}>
            Back to queue
          </Button>
        }
      />
    );
  }
  if (!ticket) return <LoadingState label="Loading case…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{ticket.subject}</h1>
          <p className="text-sm text-muted-foreground">
            {ticket.ticketNumber} · {ticket.customerEmail} ·{" "}
            <Link href={`/admin/users/${ticket.uid}`} className="text-primary hover:underline">
              Customer 360 →
            </Link>
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push("/admin/support")}>
          Back to queue
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(ticket.status)}>{statusLabelLib(ticket.status)}</Badge>
        <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>
        <span className="text-xs text-muted-foreground">
          {TICKET_CATEGORY_OPTIONS.find((c) => c.value === ticket.category)?.label ?? ticket.category} ·{" "}
          {ticket.assignedTo ? `assigned to ${ticket.assignedTo}` : "unassigned"}
        </span>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <select
            value={ticket.status}
            onChange={(e) => act(() => adminSetStatus(ticket.id, e.target.value), "Status updated.")}
            className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
            aria-label="Change status"
          >
            {STATUS_FILTERS.filter((f) => f.value !== "open_work" && f.value !== "all").map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={ticket.priority}
            onChange={(e) => act(() => adminSetPriority(ticket.id, e.target.value), "Priority updated.")}
            className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
            aria-label="Change priority"
          >
            {["urgent", "high", "normal", "low"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => setShowAssign(true)}>
            {ticket.assignedTo ? "Reassign" : "Assign"}
          </Button>
          {ticket.assignedTo && (
            <Button variant="ghost" onClick={() => act(() => adminAssign(ticket.id, null), "Unassigned.")}>
              Unassign
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Conversation */}
      <div className="space-y-2">
        {ticket.messages.map((m) => (
          <Card key={m.id} className={m.senderType === "agent" ? "border-primary/30" : undefined}>
            <CardContent className="py-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">
                  {m.senderType === "agent" ? `Agent · ${m.senderName}` : `Customer · ${ticket.customerEmail}`}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{m.message}</p>
              {m.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.attachments.map((a) => (
                    <span key={a.path} className="rounded-md border border-border px-2 py-1 text-xs">
                      📎 {a.name}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reply */}
      <Card>
        <CardContent className="py-4">
          <label htmlFor="agent-reply" className="mb-2 block text-sm font-medium">
            Reply to customer
          </label>
          <textarea
            id="agent-reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            maxLength={5000}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button loading={busy} disabled={!reply.trim()} onClick={() => act(() => adminReply(ticket.id, reply, waitReply), "Reply sent.").then(() => setReply(""))}>
              Send
            </Button>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={waitReply} onChange={(e) => setWaitReply(e.target.checked)} />
              set to “waiting for customer”
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Internal notes */}
      <Card>
        <CardHeader>
          <CardTitle>Internal notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Notes are visible to staff only — customers can never read them (blocked at the API and database layers).
          </p>
          {ticket.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No internal notes yet.</p>
          ) : (
            ticket.notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{n.authorName}</span>
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{n.message}</p>
              </div>
            ))
          )}
          <div className="flex gap-2 pt-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note…" maxLength={5000} />
            <Button
              variant="secondary"
              loading={busy}
              disabled={!note.trim()}
              onClick={() => act(() => adminAddNote(ticket.id, note), "Note added.").then(() => setNote(""))}
            >
              Add note
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Assign modal */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assign case" size="sm">
        <p className="mb-3 text-sm text-muted-foreground">
          Enter the staff member's email or uid. The admin identity performing the assignment is verified server-side.
        </p>
        <Input value={assignTarget} onChange={(e) => setAssignTarget(e.target.value)} placeholder="agent@example.com" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowAssign(false)}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={!assignTarget.trim()}
            onClick={() =>
              act(() => adminAssign(ticket.id, assignTarget.trim()), "Case assigned.").then(() => {
                setShowAssign(false);
                setAssignTarget("");
              })
            }
          >
            Assign
          </Button>
        </div>
      </Modal>
    </div>
  );
}
