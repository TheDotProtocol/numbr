// =============================================================================
// OneNumbr — Future connectivity provider boundaries (Prompt 14)
//
// NOT implementations. These typed stubs document the future responsibilities
// of each mechanism-specific provider and are REJECTED by the registry while
// disabled. No fake carrier responses, no fabricated coverage, no simulated
// MNO/MVNO/SIM/SIP operations.
// =============================================================================

import type { ConnectivityCapability, ConnectivityMechanism } from "@/types/connectivity";

export interface FutureProviderBoundary {
  readonly id: string;
  readonly mechanism: ConnectivityMechanism;
  readonly name: string;
  readonly capabilities: ConnectivityCapability[];
  /** Why this is not operational yet (honest, shown to ops). */
  readonly requirement: string;
  /** Future responsibilities — documentation artifact. */
  readonly futureResponsibilities: string[];
}

export const MNO_CONNECTIVITY_BOUNDARY: FutureProviderBoundary = {
  id: "mno-future",
  mechanism: "mno",
  name: "MNO Connectivity Provider (future)",
  capabilities: ["voice", "messaging", "data", "roaming"],
  requirement: "Requires a signed carrier agreement and authorized API credentials.",
  futureResponsibilities: [
    "Subscriber provisioning",
    "SIM/eSIM lifecycle",
    "Network access",
    "Roaming",
    "Data / SMS / voice",
    "Carrier webhooks",
    "Network status",
  ],
};

export const MVNO_CONNECTIVITY_BOUNDARY: FutureProviderBoundary = {
  id: "mvno-future",
  mechanism: "mvno",
  name: "MVNO Connectivity Provider (future)",
  capabilities: ["voice", "messaging", "data", "roaming"],
  requirement: "Requires an MVNO host agreement and provisioning credentials.",
  futureResponsibilities: MNO_CONNECTIVITY_BOUNDARY.futureResponsibilities,
};

export const PHYSICAL_SIM_CONNECTIVITY_BOUNDARY: FutureProviderBoundary = {
  id: "physical-sim-future",
  mechanism: "physical_sim",
  name: "Physical SIM Connectivity Provider (future)",
  capabilities: ["voice", "messaging", "data", "physical_sim"],
  requirement: "Requires SIM inventory, logistics and a carrier association.",
  futureResponsibilities: [
    "SIM inventory",
    "ICCID assignment",
    "IMSI",
    "Activation",
    "Shipping",
    "Replacement",
    "Suspension",
    "Carrier association",
  ],
};

export const SIP_CONNECTIVITY_BOUNDARY: FutureProviderBoundary = {
  id: "sip-future",
  mechanism: "sip",
  name: "SIP Connectivity Provider (future)",
  capabilities: ["voice", "sip"],
  requirement: "Requires a SIP trunk or platform partnership.",
  futureResponsibilities: ["Trunk management", "Registration/auth", "Inbound routing", "Outbound routing"],
};

/** All future boundaries — consumed by ops/docs and the availability view. */
export const FUTURE_CONNECTIVITY_BOUNDARIES: readonly FutureProviderBoundary[] = [
  MNO_CONNECTIVITY_BOUNDARY,
  MVNO_CONNECTIVITY_BOUNDARY,
  PHYSICAL_SIM_CONNECTIVITY_BOUNDARY,
  SIP_CONNECTIVITY_BOUNDARY,
];
