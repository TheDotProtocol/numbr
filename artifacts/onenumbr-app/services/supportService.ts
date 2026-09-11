// =============================================================================
// OneNumbr — Support client service (Prompt 7)
//
// Thin browser-side wrapper around the support APIs. Financial/ownership
// values are never sent or trusted here; the server derives everything.
// =============================================================================

import { toAppError } from "@/lib/errors";
import type {
  SupportAttachmentMeta,
  SupportMessageRecord,
  SupportTicketDetail,
  SupportTicketView,
  TicketCategory,
} from "@/types/support";

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw body?.message ? new Error(body.message) : toAppError(new Error(`Request failed (${res.status})`));
  }
  return (await res.json()) as T;
}

export async function listMyTickets(): Promise<SupportTicketView[]> {
  const res = await fetch("/api/support");
  return (await parse<{ tickets: SupportTicketView[] }>(res)).tickets;
}

export async function createTicket(input: {
  category: TicketCategory;
  subject: string;
  description: string;
  relatedEntityType?: SupportTicketView["relatedEntityType"];
  relatedEntityId?: string | null;
}): Promise<SupportTicketView> {
  const res = await fetch("/api/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await parse<{ ticket: SupportTicketView }>(res)).ticket;
}

export async function getTicket(ticketId: string): Promise<SupportTicketDetail> {
  const res = await fetch(`/api/support/${ticketId}`);
  return (await parse<{ ticket: SupportTicketDetail }>(res)).ticket;
}

export async function replyToTicket(
  ticketId: string,
  message: string,
  attachments: SupportAttachmentMeta[] = [],
): Promise<SupportMessageRecord> {
  const res = await fetch(`/api/support/${ticketId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, attachments }),
  });
  return (await parse<{ message: SupportMessageRecord }>(res)).message;
}

export async function closeTicket(ticketId: string): Promise<SupportTicketView> {
  const res = await fetch(`/api/support/${ticketId}/close`, { method: "POST" });
  return (await parse<{ ticket: SupportTicketView }>(res)).ticket;
}

export async function reopenTicket(ticketId: string): Promise<SupportTicketView> {
  const res = await fetch(`/api/support/${ticketId}/reopen`, { method: "POST" });
  return (await parse<{ ticket: SupportTicketView }>(res)).ticket;
}

export async function uploadAttachment(file: File): Promise<SupportAttachmentMeta> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/support/attachments", { method: "POST", body: form });
  return parse<SupportAttachmentMeta>(res);
}

/** Resolve a short-lived view URL for an attachment (owner-checked server-side). */
export async function getAttachmentViewUrl(path: string): Promise<string> {
  const res = await fetch(`/api/support/attachments/${path.split("/").map(encodeURIComponent).join("/")}`);
  return (await parse<{ url: string }>(res)).url;
}

// --- admin-side wrappers (staff claims verified server-side) ---

export type AdminTicketRow = SupportTicketView & { customerEmail: string };

export type AdminTicketList = {
  tickets: AdminTicketRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

export async function listAdminTickets(
  params: Record<string, string | number> = {},
): Promise<AdminTicketList> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const res = await fetch(`/api/admin/support?${qs}`);
  return parse<AdminTicketList>(res);
}

export type AdminTicketDetail = SupportTicketDetail & {
  customerEmail: string;
  notes: { id: string; authorName: string; message: string; createdAt: number }[];
};

export async function getAdminTicket(ticketId: string): Promise<AdminTicketDetail> {
  const res = await fetch(`/api/admin/support/${ticketId}`);
  return (await parse<{ ticket: AdminTicketDetail }>(res)).ticket;
}

export async function adminReply(ticketId: string, message: string, setWaitingForCustomer = false): Promise<void> {
  const res = await fetch(`/api/admin/support/${ticketId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, setWaitingForCustomer }),
  });
  await parse<{ ok: true }>(res);
}

export async function adminAddNote(ticketId: string, message: string): Promise<void> {
  const res = await fetch(`/api/admin/support/${ticketId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  await parse<{ ok: true }>(res);
}

export async function adminAssign(ticketId: string, assignedTo: string | null): Promise<void> {
  const res = await fetch(`/api/admin/support/${ticketId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignedTo }),
  });
  await parse<{ ok: true }>(res);
}

export async function adminSetStatus(ticketId: string, status: string): Promise<void> {
  const res = await fetch(`/api/admin/support/${ticketId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  await parse<{ ok: true }>(res);
}

export async function adminSetPriority(ticketId: string, priority: string): Promise<void> {
  const res = await fetch(`/api/admin/support/${ticketId}/priority`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priority }),
  });
  await parse<{ ok: true }>(res);
}
