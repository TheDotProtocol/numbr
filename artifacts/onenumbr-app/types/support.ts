// =============================================================================
// OneNumbr — Support & Operations types (Prompt 7)
//
// Tickets, conversations, internal notes and the operational alert model.
// All state transitions happen server-side (lib/support-server.ts); clients
// only send identifiers and messages.
// =============================================================================

/** Ticket lifecycle. Client-selectable transitions are server-validated. */
export type TicketStatus =
  | "open"
  | "in_progress"
  | "waiting_for_customer"
  | "waiting_for_provider"
  | "resolved"
  | "closed";

export type TicketPriority = "low" | "normal" | "high" | "urgent";

/** Where the ticket came from. */
export type TicketSource = "customer" | "admin";

/** Categories map onto the actual OneNumbr ecosystem. */
export type TicketCategory =
  | "identity"
  | "number"
  | "esim"
  | "billing"
  | "account"
  | "technical"
  | "other";

export type TicketCategoryLabel =
  | "Identity & Verification"
  | "Number"
  | "eSIM & Connectivity"
  | "Billing & Payments"
  | "Account & Security"
  | "Technical Issue"
  | "Other";

/** What the ticket relates to, when the customer linked a service. */
export type RelatedEntityType = "esim_order" | "esim" | "number_order" | "number" | "payment" | "invoice" | "none";

/** Customer-visible conversation message. */
export type SupportMessageRecord = {
  id: string;
  ticketId: string;
  senderType: "customer" | "agent";
  senderUid: string;
  senderName: string;
  message: string;
  attachments: SupportAttachmentMeta[];
  createdAt: number;
};

/** Internal note — stored in a subcollection the customer can never read. */
export type SupportNoteRecord = {
  id: string;
  ticketId: string;
  authorUid: string;
  authorName: string;
  message: string;
  createdAt: number;
};

/** Attachment metadata (the file itself lives in private Storage). */
export type SupportAttachmentMeta = {
  path: string;
  name: string;
  size: number;
  contentType: string;
};

/** Customer-visible ticket view. */
export type SupportTicketView = {
  id: string;
  ticketNumber: string;
  uid: string;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  source: TicketSource;
  relatedEntityType: RelatedEntityType;
  relatedEntityId: string | null;
  assignedTo: string | null;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number | null;
  resolvedAt: number | null;
  closedAt: number | null;
};

export type SupportTicketDetail = SupportTicketView & {
  description: string;
  messages: SupportMessageRecord[];
};

export type SupportMessageView = SupportMessageRecord & {
  internal: false;
};

/** Customer preferences for the conversation summary. */
export const TICKET_CATEGORY_OPTIONS: { value: TicketCategory; label: TicketCategoryLabel }[] = [
  { value: "identity", label: "Identity & Verification" },
  { value: "number", label: "Number" },
  { value: "esim", label: "eSIM & Connectivity" },
  { value: "billing", label: "Billing & Payments" },
  { value: "account", label: "Account & Security" },
  { value: "technical", label: "Technical Issue" },
  { value: "other", label: "Other" },
];

/** Attachment policy — deliberately conservative. */
export const SUPPORT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const SUPPORT_ACCEPTED_TYPES = ["image/png", "image/jpeg", "application/pdf"] as const;

/** Ops alert severities (deterministic monitoring only — no fake AI). */
export type OpsAlertSeverity = "info" | "warning" | "critical";
export type OpsAlertKind =
  | "esim_provisioning_failures"
  | "number_provisioning_failures"
  | "payment_failures"
  | "kyc_backlog"
  | "support_backlog"
  | "urgent_tickets"
  | "refund_activity";
