"use client";

// =============================================================================
// /app/support/[ticketId] — conversation view (customer)
// Replies, attachment upload (private), close/reopen. Internal notes are
// never requested here — the customer API cannot return them.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGuard } from "@/components/app/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/toast";
import {
  closeTicket,
  getAttachmentViewUrl,
  getTicket,
  reopenTicket,
  replyToTicket,
  uploadAttachment,
} from "@/services/supportService";
import { SUPPORT_ACCEPTED_TYPES, SUPPORT_MAX_FILE_BYTES, type SupportTicketDetail } from "@/types/support";
import { StatusBadge } from "@/components/ui/Badge";

export default function TicketDetailPage() {
  const params = useParams<{ ticketId: string }>();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const load = useCallback(async () => {
    try {
      setTicket(await getTicket(params.ticketId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this case.");
    }
  }, [params.ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSend() {
    if (!reply.trim() && pending.length === 0) return;
    setBusy(true);
    try {
      const attachments = [];
      for (const file of pending) attachments.push(await uploadAttachment(file));
      await replyToTicket(params.ticketId, reply.trim() || "(attachment)", attachments);
      setReply("");
      setPending([]);
      showToast("Reply sent.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't send your reply.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handlePickFiles(list: FileList | null) {
    if (!list) return;
    const accepted: File[] = [];
    for (const f of Array.from(list)) {
      if (!SUPPORT_ACCEPTED_TYPES.includes(f.type as (typeof SUPPORT_ACCEPTED_TYPES)[number])) {
        showToast(`${f.name}: only PNG, JPEG or PDF files are supported.`, "error");
        continue;
      }
      if (f.size > SUPPORT_MAX_FILE_BYTES) {
        showToast(`${f.name}: files can be at most 10 MB.`, "error");
        continue;
      }
      accepted.push(f);
    }
    setPending((prev) => [...prev, ...accepted].slice(0, 5));
  }

  async function handleViewAttachment(path: string) {
    try {
      const url = await getAttachmentViewUrl(path);
      window.open(url, "_blank", "noopener");
    } catch {
      showToast("Couldn't open the attachment.", "error");
    }
  }

  if (error) {
    return (
      <AuthGuard>
        <EmptyState
          title="Case unavailable"
          description={error}
          action={
            <Link href="/app/support">
              <Button variant="secondary">Back to support</Button>
            </Link>
          }
        />
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      {ticket === null ? (
        <LoadingState label="Loading case…" />
      ) : (
        <>
          <PageHeader
            title={ticket.subject}
            description={`${ticket.ticketNumber} · ${new Date(ticket.createdAt).toLocaleDateString()}`}
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge status={ticket.status} />
                {ticket.status === "resolved" && (
                  <Button variant="secondary" onClick={() => setConfirmClose(true)}>
                    Close case
                  </Button>
                )}
                {ticket.status === "closed" && (
                  <Button variant="secondary" onClick={() => reopenTicket(params.ticketId).then(load).catch(() => showToast("Couldn't reopen the case.", "error"))}>
                    Reopen case
                  </Button>
                )}
              </div>
            }
          />

          <div className="space-y-4">
            {/* Conversation */}
            <div className="space-y-3">
              {ticket.messages.map((m) => (
                <Card key={m.id} className={m.senderType === "agent" ? "border-primary/30" : undefined}>
                  <CardContent className="py-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {m.senderType === "agent" ? `OneNumbr Support${m.senderName ? ` · ${m.senderName}` : ""}` : "You"}
                      </span>
                      <span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{m.message}</p>
                    {m.attachments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.attachments.map((a) => (
                          <button
                            key={a.path}
                            type="button"
                            onClick={() => handleViewAttachment(a.path)}
                            className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted/40"
                          >
                            📎 {a.name} ({Math.ceil(a.size / 1024)} KB)
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Reply composer */}
            {ticket.status !== "closed" ? (
              <Card>
                <CardContent className="py-4">
                  <label htmlFor="reply" className="mb-2 block text-sm font-medium">
                    Reply
                  </label>
                  <textarea
                    id="reply"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={4}
                    maxLength={5000}
                    placeholder="Write your reply…"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {pending.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {pending.map((f, i) => (
                        <span key={`${f.name}-${i}`} className="rounded-md border border-border px-2 py-1 text-xs">
                          {f.name}
                          <button
                            type="button"
                            className="ml-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))}
                            aria-label={`Remove ${f.name}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button onClick={handleSend} loading={busy} disabled={!reply.trim() && pending.length === 0}>
                      Send reply
                    </Button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept={SUPPORT_ACCEPTED_TYPES.join(",")}
                      multiple
                      className="hidden"
                      onChange={(e) => handlePickFiles(e.target.files)}
                    />
                    <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy || pending.length >= 5}>
                      Attach files
                    </Button>
                    <span className="text-xs text-muted-foreground">PNG, JPEG or PDF · up to 10 MB · 5 files max</span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                title="This case is closed"
                description="If the problem comes back, reopen the case and we'll pick it up where we left off."
              />
            )}
          </div>

          <ConfirmDialog
            open={confirmClose}
            onClose={() => setConfirmClose(false)}
            onConfirm={() =>
              closeTicket(params.ticketId)
                .then(() => {
                  setConfirmClose(false);
                  showToast("Case closed.", "success");
                  return load();
                })
                .catch(() => showToast("Couldn't close the case.", "error"))
            }
            title="Close this case?"
            confirmLabel="Close case"
            cancelLabel="Keep it open"
          >
            Closing tells us everything is resolved. You can reopen a closed case if the issue returns.
          </ConfirmDialog>
        </>
      )}
    </AuthGuard>
  );
}
