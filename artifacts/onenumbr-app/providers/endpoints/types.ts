// =============================================================================
// OneNumbr — EndpointProvider contract (Prompt 12)
//
// Adapter interface a device/application platform implements so OneNumbr can
// register, reach and route to it as a communication endpoint. A future real
// TauPhone client implements the TauPhone adapter; a future TauTalk client
// implements the TauTalk adapter. Neither exists today — the mock adapters
// below are application-level demonstrations only.
// =============================================================================

import type { EndpointCapability, EndpointPresence, EndpointType } from "@/types/endpoints";

export interface EndpointRegistrationInput {
  uid: string;
  oneNumbrId: string | null;
  numberId: string | null;
  displayName: string;
  platform: string;
  /** Client-supplied correlation only — never trusted as identity. */
  clientMetadata?: Record<string, string | number | boolean | null>;
}

export interface EndpointRegistrationResult {
  providerReference: string;
  verified: boolean;
  capabilities: EndpointCapability[];
}

/**
 * Future responsibilities of a real adapter (documented, not implemented):
 *   - endpoint registration + device authentication (attestation / TauID /
 *     OAuth-OIDC / signed registration — see docs/endpoint-architecture.md §7)
 *   - capability registration + number association
 *   - communication event delivery (inbound call/message fan-out)
 *   - push notification registration
 *   - endpoint status + presence reporting
 *   - call/message event routing back into the communications core
 */
export interface EndpointProvider {
  readonly name: string;
  readonly endpointType: EndpointType;
  readonly availability: "demo" | "real";

  register(input: EndpointRegistrationInput): Promise<EndpointRegistrationResult>;
  revoke(providerReference: string, reason: string): Promise<void>;
  setPresence(providerReference: string, presence: EndpointPresence): Promise<void>;
  /** Deterministic routing reachability probe (demo: label-based failure path). */
  isReachable(providerReference: string): Promise<boolean>;
}
