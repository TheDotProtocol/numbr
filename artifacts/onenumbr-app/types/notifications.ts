// =============================================================================
// OneNumbr — User notification types
// =============================================================================

export type NotificationKind =
  | "kyc.submitted"
  | "kyc.approved"
  | "kyc.rejected"
  | "kyc.resubmission_requested"
  | "esim.order_created"
  | "esim.payment_successful"
  | "esim.provisioning_started"
  | "esim.ready"
  | "esim.provisioning_failed"
  | "esim.expired"
  // Numbers (Prompt 4)
  | "number.reservation_confirmed"
  | "number.activation_started"
  | "number.activated"
  | "number.activation_failed"
  | "number.released"
  // Billing (Prompt 5)
  | "billing.payment_successful"
  | "billing.payment_failed"
  | "billing.invoice_issued"
  | "billing.refund_processed"
  | "billing.subscription_activated"
  | "billing.subscription_cancelled"
  | "billing.subscription_payment_failed"
  | "billing.subscription_suspended"
  | "connectivity.setup_started"
  | "connectivity.ready"
  | "connectivity.setup_failed"
  | "connectivity.suspended"
  // Account & security (Prompt 6)
  | "security.new_login"
  | "security.session_revoked"
  | "security.password_changed"
  | "security.settings_changed"
  | "account.deactivation_requested"
  | "account.deletion_requested"
  // Support (Prompt 7)
  | "support.ticket_created"
  | "support.agent_replied"
  | "support.status_changed"
  | "support.ticket_resolved"
  | "support.ticket_reopened"
  // Communications (Prompt 11) — demo provider events
  | "communications.voicemail_created"
  | "communications.message_received"
  | "communications.missed_call"
  | "communications.failure"
  // Endpoints (Prompt 12)
  | "communications.endpoint_connected"
  | "communications.endpoint_revoked"
  | "communications.endpoint_primary_changed"
  | "communications.endpoint_verification_required";

export interface UserNotification {
  id: string;
  uid: string;
  kind: NotificationKind;
  title: string;
  message: string;
  read: boolean;
  createdAt: number | null;
}
