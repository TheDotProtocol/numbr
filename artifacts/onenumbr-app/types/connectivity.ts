// =============================================================================
// OneNumbr — Connectivity domain types (Prompt 14)
//
// CONNECTIVITY is the service layer UNDERNEATH communications and endpoints —
// the replaceable infrastructure that carries OneNumbr access. It is
// provider-neutral: eSIM is one mechanism, not the product.
//
//   ONE IDENTITY → ONE NUMBER → GLOBAL PLAN → COMMUNICATIONS → ENDPOINTS
//     → CONNECTIVITY → PROVIDERS (cloud / eSIM / MNO/MVNO / SIM / PSTN / SIP)
//
// Invariants encoded here and enforced in lib/connectivity-server.ts:
//   - connectivity NEVER owns the OneNumbr ID or Number
//   - provider references (ICCID/IMSI/etc.) are internal identifiers,
//     never the OneNumbr Number
//   - mechanism/provider changes never touch identity, number or plan
// =============================================================================

import type { EntitlementAvailability } from "@/types/plan";

/** Connectivity mechanisms the architecture models. */
export type ConnectivityMechanism =
  | "cloud" // application-level cloud telephony (current demo reality)
  | "esim" // existing eSIM engine (Prompt 3) — demo provider
  | "mno"
  | "mvno"
  | "physical_sim"
  | "pstn"
  | "sip";

/**
 * Honest availability of a mechanism in the current environment.
 * (Mirror of EntitlementAvailability so connectivity can't imply more than
 * the plan model claims.)
 */
export type ConnectivityAvailability = EntitlementAvailability; // "available" | "demo" | "coming_soon"

/** Durable connection lifecycle. Provider ops are server-side only. */
export type ConnectivityStatus =
  | "not_configured"
  | "available"
  | "requested"
  | "provisioning"
  | "active"
  | "suspended"
  | "failed"
  | "terminated";

/** Capability metadata — "supported by architecture" ≠ available ≠ live. */
export type ConnectivityCapability = "voice" | "messaging" | "data" | "roaming" | "esim" | "physical_sim" | "pstn" | "sip";

/** provider/connectivity identifiers — NEVER the OneNumbr Number. */
export interface ConnectivityProviderRefs {
  /** e.g. ICCID (eSIM), subscriber id (MNO), instance id (cloud). */
  providerReference: string | null;
  /** e.g. eSIM profile/ICCID — labeled per mechanism in the UI. */
  simReference: string | null;
  /** e.g. IMSI — stored only when a mechanism supplies it. */
  subscriberReference: string | null;
}

/** connectivity_connections/{connectionId} — owner-scoped, server-written. */
export interface ConnectivityConnection {
  id: string;
  uid: string;
  /** Connectivity never owns identity; this is a denormalized label only. */
  oneNumbrIdLabel: string | null;
  /** Optional link to the number whose communications ride this connection. */
  numberId: string | null;
  /** Optional endpoint consuming this connection. */
  endpointId: string | null;
  mechanism: ConnectivityMechanism;
  /** Registry id of the supplying provider (e.g. "cloud-demo"). */
  providerId: string;
  status: ConnectivityStatus;
  /** Deployment honesty: demo connections never claim "live". */
  environment: "demo" | "live";
  region: string | null;
  capabilities: ConnectivityCapability[];
  refs: ConnectivityProviderRefs;
  /** Human explanation of why demo/limited (honesty note for UI). */
  note: string | null;
  failureReason: string | null;
  createdAt: number;
  activatedAt: number | null;
  suspendedAt: number | null;
  terminatedAt: number | null;
  updatedAt: number;
}

/** Static mechanism metadata (honest availability + capability advertisement). */
export interface MechanismInfo {
  mechanism: ConnectivityMechanism;
  label: string;
  availability: ConnectivityAvailability;
  capabilities: ConnectivityCapability[];
  /** Honest UI note, e.g. "Demo provider — simulated provisioning." */
  note: string;
}

/**
 * Mechanism availability in THIS environment. eSIM availability defers to the
 * existing connectivity/eSIM flags at read time; everything else is static
 * honesty.
 */
export const CONNECTIVITY_MECHANISMS: Record<ConnectivityMechanism, MechanismInfo> = {
  cloud: {
    mechanism: "cloud",
    label: "Cloud telephony",
    availability: "available",
    capabilities: ["voice", "messaging", "data"],
    note: "Application-level cloud connectivity — the current OneNumbr mechanism.",
  },
  esim: {
    mechanism: "esim",
    label: "eSIM",
    availability: "demo",
    capabilities: ["data", "esim"],
    note: "Demo eSIM provider — provisioning is simulated; not installable on a device.",
  },
  mno: {
    mechanism: "mno",
    label: "Carrier (MNO)",
    availability: "coming_soon",
    capabilities: ["voice", "messaging", "data", "roaming"],
    note: "Requires future carrier agreements.",
  },
  mvno: {
    mechanism: "mvno",
    label: "Carrier (MVNO)",
    availability: "coming_soon",
    capabilities: ["voice", "messaging", "data", "roaming"],
    note: "Requires future carrier agreements.",
  },
  physical_sim: {
    mechanism: "physical_sim",
    label: "Physical SIM",
    availability: "coming_soon",
    capabilities: ["voice", "messaging", "data", "physical_sim"],
    note: "Planned for a later phase.",
  },
  pstn: {
    mechanism: "pstn",
    label: "PSTN",
    availability: "coming_soon",
    capabilities: ["voice", "messaging", "pstn"],
    note: "Separate boundary (Prompt 11); requires a legitimate numbering arrangement.",
  },
  sip: {
    mechanism: "sip",
    label: "SIP",
    availability: "coming_soon",
    capabilities: ["voice", "sip"],
    note: "Future integration boundary.",
  },
};

/** Provider-neutral region view — regions vary connectivity, never the plan. */
export interface RegionAvailability {
  region: string;
  /** Mechanisms with availability != coming_soon in this region. */
  mechanisms: MechanismInfo[];
}
