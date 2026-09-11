// =============================================================================
// OneNumbr — Audit log writer (server-side only)
//
// Structure: audit_logs/{autoId}
//   actorUid, action, targetUid, metadata, createdAt (server timestamp)
// Security rules deny all client access; only the Admin SDK writes here.
// Never store identity documents or document numbers in audit metadata.
// =============================================================================

import { getAdminDb } from "@/firebase/admin";

export type AuditAction =
  | "admin.session_started"
  | "user.status_changed"
  | "user.role_changed"
  | "user.profile_updated_by_admin"
  | "identity.onenumbr_id_issued"
  // KYC (Prompt 2)
  | "kyc.submitted"
  | "kyc.review_started"
  | "kyc.approved"
  | "kyc.rejected"
  | "kyc.resubmission_requested"
  // eSIM (Prompt 3)
  | "esim.plan_created"
  | "esim.plan_updated"
  | "esim.plan_disabled"
  | "esim.order_created"
  | "esim.payment_confirmed"
  | "esim.provisioning_started"
  | "esim.provisioning_completed"
  | "esim.provisioning_failed"
  | "esim.cancelled"
  // Numbers (Prompt 4)
  | "number.reserved"
  | "number.order_created"
  | "number.payment_confirmed"
  | "number.provisioning_started"
  | "number.provisioning_completed"
  | "number.provisioning_failed"
  | "number.assigned"
  | "number.released"
  | "number.reservation_expired"
  // Billing (Prompt 5)
  | "billing.payment_created"
  | "billing.payment_succeeded"
  | "billing.payment_failed"
  | "billing.refund_created"
  | "billing.refund_completed"
  | "billing.invoice_created"
  | "billing.invoice_issued"
  | "billing.invoice_paid"
  | "billing.subscription_created"
  | "billing.subscription_activated"
  | "billing.subscription_cancelled"
  | "billing.subscription_payment_failed"
  | "billing.plan_assigned"
  | "billing.subscription_suspended"
  | "connectivity.requested"
  | "connectivity.provisioning_started"
  | "connectivity.activated"
  | "connectivity.suspended"
  | "connectivity.resumed"
  | "connectivity.terminated"
  | "connectivity.failed"
  | "connectivity.provider_selected"
  | "connectivity.endpoint_linked"
  // Account & security (Prompt 6)
  | "account.profile_updated"
  | "account.password_changed"
  | "account.session_revoked"
  | "account.sessions_revoked"
  | "account.device_added"
  | "account.device_removed"
  | "account.device_renamed"
  | "account.security_updated"
  | "account.notification_preferences_updated"
  | "account.privacy_updated"
  | "account.deactivation_requested"
  | "account.deletion_requested"
  // Support & operations (Prompt 7)
  | "support.ticket_created"
  | "support.customer_replied"
  | "support.customer_closed"
  | "support.customer_reopened"
  | "support.attachment_uploaded"
  | "support.agent_replied"
  | "support.internal_note_added"
  | "support.ticket_assigned"
  | "support.ticket_reassigned"
  | "support.ticket_unassigned"
  | "support.ticket_status_changed"
  | "support.ticket_priority_changed"
  | "support.ticket_resolved"
  | "support.ticket_reopened"
  // Operations (Prompt 7)
  | "operations.snapshot_refreshed"
  // Communications (Prompt 11) — never log message bodies or call parties
  | "communications.call_initiated"
  | "communications.call_ended"
  | "communications.message_sent"
  | "communications.message_status_changed"
  | "communications.voicemail_created"
  | "communications.voicemail_read"
  | "communications.routing_changed"
  | "communications.endpoint_added"
  | "communications.endpoint_removed"
  // Endpoints (Prompt 12)
  | "communications.endpoint_registered"
  | "communications.endpoint_activated"
  | "communications.endpoint_suspended"
  | "communications.endpoint_revoked"
  | "communications.endpoint_primary_changed"
  | "communications.endpoint_routing_changed"
  | "communications.endpoint_provider_operation"
  | "communications.preferences_changed"
  | "communications.number_linked"
  | "communications.number_released"
  | "communications.provider_operation_failed"
  // Provider readiness (Prompt 15) — never includes raw payloads or secrets
  | "provider.event.received"
  | "provider.event.notification_queued"
  // Trust & safety (Prompt 16) — abuse report ingestion breadcrumb; no raw content in metadata
  | "trust_and_safety_event.record";

export async function writeAuditLog(input: {
  actorUid: string;
  action: AuditAction;
  targetUid?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await getAdminDb().collection("audit_logs").add({
      actorUid: input.actorUid,
      action: input.action,
      targetUid: input.targetUid ?? null,
      metadata: input.metadata ?? {},
      createdAt: new Date(), // Admin SDK converts to Firestore Timestamp
    });
  } catch (err) {
    // Audit failures must not break the primary action, but must be visible.
    console.error("[OneNumbr] audit log write failed:", err);
  }
}
