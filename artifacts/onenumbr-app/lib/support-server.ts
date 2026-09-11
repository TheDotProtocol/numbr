// =============================================================================
// OneNumbr — Support engine (server-side; Admin SDK; Prompt 7)
//
// Tickets, conversations, internal notes and assignment.
//
// Internal-note isolation (defense in depth):
//   1. Notes live in support_tickets/{id}/internal_notes — a subcollection the
//      customer-facing API never reads.
//   2. Firestore rules deny the client entirely for both subcollections; all
//      reads/writes go through this module.
//   3. Ticket numbering follows the billing engine's counter pattern
//      (SUP-YYYY-######, allocated in a transaction — never the doc id).
//
// All state transitions live here; clients only send identifiers and text.
// =============================================================================

import { getAdminDb, getAdminApp } from "@/firebase/admin";
import { getStorage } from "firebase-admin/storage";
import { appError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit-server";
import { createNotification } from "@/lib/kyc-server";
import type {
  RelatedEntityType,
  SupportAttachmentMeta,
  SupportMessageRecord,
  SupportNoteRecord,
  SupportTicketDetail,
  SupportTicketView,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/types/support";

const OPEN_STATUSES: TicketStatus[] = ["open", "in_progress", "waiting_for_customer", "waiting_for_provider"];
export const TERMINAL_STATUSES: TicketStatus[] = ["resolved", "closed"];

function toMillis(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toMillis" in v) return (v as { toMillis(): number }).toMillis();
  return 0;
}

function mapTicket(id: string, d: FirebaseFirestore.DocumentData): SupportTicketView {
  return {
    id,
    ticketNumber: String(d.ticketNumber ?? ""),
    uid: String(d.uid ?? ""),
    category: d.category as TicketCategory,
    subject: String(d.subject ?? ""),
    status: d.status as TicketStatus,
    priority: d.priority as TicketPriority,
    source: (d.source as SupportTicketView["source"]) ?? "customer",
    relatedEntityType: (d.relatedEntityType as RelatedEntityType) ?? "none",
    relatedEntityId: d.relatedEntityId ? String(d.relatedEntityId) : null,
    assignedTo: d.assignedTo ? String(d.assignedTo) : null,
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
    lastMessageAt: d.lastMessageAt ? toMillis(d.lastMessageAt) : null,
    resolvedAt: d.resolvedAt ? toMillis(d.resolvedAt) : null,
    closedAt: d.closedAt ? toMillis(d.closedAt) : null,
  };
}

// ---------------------------------------------------------------------------
// Attachments — private Storage, server-validated
// ---------------------------------------------------------------------------

const SUPPORT_MAX_BYTES = 10 * 1024 * 1024;
const SUPPORT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/pdf": "pdf",
};

/** Store an attachment in the caller's private support/{uid}/ scope. */
export async function saveSupportAttachment(
  uid: string,
  file: File,
): Promise<SupportAttachmentMeta> {
  const ext = SUPPORT_TYPES[file.type];
  if (!ext) throw appError("invalid-data", "Only PNG, JPEG or PDF files are supported.");
  if (file.size > SUPPORT_MAX_BYTES) throw appError("invalid-data", "Files can be at most 10 MB.");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "attachment";
  const path = `support/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const bucket = getStorage(getAdminApp()).bucket();
  await bucket.file(path).save(buffer, {
    contentType: file.type,
    resumable: false,
  });

  await writeAuditLog({
    actorUid: uid,
    action: "support.attachment_uploaded",
    targetUid: uid,
    metadata: { path, size: file.size, contentType: file.type },
  });

  return { path, name: file.name, size: file.size, contentType: file.type };
}

/**
 * Defense-in-depth check for customer-supplied attachment metadata: every
 * path must live inside the caller's private scope and exist in Storage.
 */
export async function validateAttachmentPaths(
  uid: string,
  attachments: SupportAttachmentMeta[],
): Promise<void> {
  if (attachments.length === 0) return;
  const bucket = getStorage(getAdminApp()).bucket();
  await Promise.all(
    attachments.map(async (a) => {
      if (!a.path.startsWith(`support/${uid}/`)) {
        throw appError("permission-denied", "attachment does not belong to this account");
      }
      const [exists] = await bucket.file(a.path).exists();
      if (!exists) throw appError("not-found", "attachment missing in storage");
    }),
  );
}

/**
 * Short-lived signed URL for viewing an attachment. Used by owner-checked
 * routes only (customer own files, staff via the ticket API) — never a
 * public link.
 */
export async function getAttachmentUrl(
  requesterUid: string,
  path: string,
  opts: { staff?: boolean } = {},
): Promise<string> {
  const ownerUid = path.split("/")[1];
  // Staff (verified by the calling admin route) may view any customer
  // attachment; customers only their own scope.
  const allowed = opts.staff ? Boolean(ownerUid) : path.startsWith(`support/${requesterUid}/`);
  if (!allowed) throw appError("permission-denied", "not your attachment");
  const bucket = getStorage(getAdminApp()).bucket();
  const file = bucket.file(path);
  const [exists] = await file.exists();
  if (!exists) throw appError("not-found", "attachment missing in storage");
  const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 10 * 60 * 1000 });
  return url;
}

// ---------------------------------------------------------------------------
// Ticket numbering (billing_counters pattern: transaction-allocated sequence)
// ---------------------------------------------------------------------------

export async function nextTicketNumber(): Promise<string> {
  const db = getAdminDb();
  const year = new Date().getUTCFullYear();
  const ref = db.collection("support_counters").doc(`ticket-${year}`);
  let ticketNumber = "";
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number | undefined) ?? 0) + 1;
    tx.set(ref, { value: next, updatedAt: new Date() }, { merge: true });
    ticketNumber = `SUP-${year}-${String(next).padStart(6, "0")}`;
  });
  return ticketNumber;
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

async function getOwnedTicket(uid: string, ticketId: string): Promise<SupportTicketView> {
  const snap = await getAdminDb().collection("support_tickets").doc(ticketId).get();
  if (!snap.exists) throw appError("not-found", "ticket not found");
  const view = mapTicket(snap.id, snap.data() ?? {});
  if (view.uid !== uid) throw appError("permission-denied", "not your ticket");
  return view;
}

// ---------------------------------------------------------------------------
// Customer operations
// ---------------------------------------------------------------------------

export async function createTicket(input: {
  uid: string;
  category: TicketCategory;
  subject: string;
  description: string;
  relatedEntityType?: RelatedEntityType;
  relatedEntityId?: string | null;
  source?: SupportTicketView["source"];
}): Promise<SupportTicketView> {
  const db = getAdminDb();
  const now = new Date();
  const ticketNumber = await nextTicketNumber();

  const ref = db.collection("support_tickets").doc();
  const doc = {
    ticketNumber,
    uid: input.uid,
    category: input.category,
    subject: input.subject,
    description: input.description,
    status: "open" as TicketStatus,
    priority: "normal" as TicketPriority,
    source: input.source ?? "customer",
    relatedEntityType: input.relatedEntityType ?? "none",
    relatedEntityId: input.relatedEntityId ?? null,
    assignedTo: null,
    assignedAt: null,
    assignedBy: null,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    resolvedAt: null,
    closedAt: null,
  };
  await ref.set(doc);

  await ref.collection("messages").add({
    ticketId: ref.id,
    senderType: input.source === "admin" ? "agent" : "customer",
    senderUid: input.uid,
    senderName: "Customer", // customer-facing views resolve names client-side; agents see the account
    message: input.description,
    attachments: [],
    createdAt: now,
  });

  await writeAuditLog({
    actorUid: input.uid,
    action: "support.ticket_created",
    targetUid: input.uid,
    metadata: { ticketId: ref.id, ticketNumber, category: input.category },
  });
  await createNotification({
    uid: input.uid,
    kind: "support.ticket_created",
    title: "Support case received",
    message: `Your case ${ticketNumber} has been received. Our team will reply as soon as possible.`,
  });

  return mapTicket(ref.id, doc);
}

export async function listCustomerTickets(uid: string, limit = 50): Promise<SupportTicketView[]> {
  const snap = await getAdminDb()
    .collection("support_tickets")
    .where("uid", "==", uid)
    .orderBy("lastMessageAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => mapTicket(d.id, d.data()));
}

export async function getTicketForCustomer(uid: string, ticketId: string): Promise<SupportTicketDetail> {
  const view = await getOwnedTicket(uid, ticketId);
  const db = getAdminDb();

  // Customer-visible messages only — internal_notes subcollection is never touched here.
  const msgSnap = await db
    .collection("support_tickets")
    .doc(ticketId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .limit(200)
    .get();

  const messages: SupportMessageRecord[] = msgSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ticketId,
      senderType: (data.senderType as "customer" | "agent") ?? "customer",
      senderUid: String(data.senderUid ?? ""),
      senderName: String(data.senderName ?? ""),
      message: String(data.message ?? ""),
      attachments: (data.attachments as SupportAttachmentMeta[] | undefined) ?? [],
      createdAt: toMillis(data.createdAt),
    };
  });

  return { ...view, description: messages[0]?.message ?? "", messages };
}

export async function addCustomerMessage(input: {
  uid: string;
  ticketId: string;
  message: string;
  attachments?: SupportAttachmentMeta[];
}): Promise<SupportMessageRecord> {
  const view = await getOwnedTicket(input.uid, input.ticketId);
  if (TERMINAL_STATUSES.includes(view.status)) {
    throw appError("invalid-data", "this case is closed — reopen it to reply");
  }
  const db = getAdminDb();
  const now = new Date();
  const msgRef = db.collection("support_tickets").doc(input.ticketId).collection("messages").doc();
  const record: SupportMessageRecord = {
    id: msgRef.id,
    ticketId: input.ticketId,
    senderType: "customer",
    senderUid: input.uid,
    senderName: "Customer",
    message: input.message,
    attachments: input.attachments ?? [],
    createdAt: now.getTime(),
  };
  await msgRef.set({
    ...record,
    createdAt: now,
  });

  // Reopening semantics: a customer reply on waiting_for_customer moves the
  // case back to in_progress (server-side, deterministic).
  const patch: Partial<{ status: TicketStatus; lastMessageAt: Date; updatedAt: Date }> = {
    lastMessageAt: now,
    updatedAt: now,
  };
  if (view.status === "waiting_for_customer") patch.status = "in_progress";
  await db.collection("support_tickets").doc(input.ticketId).update(patch);

  await writeAuditLog({
    actorUid: input.uid,
    action: "support.customer_replied",
    targetUid: input.uid,
    metadata: { ticketId: input.ticketId, ticketNumber: view.ticketNumber },
  });
  return record;
}

export async function customerSetStatus(input: {
  uid: string;
  ticketId: string;
  action: "close" | "reopen";
}): Promise<SupportTicketView> {
  const view = await getOwnedTicket(input.uid, input.ticketId);
  const db = getAdminDb();
  const now = new Date();
  let next: TicketStatus;

  if (input.action === "close") {
    if (!TERMINAL_STATUSES.includes(view.status)) {
      throw appError("invalid-data", "only resolved cases can be closed");
    }
    next = "closed";
  } else {
    if (view.status !== "closed") {
      throw appError("invalid-data", "only closed cases can be reopened");
    }
    next = "open";
  }

  await db
    .collection("support_tickets")
    .doc(input.ticketId)
    .update({
      status: next,
      updatedAt: now,
      lastMessageAt: now,
      ...(next === "closed" ? { closedAt: now } : { closedAt: null }),
      ...(next === "open" ? { resolvedAt: null } : {}),
    });

  await writeAuditLog({
    actorUid: input.uid,
    action: next === "closed" ? "support.customer_closed" : "support.customer_reopened",
    targetUid: input.uid,
    metadata: { ticketId: input.ticketId, ticketNumber: view.ticketNumber },
  });
  if (next === "open") {
    await createNotification({
      uid: input.uid,
      kind: "support.ticket_reopened",
      title: "Case reopened",
      message: `Case ${view.ticketNumber} has been reopened and is back with our team.`,
    });
  }
  return { ...view, status: next };
}

// ---------------------------------------------------------------------------
// Admin / staff operations
// ---------------------------------------------------------------------------

export type AdminTicketFilter = {
  status?: TicketStatus | "all" | "open_work";
  category?: TicketCategory | "all";
  priority?: TicketPriority | "all";
  assignedTo?: string | "unassigned" | "all";
  search?: string;
  page: number;
  pageSize: number;
};

export type AdminTicketListResult = {
  tickets: (SupportTicketView & { customerEmail: string })[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

export async function listAdminTickets(filter: AdminTicketFilter): Promise<AdminTicketListResult> {
  const db = getAdminDb();
  let query = db.collection("support_tickets").orderBy("lastMessageAt", "desc") as FirebaseFirestore.Query;

  if (filter.status && filter.status !== "all") {
    if (filter.status === "open_work") {
      // Bounded multi-status window via in-query (max 10 statuses — we use 4).
      query = query.where("status", "in", OPEN_STATUSES);
    } else {
      query = query.where("status", "==", filter.status);
    }
  }
  if (filter.category && filter.category !== "all") query = query.where("category", "==", filter.category);
  if (filter.priority && filter.priority !== "all") query = query.where("priority", "==", filter.priority);
  if (filter.assignedTo && filter.assignedTo !== "all") {
    query = query.where("assignedTo", "==", filter.assignedTo === "unassigned" ? null : filter.assignedTo);
  }

  // Bounded count: read only ids up to a sane ceiling for pagination maths.
  const countSnap = await query.limit(1000).get();
  const total = countSnap.size;

  const pageSnap = await query.offset((filter.page - 1) * filter.pageSize).limit(filter.pageSize).get();

  // Resolve customer emails with per-doc lookups (bounded to page size).
  const userIds = [...new Set(pageSnap.docs.map((d) => String(d.data().uid ?? "")))];
  const emailByUid = new Map<string, string>();
  await Promise.all(
    userIds.map(async (uid) => {
      const u = await db.collection("users").doc(uid).get();
      emailByUid.set(uid, String(u.data()?.email ?? uid));
    }),
  );

  // Optional server-side search over the current page results (subject/ticketNumber).
  let tickets = pageSnap.docs.map((d) => ({
    ...mapTicket(d.id, d.data()),
    customerEmail: emailByUid.get(String(d.data().uid ?? "")) ?? "",
  }));
  const q = filter.search?.trim().toLowerCase();
  if (q) {
    tickets = tickets.filter(
      (t) => t.subject.toLowerCase().includes(q) || t.ticketNumber.toLowerCase().includes(q),
    );
  }

  return {
    tickets,
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    pages: Math.max(1, Math.ceil(total / filter.pageSize)),
  };
}

export async function getTicketForAdmin(ticketId: string): Promise<
  SupportTicketDetail & { customerEmail: string; notes: SupportNoteRecord[] }
> {
  const db = getAdminDb();
  const snap = await db.collection("support_tickets").doc(ticketId).get();
  if (!snap.exists) throw appError("not-found", "ticket not found");
  const view = mapTicket(snap.id, snap.data() ?? {});

  const [msgSnap, noteSnap, userSnap] = await Promise.all([
    db.collection("support_tickets").doc(ticketId).collection("messages").orderBy("createdAt", "asc").limit(200).get(),
    db.collection("support_tickets").doc(ticketId).collection("internal_notes").orderBy("createdAt", "asc").limit(200).get(),
    db.collection("users").doc(view.uid).get(),
  ]);

  const messages: SupportMessageRecord[] = msgSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ticketId,
      senderType: (data.senderType as "customer" | "agent") ?? "customer",
      senderUid: String(data.senderUid ?? ""),
      senderName: String(data.senderName ?? ""),
      message: String(data.message ?? ""),
      attachments: (data.attachments as SupportAttachmentMeta[] | undefined) ?? [],
      createdAt: toMillis(data.createdAt),
    };
  });

  const notes: SupportNoteRecord[] = noteSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ticketId,
      authorUid: String(data.authorUid ?? ""),
      authorName: String(data.authorName ?? ""),
      message: String(data.message ?? ""),
      createdAt: toMillis(data.createdAt),
    };
  });

  return {
    ...view,
    description: messages[0]?.message ?? "",
    messages,
    notes,
    customerEmail: String(userSnap.data()?.email ?? view.uid),
  };
}

export async function addAgentReply(input: {
  actorUid: string;
  actorName: string;
  ticketId: string;
  message: string;
  attachments?: SupportAttachmentMeta[];
  setWaitingForCustomer?: boolean;
}): Promise<SupportMessageRecord> {
  const db = getAdminDb();
  const snap = await db.collection("support_tickets").doc(input.ticketId).get();
  if (!snap.exists) throw appError("not-found", "ticket not found");
  const view = mapTicket(snap.id, snap.data() ?? {});
  const now = new Date();

  const msgRef = db.collection("support_tickets").doc(input.ticketId).collection("messages").doc();
  const record: SupportMessageRecord = {
    id: msgRef.id,
    ticketId: input.ticketId,
    senderType: "agent",
    senderUid: input.actorUid,
    senderName: input.actorName,
    message: input.message,
    attachments: input.attachments ?? [],
    createdAt: now.getTime(),
  };
  await msgRef.set({ ...record, createdAt: now });

  const patch: Partial<{ status: TicketStatus; lastMessageAt: Date; updatedAt: Date }> = {
    lastMessageAt: now,
    updatedAt: now,
  };
  // Deterministic status flow: replying moves open work forward; an explicit
  // flag hands the conversation back to the customer.
  if (view.status === "open") patch.status = input.setWaitingForCustomer ? "waiting_for_customer" : "in_progress";
  else if (view.status === "in_progress" && input.setWaitingForCustomer) patch.status = "waiting_for_customer";
  else if (TERMINAL_STATUSES.includes(view.status)) patch.status = input.setWaitingForCustomer ? "waiting_for_customer" : "in_progress";
  await db.collection("support_tickets").doc(input.ticketId).update(patch);

  await writeAuditLog({
    actorUid: input.actorUid,
    action: "support.agent_replied",
    targetUid: view.uid,
    metadata: { ticketId: input.ticketId, ticketNumber: view.ticketNumber },
  });
  await createNotification({
    uid: view.uid,
    kind: "support.agent_replied",
    title: "New reply from support",
    message: `Our team replied to case ${view.ticketNumber}: "${input.message.slice(0, 120)}${input.message.length > 120 ? "…" : ""}"`,
  });
  return record;
}

export async function addInternalNote(input: {
  actorUid: string;
  actorName: string;
  ticketId: string;
  message: string;
}): Promise<SupportNoteRecord> {
  const db = getAdminDb();
  const ticketSnap = await db.collection("support_tickets").doc(input.ticketId).get();
  if (!ticketSnap.exists) throw appError("not-found", "ticket not found");
  const now = new Date();

  const noteRef = db.collection("support_tickets").doc(input.ticketId).collection("internal_notes").doc();
  const record: SupportNoteRecord = {
    id: noteRef.id,
    ticketId: input.ticketId,
    authorUid: input.actorUid,
    authorName: input.actorName,
    message: input.message,
    createdAt: now.getTime(),
  };
  await noteRef.set({ ...record, createdAt: now });
  await db.collection("support_tickets").doc(input.ticketId).update({ updatedAt: now });

  await writeAuditLog({
    actorUid: input.actorUid,
    action: "support.internal_note_added",
    targetUid: String(ticketSnap.data()?.uid ?? ""),
    metadata: { ticketId: input.ticketId, ticketNumber: ticketSnap.data()?.ticketNumber },
  });
  return record;
}

export async function assignTicket(input: {
  actorUid: string;
  ticketId: string;
  assignedTo: string | null;
}): Promise<SupportTicketView> {
  const db = getAdminDb();
  const snap = await db.collection("support_tickets").doc(input.ticketId).get();
  if (!snap.exists) throw appError("not-found", "ticket not found");
  const view = mapTicket(snap.id, snap.data() ?? {});
  const now = new Date();
  const was = view.assignedTo;

  await db
    .collection("support_tickets")
    .doc(input.ticketId)
    .update({
      assignedTo: input.assignedTo,
      assignedAt: input.assignedTo ? now : null,
      assignedBy: input.assignedTo ? input.actorUid : null,
      updatedAt: now,
    });

  const reassigned = was !== null && input.assignedTo !== null && was !== input.assignedTo;
  await writeAuditLog({
    actorUid: input.actorUid,
    action: reassigned
      ? "support.ticket_reassigned"
      : input.assignedTo
        ? "support.ticket_assigned"
        : "support.ticket_unassigned",
    targetUid: view.uid,
    metadata: { ticketId: input.ticketId, ticketNumber: view.ticketNumber, from: was, to: input.assignedTo },
  });
  return { ...view, assignedTo: input.assignedTo };
}

export async function adminSetTicketStatus(input: {
  actorUid: string;
  ticketId: string;
  status: TicketStatus;
}): Promise<SupportTicketView> {
  const db = getAdminDb();
  const snap = await db.collection("support_tickets").doc(input.ticketId).get();
  if (!snap.exists) throw appError("not-found", "ticket not found");
  const view = mapTicket(snap.id, snap.data() ?? {});
  const now = new Date();

  await db
    .collection("support_tickets")
    .doc(input.ticketId)
    .update({
      status: input.status,
      updatedAt: now,
      lastMessageAt: now,
      resolvedAt: input.status === "resolved" ? now : input.status === "closed" ? view.resolvedAt : null,
      closedAt: input.status === "closed" ? now : null,
    });

  await writeAuditLog({
    actorUid: input.actorUid,
    action: input.status === "resolved" ? "support.ticket_resolved" : "support.ticket_status_changed",
    targetUid: view.uid,
    metadata: { ticketId: input.ticketId, ticketNumber: view.ticketNumber, from: view.status, to: input.status },
  });
  if (input.status === "resolved") {
    await createNotification({
      uid: view.uid,
      kind: "support.ticket_resolved",
      title: "Case resolved",
      message: `Case ${view.ticketNumber} has been marked resolved. If you still need help, just reopen it.`,
    });
  } else {
    await createNotification({
      uid: view.uid,
      kind: "support.status_changed",
      title: "Case updated",
      message: `Case ${view.ticketNumber} status is now "${input.status.replaceAll("_", " ")}".`,
    });
  }
  return { ...view, status: input.status };
}

export async function adminSetTicketPriority(input: {
  actorUid: string;
  ticketId: string;
  priority: TicketPriority;
}): Promise<SupportTicketView> {
  const db = getAdminDb();
  const snap = await db.collection("support_tickets").doc(input.ticketId).get();
  if (!snap.exists) throw appError("not-found", "ticket not found");
  const view = mapTicket(snap.id, snap.data() ?? {});
  const now = new Date();

  await db.collection("support_tickets").doc(input.ticketId).update({
    priority: input.priority,
    updatedAt: now,
  });
  await writeAuditLog({
    actorUid: input.actorUid,
    action: "support.ticket_priority_changed",
    targetUid: view.uid,
    metadata: { ticketId: input.ticketId, ticketNumber: view.ticketNumber, from: view.priority, to: input.priority },
  });
  return { ...view, priority: input.priority };
}

/** Count of genuinely open (non-terminal) tickets — used by ops snapshot. */
export async function countOpenTickets(): Promise<number> {
  const snap = await getAdminDb()
    .collection("support_tickets")
    .where("status", "in", OPEN_STATUSES)
    .limit(500)
    .get();
  return snap.size;
}
