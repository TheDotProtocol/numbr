// =============================================================================
// OneNumbr — Unified status system (single source of truth)
//
// Every status rendered anywhere in the product resolves through this module:
// one label, one tone, everywhere. Pages must not keep private label maps —
// import from here (or the StatusBadge component) instead.
// =============================================================================

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "gold" | "info";

const STATUSES = {
  // Identity / KYC
  verified: { label: "Verified", tone: "success" },
  unverified: { label: "Unverified", tone: "neutral" },
  pending: { label: "Pending", tone: "warning" },
  under_review: { label: "Under review", tone: "gold" },
  submitted: { label: "Submitted", tone: "gold" },
  resubmission_required: { label: "Resubmission required", tone: "warning" },
  not_started: { label: "Not started", tone: "neutral" },
  not_verified: { label: "Not verified", tone: "neutral" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },

  // Lifecycle
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  activating: { label: "Activating", tone: "gold" },
  provisioning: { label: "Activating", tone: "gold" },
  ready: { label: "Ready", tone: "success" },
  suspended: { label: "Suspended", tone: "danger" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  released: { label: "Released", tone: "neutral" },
  reserved: { label: "Reserved", tone: "gold" },
  available: { label: "Available", tone: "success" },
  deactivated: { label: "Deactivated", tone: "warning" },
  deletion_requested: { label: "Deletion requested", tone: "warning" },
  expired: { label: "Expired", tone: "neutral" },

  // Payments / billing
  paid: { label: "Paid", tone: "success" },
  refunded: { label: "Refunded", tone: "info" },
  partially_refunded: { label: "Partially refunded", tone: "info" },
  payment_failed: { label: "Failed", tone: "danger" },
  payment_pending: { label: "Pending", tone: "warning" },
  // Global Plan (Prompt 13)
  demo_active: { label: "Demo active", tone: "gold" },
  past_due: { label: "Payment due", tone: "warning" },
  paused: { label: "Paused", tone: "warning" },
  none: { label: "No plan", tone: "neutral" },
  coming_soon: { label: "Coming soon", tone: "neutral" },
  demo_capability: { label: "Demo", tone: "gold" },
  // Connectivity (Prompt 14)
  not_configured: { label: "Not set up", tone: "neutral" },
  requested: { label: "Requested", tone: "info" },
  terminated: { label: "Terminated", tone: "neutral" },

  // Support
  open: { label: "Open", tone: "gold" },
  in_progress: { label: "In progress", tone: "info" },
  waiting_for_customer: { label: "Waiting for you", tone: "warning" },
  waiting_for_provider: { label: "Waiting for provider", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
  urgent: { label: "Urgent", tone: "danger" },
  high: { label: "High", tone: "warning" },
  normal: { label: "Normal", tone: "neutral" },
  low: { label: "Low", tone: "neutral" },

  // Environment
  operational: { label: "Operational", tone: "success" },
  degraded: { label: "Degraded", tone: "warning" },
  maintenance: { label: "Maintenance", tone: "warning" },
  unavailable: { label: "Unavailable", tone: "danger" },
  demo: { label: "Demo environment", tone: "gold" },

  // Misc
  email_verified: { label: "Verified", tone: "success" },
  email_unverified: { label: "Unverified", tone: "warning" },
  good: { label: "Protected", tone: "success" },
  needs_attention: { label: "Needs attention", tone: "warning" },
  action_required: { label: "Action required", tone: "warning" },
  // Communications (Prompt 11)
  initiated: { label: "Initiated", tone: "info" },
  ringing: { label: "Ringing", tone: "info" },
  answered: { label: "Answered", tone: "success" },
  ended: { label: "Ended", tone: "neutral" },
  busy: { label: "Busy", tone: "warning" },
  no_answer: { label: "No answer", tone: "warning" },
  queued: { label: "Queued", tone: "info" },
  sent: { label: "Sent", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  read: { label: "Read", tone: "neutral" },
  archived: { label: "Archived", tone: "neutral" },
  application_only: { label: "Application identity", tone: "neutral" },
  future_pstn_pending: { label: "PSTN pending", tone: "warning" },
  pstn_enabled: { label: "PSTN enabled", tone: "success" },
  primary: { label: "Primary", tone: "success" },
  secondary: { label: "Secondary", tone: "neutral" },
  historical: { label: "Historical", tone: "neutral" },
} as const;

export type StatusKey = keyof typeof STATUSES;

export function statusLabel(status: string): string {
  const entry = (STATUSES as Record<string, { label: string; tone: StatusTone }>)[status];
  return entry?.label ?? status.replace(/_/g, " ");
}

export function statusTone(status: string): StatusTone {
  const entry = (STATUSES as Record<string, { label: string; tone: StatusTone }>)[status];
  if (entry) return entry.tone;
  // Sensible fallbacks for unmapped states.
  if (/fail|error|reject|suspend|denied|danger/.test(status)) return "danger";
  if (/pending|wait|review|progress|reserved|deactivat/.test(status)) return "warning";
  if (/active|verified|paid|ready|approved|success|resolved|operational|available/.test(status)) return "success";
  return "neutral";
}
