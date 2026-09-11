// =============================================================================
// OneNumbr — Future PSTN adapter boundary (Prompt 11)
//
// NOT an implementation. This file documents the contract a future legitimate
// PSTN integration must fulfill, and asserts it is disabled. The application
// runs fully without it. No carrier relationship, numbering arrangement or
// regulatory approval exists or is claimed.
//
// Future responsibilities of a real PSTNCommunicationsProvider:
//   - number provisioning against a real numbering arrangement
//     (number blocks, allocation, reservation, portability)
//   - inbound calling with carrier routing + carrier webhooks
//   - outbound calling with caller-ID presentation rules
//   - real SMS/MMS delivery + delivery receipts
//   - regulatory requirements per jurisdiction (KYB/KYC, local presence)
//   - EMERGENCY CALLING considerations (many jurisdictions require
//     location-aware emergency routing for PSTN numbers — must be designed
//     explicitly before any pstn_enabled launch)
//   - porting in/out of real numbers
//   - per-carrier credentials managed server-side only
//
// Enabled ONLY when a real provider is registered AND the
// FEATURE_PSTN_ENABLED flag is explicitly true.
// =============================================================================

export const PSTN_PROVIDER_BOUNDARY = {
  /** Set true only with a signed carrier/numbering arrangement. */
  enabled: false,
  /** Reserved interface name for the future adapter. */
  futureProviderName: "pstn-communications",
  /** Future adapter must implement providers/communications/types.ts. */
  implementsContract: "CommunicationsProvider",
  /** Hard requirements before enablement (checked at registration time). */
  enablementRequirements: [
    "carrier agreement executed",
    "numbering arrangement granted (not the application +1739 prefix)",
    "regulatory review completed per launch jurisdiction",
    "emergency-calling design approved where applicable",
    "server-side credentials provisioned via secret manager",
  ],
} as const;

/** Guard used anywhere PSTN behavior would be reachable. */
export function assertPstnDisabled(): void {
  if (PSTN_PROVIDER_BOUNDARY.enabled) {
    throw new Error("PSTN adapter must not be enabled without a legitimate arrangement");
  }
}
