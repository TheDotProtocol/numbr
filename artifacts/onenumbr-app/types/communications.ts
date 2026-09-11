// =============================================================================
// OneNumbr — Communications domain types (Prompt 11)
//
// Product hierarchy:
//   ONE IDENTITY (OneNumbr ID, permanent)
//     ↓
//   ONE NUMBER (OneNumbr Number, public communications identity)
//     ↓
//   ONE GLOBAL PLAN (standard monthly subscription)
//     ↓
//   COMMUNICATIONS (voice / messaging / voicemail / routing)
//     ↓
//   CONNECTIVITY (eSIM today-as-abstraction; PSTN/MVNO/SIM future)
//
// +1739 is an APPLICATION-LEVEL OneNumbr numbering abstraction — it is not an
// officially assigned PSTN country code and nothing here pretends otherwise.
// =============================================================================

// ---------------------------------------------------------------------------
// Numbering status — application identity vs telecom routing truth
// ---------------------------------------------------------------------------

/**
 * Honest numbering status for a OneNumbr Number. Today every number is
 * `application_only`. `future_pstn_pending` / `pstn_enabled` are reserved for
 * a legitimate future numbering arrangement — never set without one.
 */
export type NumberingStatus = "application_only" | "future_pstn_pending" | "pstn_enabled";

/** Lifecycle of the number within OneNumbr (mirrors NumberStatus). */
export type NumberLifecycleStatus = "active" | "reserved" | "provisioning" | "suspended" | "released" | "failed";

/** Where the number stands in assignment (projection of NumberAssignment). */
export type NumberAssignmentStatus = "primary" | "secondary" | "released" | "historical";

// ---------------------------------------------------------------------------
// Communications provider surface
// ---------------------------------------------------------------------------

export type CommunicationsDomain = "voice" | "messaging" | "voicemail";

export type CallDirection = "inbound" | "outbound";
export type MessageDirection = CallDirection;

export type CallStatus =
  | "initiated"
  | "ringing"
  | "answered"
  | "ended"
  | "failed"
  | "cancelled"
  | "busy"
  | "no_answer";

export type CallTerminationReason =
  | "hangup"
  | "caller_hangup"
  | "callee_hangup"
  | "cancelled"
  | "failed"
  | "busy"
  | "no_answer"
  | "blocked";

export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed";

export type VoicemailStatus = "new" | "read" | "archived";

// ---------------------------------------------------------------------------
// calls/{callId}
// ---------------------------------------------------------------------------

export interface CallParty {
  /** Display/label of the party; demo provider uses synthetic labels. */
  label: string;
  /** Canonical representation when meaningful (app-level, not E.164 claim). */
  canonical: string | null;
}

export interface CallRecord {
  id: string;
  uid: string;
  oneNumbrId: string | null;
  numberId: string;
  direction: CallDirection;
  from: CallParty;
  to: CallParty;
  status: CallStatus;
  provider: string; // "mock-communications"
  providerReference: string | null; // MOCK-CALL-XXXX
  startedAt: number;
  answeredAt: number | null;
  endedAt: number | null;
  durationSeconds: number | null;
  terminationReason: CallTerminationReason | null;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// messages/{messageId}
// ---------------------------------------------------------------------------

export interface MessageRecord {
  id: string;
  uid: string;
  oneNumbrId: string | null;
  numberId: string;
  direction: MessageDirection;
  from: CallParty;
  to: CallParty;
  /** Message body. Application messaging — NOT PSTN SMS. */
  body: string;
  status: MessageStatus;
  provider: string; // "mock-communications"
  providerReference: string | null; // MOCK-MSG-XXXX
  createdAt: number;
  deliveredAt: number | null;
  readAt: number | null;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// voicemails/{voicemailId}
// ---------------------------------------------------------------------------

export interface VoicemailRecord {
  id: string;
  uid: string;
  oneNumbrId: string | null;
  numberId: string;
  caller: CallParty;
  durationSeconds: number;
  status: VoicemailStatus;
  provider: string;
  providerReference: string | null; // MOCK-VM-XXXX
  /**
   * Demo transcript only in this environment — no real audio is stored.
   * A real recording would live in private Storage with signed-URL access.
   */
  transcript: string | null;
  recordingPath: string | null;
  createdAt: number;
  readAt: number | null;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// communication_endpoints/{endpointId}
// ---------------------------------------------------------------------------

export type EndpointKind =
  | "web" // the OneNumbr web app itself
  | "mobile_app" // future OneNumbr mobile client
  | "tau_phone" // future TauPhone
  | "verified_device" // a registered devices/{id} record
  | "forwarding_destination" // future app-level forwarding target
  | "voicemail" // the voicemail endpoint
  | "sip" // future SIP endpoint
  | "pstn"; // future PSTN destination — requires pstnEnabled

export interface CommunicationEndpoint {
  id: string;
  uid: string;
  kind: EndpointKind;
  /** Human label, e.g. "Web (this browser)". */
  label: string;
  /** Endpoint-specific routing detail (device id, SIP URI…) — never secrets. */
  target: string | null;
  enabled: boolean;
  priority: number; // lower = tried first
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// routing_rules/{uid} — one doc per user (single-number product model)
// ---------------------------------------------------------------------------

export type RoutingAction =
  | "app" // ring the OneNumbr app/web endpoint
  | "tau_phone"
  | "verified_device"
  | "forward"
  | "voicemail";

export interface RoutingRule {
  id: string;
  uid: string;
  numberId: string;
  /** Ordered destination evaluation for inbound calls. */
  steps: RoutingAction[];
  /** Required when a step includes "forward". */
  forwardEndpointId: string | null;
  /** Seconds before falling through to the next step / voicemail. */
  ringTimeoutSeconds: number;
  /** Voicemail is always the terminal fallback and cannot be removed. */
  voicemailFallback: true;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// communication_preferences/{uid}
// ---------------------------------------------------------------------------

export interface CommunicationPreferences {
  uid: string;
  voicemailEnabled: boolean;
  /** Missed-call notifications. */
  missedCallAlerts: boolean;
  /** Inbound demo-message notifications. */
  messageAlerts: boolean;
  /** Suppress demo-call history visibility (records retained server-side). */
  hideCallHistory: boolean;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Projections (customer-safe)
// ---------------------------------------------------------------------------

/** Owner-safe view of the primary number with numbering honesty. */
export interface CommunicationsNumberView {
  numberId: string;
  assignmentId: string;
  displayNumber: string;
  /** e.g. "+1739" — applicationPrefix, NOT a country code. */
  applicationPrefix: string;
  subscriberNumber: string;
  canonicalRepresentation: string;
  numberingStatus: NumberingStatus;
  pstnStatus: "not_available" | "pending_arrangement" | "enabled";
  routingStatus: "application" | "pstn";
  assignmentStatus: NumberAssignmentStatus;
  assignedAt: number | null;
}

/** OneNumbr Global Plan entitlement view (from the billing subscription). */
export interface GlobalPlanView {
  active: boolean;
  planId: string | null;
  planName: string;
  amountMinor: number | null;
  currency: string | null;
  interval: string | null;
  currentPeriodEnd: number | null;
  /** The active number subscription backing the plan (billing source of truth). */
  subscriptionId: string | null;
  demoProvider: boolean;
}

export interface CommunicationsOverview {
  number: CommunicationsNumberView | null;
  plan: GlobalPlanView;
  recentCalls: CallRecord[];
  recentMessages: MessageRecord[];
  recentVoicemails: VoicemailRecord[];
  endpoints: CommunicationEndpoint[];
  routing: RoutingRule | null;
  preferences: CommunicationPreferences;
  provider: { name: string; demo: boolean };
}

// ---------------------------------------------------------------------------
// TauCore integration boundary (contract only — NO live integration exists)
// ---------------------------------------------------------------------------

/**
 * Payload OneNumbr would emit for TauCore services (TauPhone / TauTalk /
 * TauID) to consume. Pure contract; nothing emits or consumes these today.
 */
export interface TauCoreIdentityToken {
  oneNumbrId: string;
  uid: string;
  /** Audience, e.g. "tau_phone" | "tau_talk". */
  audience: string;
  issuedAt: number;
  expiresAt: number;
}

export interface TauCoreEndpointRegistration {
  endpointId: string;
  endpointKind: EndpointKind;
  oneNumbrNumber: string;
  displayName: string;
  capabilities: CommunicationsDomain[];
}
