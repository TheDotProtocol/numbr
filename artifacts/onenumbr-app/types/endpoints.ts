// =============================================================================
// OneNumbr — Endpoint domain types (Prompt 12)
//
// THE ENDPOINT IS NOT THE NUMBER. THE ENDPOINT IS NOT THE IDENTITY.
// The endpoint is where the OneNumbr communications identity can currently
// be accessed. Identity and number survive endpoint changes — that is the
// product promise this model encodes.
//
// ONE IDENTITY → ONE NUMBER → GLOBAL PLAN → COMMUNICATIONS → ENDPOINTS
//   → CONNECTIVITY → (future PSTN / MNO / MVNO / SIM)
// =============================================================================

import type { CommunicationsDomain } from "./communications";

// ---------------------------------------------------------------------------
// Endpoint types — only expose what is actually supported
// ---------------------------------------------------------------------------

/**
 * `web` is fully available (this app). `mobile_app` and `verified_device` are
 * architecture/demo. TauPhone/TauTalk are DEMO adapter bindings (no real
 * TauCore clients exist). sip/sim/pstn are FUTURE — never operational.
 */
export type EndpointType =
  | "web"
  | "mobile_app"
  | "tau_phone"
  | "tau_talk"
  | "verified_device"
  | "sip_future"
  | "sim_future"
  | "pstn_future";

export type EndpointTypeAvailability = "available" | "demo" | "coming_soon" | "disabled";

export const ENDPOINT_TYPE_AVAILABILITY: Record<EndpointType, EndpointTypeAvailability> = {
  web: "available",
  mobile_app: "demo",
  tau_phone: "demo",
  tau_talk: "demo",
  verified_device: "available",
  sip_future: "disabled",
  sim_future: "disabled",
  pstn_future: "disabled",
};

/** Human-facing type labels (product language, no telecom jargon). */
export const ENDPOINT_TYPE_LABELS: Record<EndpointType, string> = {
  web: "Web",
  mobile_app: "Mobile app",
  tau_phone: "TauPhone",
  tau_talk: "TauTalk",
  verified_device: "Verified device",
  sip_future: "SIP (coming later)",
  sim_future: "SIM (coming later)",
  pstn_future: "PSTN (coming later)",
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export type EndpointStatus = "pending_verification" | "active" | "suspended" | "revoked";

/**
 * Lifecycle: pending_verification → active ⇄ suspended; active/suspended →
 * revoked (terminal). A revoked endpoint can only return to active through a
 * FRESH registration (new endpoint record) — documented in
 * docs/endpoint-architecture.md §5.
 */
export const ENDPOINT_TRANSITIONS: Record<EndpointStatus, EndpointStatus[]> = {
  pending_verification: ["active", "revoked"],
  active: ["suspended", "revoked"],
  suspended: ["active", "revoked"],
  revoked: [],
};

// ---------------------------------------------------------------------------
// Capabilities — SUPPORTED ≠ ENABLED ≠ DEMO
// ---------------------------------------------------------------------------

export type EndpointCapability =
  | "voice"
  | "messaging"
  | "voicemail"
  | "notifications"
  | "caller_id"
  | "contacts"
  | "routing";

/** How a capability operates on an endpoint in the current environment. */
export type CapabilityMode = "enabled" | "demo" | "unsupported";

/** Per-type default capability modes. A provider binding may refine these. */
export const ENDPOINT_CAPABILITY_MODES: Record<EndpointType, Record<EndpointCapability, CapabilityMode>> = {
  web: {
    voice: "demo",
    messaging: "demo",
    voicemail: "enabled",
    notifications: "enabled",
    caller_id: "demo",
    contacts: "demo",
    routing: "enabled",
  },
  mobile_app: {
    voice: "demo",
    messaging: "demo",
    voicemail: "demo",
    notifications: "demo",
    caller_id: "demo",
    contacts: "demo",
    routing: "demo",
  },
  tau_phone: {
    voice: "demo",
    messaging: "demo",
    voicemail: "demo",
    notifications: "demo",
    caller_id: "demo",
    contacts: "unsupported",
    routing: "demo",
  },
  tau_talk: {
    voice: "unsupported",
    messaging: "demo",
    voicemail: "unsupported",
    notifications: "demo",
    caller_id: "unsupported",
    contacts: "unsupported",
    routing: "demo",
  },
  verified_device: {
    voice: "demo",
    messaging: "demo",
    voicemail: "enabled",
    notifications: "enabled",
    caller_id: "demo",
    contacts: "unsupported",
    routing: "enabled",
  },
  sip_future: {
    voice: "unsupported", messaging: "unsupported", voicemail: "unsupported",
    notifications: "unsupported", caller_id: "unsupported", contacts: "unsupported", routing: "unsupported",
  },
  sim_future: {
    voice: "unsupported", messaging: "unsupported", voicemail: "unsupported",
    notifications: "unsupported", caller_id: "unsupported", contacts: "unsupported", routing: "unsupported",
  },
  pstn_future: {
    voice: "unsupported", messaging: "unsupported", voicemail: "unsupported",
    notifications: "unsupported", caller_id: "unsupported", contacts: "unsupported", routing: "unsupported",
  },
};

// ---------------------------------------------------------------------------
// Presence — explicit updates only, never heartbeat spam
// ---------------------------------------------------------------------------

export type EndpointPresence = "online" | "offline" | "busy" | "unavailable" | "suspended";

// ---------------------------------------------------------------------------
// communication_endpoints/{endpointId}
// ---------------------------------------------------------------------------

export interface EndpointRecord {
  id: string;
  uid: string;
  /** Resolved server-side from onenumbr_ids at registration. */
  oneNumbrId: string | null;
  /** Primary active number at registration (informational; ownership lives in number_assignments). */
  numberId: string | null;
  type: EndpointType;
  name: string;
  /** Honest platform descriptor, e.g. "Web", "TauPhone (demo)". */
  platform: string;
  /** Linked devices/{id} when type is verified_device / web. */
  deviceId: string | null;
  status: EndpointStatus;
  capabilities: EndpointCapability[];
  /** Server-verified devices bind automatically; others demo-register. */
  verificationStatus: "verified" | "demo_verified" | "unverified";
  /** Primary routing preference. At most one active primary per user. */
  isPrimary: boolean;
  /** Last explicit presence update (never a heartbeat). */
  presence: EndpointPresence;
  lastActiveAt: number | null;
  /** Provider binding (e.g. "mock-tauphone") + its demo reference. */
  provider: string | null;
  providerReference: string | null;
  /** Future TauCore linkage — never interchangeable with OneNumbr IDs. */
  tauCoreIdentityId: string | null;
  tauDeviceId: string | null;
  tauApplicationId: string | null;
  /** Non-sensitive metadata only. */
  metadata: Record<string, string | number | boolean | null>;
  revokedAt: number | null;
  revokedReason: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Owner-safe projection. */
export interface EndpointView {
  id: string;
  type: EndpointType;
  typeLabel: string;
  availability: EndpointTypeAvailability;
  name: string;
  platform: string;
  status: EndpointStatus;
  capabilities: EndpointCapability[];
  capabilityModes: Partial<Record<EndpointCapability, CapabilityMode>>;
  verificationStatus: EndpointRecord["verificationStatus"];
  isPrimary: boolean;
  presence: EndpointPresence;
  lastActiveAt: number | null;
  provider: string | null;
  providerReference: string | null;
  createdAt: number;
}

/** Routing decision over endpoints (deterministic, application-level). */
export interface EndpointRoutingDecision {
  evaluated: { endpointId: string; type: EndpointType; name: string; order: number }[];
  selected: { endpointId: string; type: EndpointType; name: string } | null;
  fallback: { endpointId: string; type: EndpointType; name: string } | null;
  terminal: "voicemail";
  reason: string;
}
