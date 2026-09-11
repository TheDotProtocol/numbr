// =============================================================================
// OneNumbr — Cloud communications adapter contract (Prompt 17)
//
// The FIRST REAL PROVIDER layer, built strictly on top of the Prompt 15
// provider-readiness architecture. This contract describes what a real cloud
// communications vendor adapter must implement and how it must behave — it does
// NOT integrate any specific vendor and does NOT claim any vendor relationship.
//
// Positioning (unchanged):
//
//   OneNumbr Identity (ON-284739)          — permanent, never provider-owned
//        ↓
//   OneNumbr Number (+1739 …)              — application-level abstraction
//        ↓
//   Communications Service (Prompt 11)     — domain layer
//        ↓
//   CommunicationsProvider (Prompt 11)     — vendor-neutral interface
//        ↓
//   CloudCommunicationsAdapter (this file) — the REAL vendor adapter boundary
//        ↓
//   Vendor API / PSTN / destination
//
// Honesty rules (do not violate):
//   1. The adapter exposes only the capabilities actually configured/supported.
//   2. No credentials, no invented values, no fake health, no fake events.
//   3. Without complete configuration the adapter stays DISABLED and the mock
//      provider remains the operational provider.
//   4. +1739 remains an application-level abstraction; any conventional
//      telephone number a real vendor supplies is stored as PROVIDER
//      INFRASTRUCTURE METADATA, never as official +1739 numbering.
// =============================================================================

import type { ProviderCapability, ProviderConfigState, ProviderEnvironment } from "@/types/provider";
import type { CommunicationsProvider } from "@/providers/communications/types";

// ---------------------------------------------------------------------------
// Capabilities — declared by configuration, never inferred from vendor names
// ---------------------------------------------------------------------------

/** Capabilities the first real cloud communications provider MAY support.
 *  The actual set comes from provider configuration + verification, never from
 *  the vendor name or marketing. */
export type CloudCommunicationsCapability = Extract<
  ProviderCapability,
  "voice" | "sms" | "mms" | "webhooks" | "numbering" | "pstn"
>;

/** Capability map for the real adapter — only capabilities actually supported
 *  by the configured provider may be true. */
export type CloudCommunicationsCapabilitySet = Readonly<
  Record<CloudCommunicationsCapability, boolean>
>;

export const CLOUD_COMMUNICATIONS_CAPABILITIES: readonly CloudCommunicationsCapability[] = [
  "voice",
  "sms",
  "mms",
  "webhooks",
  "numbering",
  "pstn",
] as const;

export function emptyCloudCommunicationsCapabilities(): CloudCommunicationsCapabilitySet {
  return {
    voice: false,
    sms: false,
    mms: false,
    webhooks: false,
    numbering: false,
    pstn: false,
  };
}

// ---------------------------------------------------------------------------
// Configuration contract — environment-driven, server-only
// ---------------------------------------------------------------------------

/** Names of the server-only environment variables the adapter requires.
 *  Values are NEVER stored in code, Firestore, logs or client responses.
 *  The concrete variable names are declared by the vendor adapter
 *  implementation (e.g. its API key/secret/account id/webhook secret); this
 *  contract only defines the shape. */
export type CloudCommunicationsCredentialRequirement = {
  /** Canonical env var name, e.g. CLOUD_COMMS_PROVIDER_API_KEY. */
  envVar: string;
  purpose: string;
  secret: boolean;
};

export type CloudCommunicationsConfig = {
  /** Registry id of the configured vendor (set only when configured). */
  providerId: string | null;
  /** Vendor-declared credential requirements (names only). */
  credentials: readonly CloudCommunicationsCredentialRequirement[];
  /** Capabilities verified for this provider configuration. */
  capabilities: CloudCommunicationsCapabilitySet;
  /** Sandbox/test mode — when true, live paid operations stay blocked. */
  sandboxMode: boolean;
  /** Webhook secret env var name (signature verification). */
  webhookSecretEnvVar: string | null;
};

// ---------------------------------------------------------------------------
// Adapter status — honest lifecycle for the REAL provider slot
// ---------------------------------------------------------------------------

export type CloudCommunicationsAdapterStatus =
  | "not_configured"   // no credentials present — adapter inert, mock stays active
  | "configured"       // credentials present; capabilities declared; not yet verified
  | "available"        // configured + verified reachable (explicit health check)
  | "degraded"         // reachable but reporting problems
  | "unavailable"      // configured but failing
  | "error"            // configuration/runtime error
  | "disabled"         // flag off / environment disallows
  | "not_measured";    // no health check has ever run — never pretend otherwise

// ---------------------------------------------------------------------------
// Normalized communications events (vendor-independent; Prompt 17)
// ---------------------------------------------------------------------------

export type CloudCommunicationsNormalizedEvent =
  | { kind: "call.started"; callRef: string }
  | { kind: "call.ringing"; callRef: string }
  | { kind: "call.connected"; callRef: string }
  | { kind: "call.completed"; callRef: string; durationSeconds: number }
  | { kind: "call.failed"; callRef: string; reason: string }
  | { kind: "message.sent"; messageRef: string }
  | { kind: "message.delivered"; messageRef: string }
  | { kind: "message.failed"; messageRef: string; reason: string }
  | { kind: "message.received"; messageRef: string; toNumberRef: string }
  | { kind: "number.activated"; numberRef: string }
  | { kind: "number.suspended"; numberRef: string }
  | { kind: "number.released"; numberRef: string };

// ---------------------------------------------------------------------------
// The real adapter interface
// ---------------------------------------------------------------------------

/** What a real cloud communications vendor adapter must implement ON TOP of
 *  the CommunicationsProvider contract. Capability-gated methods must only be
 *  called when the corresponding capability is true — callers check
 *  `capabilities` first (the service layer enforces this). */
export interface CloudCommunicationsAdapter extends CommunicationsProvider {
  /** Honest adapter metadata. */
  readonly adapterId: string;
  readonly displayName: string;
  readonly environment: ProviderEnvironment;
  readonly configState: ProviderConfigState;
  readonly capabilities: CloudCommunicationsCapabilitySet;
  /** True only when credentials are present and the flag allows operation. */
  readonly operational: boolean;
  /** Credential requirements (names only — never values). */
  readonly credentialRequirements: readonly CloudCommunicationsCredentialRequirement[];

  /** Explicit health check. Implementations must return not_measured when no
   *  real check exists rather than fabricating health. */
  healthCheck(): Promise<{ status: CloudCommunicationsAdapterStatus; note: string }>;

  /** Idempotent outbound SMS. Callers pass a OneNumbr-generated idempotency
   *  key; the adapter forwards it where the vendor supports idempotency keys
   *  and de-duplicates locally where it does not. Requires capability `sms`. */
  sendSmsIdempotent(input: {
    idempotencyKey: string;
    fromNumberRef: string;
    to: string;
    body: string;
  }): Promise<{ providerReference: string; duplicate: boolean }>;

  /** Idempotent outbound voice initiation. Requires capability `voice`. */
  initiateCallIdempotent(input: {
    idempotencyKey: string;
    fromNumberRef: string;
    to: string;
  }): Promise<{ providerReference: string; duplicate: boolean }>;

  /** Normalized webhook event processing. Signature/timestamp/replay checks
   *  happen in lib/webhooks-server.ts BEFORE this is called. */
  normalizeWebhookEvent(input: {
    providerEventType: string;
    payload: Record<string, unknown>;
  }): CloudCommunicationsNormalizedEvent | null;
}

// ---------------------------------------------------------------------------
// Shared error type — maps into the OneNumbr domain error system
// ---------------------------------------------------------------------------

export type CloudCommunicationsErrorCategory =
  | "transient"
  | "permanent"
  | "authentication"
  | "rate_limited"
  | "conflict"
  | "unsupported";

export type CloudCommunicationsError = Error & {
  category: CloudCommunicationsErrorCategory;
  /** Vendor error code/symbol — safe for logs, never shown to customers raw. */
  vendorCode: string | null;
};
