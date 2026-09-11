// =============================================================================
// OneNumbr — Connectivity provider contract (Prompt 14)
//
// The ConnectivityProvider contract sits ABOVE mechanism-specific providers
// (the existing eSIM provider remains the real provisioning engine; the eSIM
// adapter wraps it — no duplicated provisioning logic).
//
//   ConnectivityService (lib/connectivity-server.ts)
//     ↓
//   ConnectivityProvider            ← this contract
//     ↓
//   CloudConnectivityProvider (demo) | EsimConnectivityProvider (adapter)
//     ↓
//   future MNO / MVNO / PhysicalSim / SIP providers (boundaries only)
// =============================================================================

import type {
  ConnectivityCapability,
  ConnectivityMechanism,
  ConnectivityStatus,
} from "@/types/connectivity";

/** Uniform provider operation result — demo results must identify themselves. */
export interface ConnectivityOperationResult {
  /** Registry id of the provider that performed (or refused) the op. */
  providerId: string;
  /** e.g. MOCK-CX-XXXX for demo providers. */
  providerReference: string | null;
  status: ConnectivityStatus;
  /** Demo/live marker — demo results must set true. */
  demo: boolean;
  note: string | null;
}

export interface ConnectivityProvider {
  readonly id: string;
  readonly mechanism: ConnectivityMechanism;
  readonly name: string;
  /** Demo providers must set true; the registry refuses live without flags. */
  readonly demo: boolean;
  readonly capabilities: ConnectivityCapability[];
  /** Regions this provider can serve; ["*"] = region-neutral (demo). */
  readonly regions: string[];
  provision(input: { uid: string; connectionId: string; region: string | null }): Promise<ConnectivityOperationResult>;
  activate(input: { connectionId: string; providerReference: string | null }): Promise<ConnectivityOperationResult>;
  suspend(input: { connectionId: string; providerReference: string | null }): Promise<ConnectivityOperationResult>;
  resume(input: { connectionId: string; providerReference: string | null }): Promise<ConnectivityOperationResult>;
  terminate(input: { connectionId: string; providerReference: string | null }): Promise<ConnectivityOperationResult>;
}
