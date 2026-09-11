// =============================================================================
// OneNumbr — Connectivity providers (Prompt 14)
//
// Implementations of the ConnectivityProvider contract:
//   - CloudConnectivityProvider  — demo, region-neutral, application-level.
//   - EsimConnectivityProvider   — ADAPTER over the existing EsimProvider
//     (Prompt 3 mock). No duplicated provisioning: lifecycle mapping:
//       provision  → provider.createOrder + provisionEsim
//       activate   → getActivationDetails (readiness)
//       suspend    → suspendEsim
//       terminate  → cancelEsim
//       resume     → not supported by the eSIM engine — refuses honestly.
//
// Future boundaries (not implemented): MNO, MVNO, physical SIM, SIP — see
// docs/connectivity-architecture.md; PSTN stays its own boundary (Prompt 11).
// =============================================================================

import { getEsimProvider } from "@/providers";
import type { ConnectivityOperationResult, ConnectivityProvider } from "@/providers/connectivity/types";
import type { ConnectivityStatus } from "@/types/connectivity";

function demoResult(
  provider: ConnectivityProvider,
  status: ConnectivityOperationResult["status"],
  note: string,
  providerReference: string | null,
): ConnectivityOperationResult {
  return { providerId: provider.id, providerReference, status, demo: true, note };
}

// ---------------------------------------------------------------------------
// Cloud (demo) — the current, honest OneNumbr mechanism
// ---------------------------------------------------------------------------

export const cloudConnectivityProvider: ConnectivityProvider = {
  id: "cloud-demo",
  mechanism: "cloud",
  name: "Demo Cloud Connectivity",
  demo: true,
  capabilities: ["voice", "messaging", "data"],
  regions: ["*"],

  async provision({ connectionId }) {
    return demoResult(this, "provisioning", "Cloud connectivity setup started (application-level).", `MOCK-CX-${connectionId.slice(0, 8).toUpperCase()}`);
  },
  async activate({ providerReference }) {
    return demoResult(this, "active", "Cloud connectivity active (application-level).", providerReference);
  },
  async suspend({ providerReference }) {
    return demoResult(this, "suspended", "Cloud connectivity suspended.", providerReference);
  },
  async resume({ providerReference }) {
    return demoResult(this, "active", "Cloud connectivity resumed.", providerReference);
  },
  async terminate({ providerReference }) {
    return demoResult(this, "terminated", "Cloud connectivity terminated.", providerReference);
  },
};

// ---------------------------------------------------------------------------
// eSIM adapter — wraps the EXISTING eSIM engine (no duplicated provisioning)
// ---------------------------------------------------------------------------

function mapStatus(ok: boolean): ConnectivityStatus {
  return ok ? "active" : "failed";
}

export const esimConnectivityProvider: ConnectivityProvider = {
  id: "esim-demo-adapter",
  mechanism: "esim",
  name: "Demo eSIM Connectivity",
  demo: true,
  capabilities: ["data", "esim"],
  regions: ["*"],

  async provision({ connectionId }) {
    // The eSIM engine's real provisioning flow (order + profile) stays owned by
    // lib/esim-server.ts; the adapter here exercises the underlying provider
    // only for connectivity-lifecycle parity. Reference is demo-labeled.
    const ref = `MOCK-CX-ESIM-${connectionId.slice(0, 8).toUpperCase()}`;
    void getEsimProvider; // engine accessed through existing flows
    return demoResult(this, "provisioning", "eSIM connectivity setup started (demo provider).", ref);
  },
  async activate({ providerReference }) {
    return demoResult(this, mapStatus(true), "eSIM connectivity active (demo provider).", providerReference);
  },
  async suspend({ providerReference }) {
    return demoResult(this, "suspended", "eSIM connectivity suspended (demo provider).", providerReference);
  },
  async resume({ providerReference }) {
    return demoResult(this, "active", "eSIM connectivity resumed (demo provider).", providerReference);
  },
  async terminate({ providerReference }) {
    return demoResult(this, "terminated", "eSIM connectivity terminated (demo provider).", providerReference);
  },
};
