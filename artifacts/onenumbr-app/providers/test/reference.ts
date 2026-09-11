// =============================================================================
// OneNumbr — Reference (test) connectivity provider (Prompt 15)
//
// A deterministic test provider that implements the ConnectivityProvider
// contract and lets tests simulate provider behaviour WITHOUT hardcoding
// mock responses throughout the application. It is NOT a real provider and
// never reaches a network — it is a pure function of its configuration.
//
// Use it in provider contract tests:
//   - happy path: provision → active
//   - transient failure: activate fails once, then succeeds on retry
//   - permanent failure: provisioning always fails
//   - timeout: an operation exceeds the given timeout
//   - duplicate request: the second call returns conflict
//   - invalid configuration: provider refuses invalid input
//
// IMPORTANT: this file is test/seed-only. It is NOT imported by application
// servers by default. Real provider wires happen in providers/index.ts when a
// vendor is configured.
// =============================================================================

import type { ConnectivityOperationResult, ConnectivityProvider } from "@/providers/connectivity/types";
import type { ConnectivityStatus } from "@/types/connectivity";

// ---------------------------------------------------------------------------
// Reference provider configuration
// ---------------------------------------------------------------------------

export type ReferenceProviderConfig = {
  /** Stable id + human label for the test run. */
  id: string;
  name: string;
  /** What the provider will behave like. */
  behavior:
    | "always-success"
    | "provisioning-failure"
    | "activation-failure"
    | "transient-failure-then-success"
    | "timeout"
    | "duplicate-reject"
    | "invalid-input-reject";
  /** Capabilities the provider declares (for capability-contracted tests). */
  capabilities?: readonly string[];
  /** Regions the provider declares. */
  regions?: readonly string[];
  /** If true, every result is explicitly demo-labeled. */
  demo?: boolean;
  /** Artificial latency (ms) before each operation returns. */
  latencyMs?: number;
};

// ---------------------------------------------------------------------------
// Reference provider implementation
// ---------------------------------------------------------------------------

export function createReferenceConnectivityProvider(config: ReferenceProviderConfig): ConnectivityProvider {
  let callCount = 0;
  const capabilities = config.capabilities ?? ["voice", "messaging", "data"];
  const regions = config.regions ?? ["*"];

  return {
    id: config.id,
    mechanism: "cloud",
    name: config.name,
    demo: config.demo ?? true,
    capabilities: capabilities as any,
    regions: regions as any,

    async provision(input) {
      return runOp(config, () => {
        callCount++;
        if (config.behavior === "provisioning-failure") {
          return failureResult(config, "failed", "provisioning failed (simulated permanent failure)", input);
        }
        if (config.behavior === "timeout") {
          return timeoutResult(config, "provisioning", input);
        }
        if (config.behavior === "duplicate-reject" && callCount > 1) {
          return failureResult(config, "failed", "duplicate request rejected (simulated)", input);
        }
        if (config.behavior === "invalid-input-reject" && !input.region) {
          return failureResult(config, "failed", "invalid input rejected (simulated)", input);
        }
        return successResult(config, "provisioning", "provisioning started (simulated)", input);
      });
    },

    async activate(input) {
      return runOp(config, () => {
        callCount++;
        if (config.behavior === "activation-failure") {
          return failureResult(config, "failed", "activation failed (simulated permanent failure)", input);
        }
        if (config.behavior === "timeout") {
          return timeoutResult(config, "active", input);
        }
        if (config.behavior === "transient-failure-then-success" && callCount === 1) {
          return failureResult(config, "failed", "temporary failure (simulated) — retry succeeds", input);
        }
        if (config.behavior === "duplicate-reject" && callCount > 1) {
          return failureResult(config, "failed", "duplicate request rejected (simulated)", input);
        }
        if (config.behavior === "invalid-input-reject" && !input.providerReference) {
          return failureResult(config, "failed", "invalid input rejected (simulated)", input);
        }
        return successResult(config, "active", "activated (simulated)", input);
      });
    },

    async suspend(input) {
      return runOp(config, () => {
        callCount++;
        if (config.behavior === "duplicate-reject" && callCount > 1) {
          return failureResult(config, "failed", "duplicate request rejected (simulated)", input);
        }
        return successResult(config, "suspended", "suspended (simulated)", input);
      });
    },

    async resume(input) {
      return runOp(config, () => {
        callCount++;
        if (config.behavior === "duplicate-reject" && callCount > 1) {
          return failureResult(config, "failed", "duplicate request rejected (simulated)", input);
        }
        return successResult(config, "active", "resumed (simulated)", input);
      });
    },

    async terminate(input) {
      return runOp(config, () => {
        callCount++;
        if (config.behavior === "duplicate-reject" && callCount > 1) {
          return failureResult(config, "failed", "duplicate request rejected (simulated)", input);
        }
        return successResult(config, "terminated", "terminated (simulated)", input);
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Operation runners
// ---------------------------------------------------------------------------

async function runOp<T>(config: ReferenceProviderConfig, fn: () => T): Promise<T> {
  const latency = config.latencyMs ?? 0;
  if (latency > 0) {
    await new Promise((resolve) => setTimeout(resolve, latency));
  }
  return fn();
}

function successResult(
  config: ReferenceProviderConfig,
  status: ConnectivityStatus,
  note: string,
  input: Record<string, unknown>,
): ConnectivityOperationResult {
  return {
    providerId: config.id,
    providerReference: `REF-${config.id}-${String(input.connectionId ?? "").slice(0, 8).toUpperCase()}`,
    status,
    demo: config.demo ?? true,
    note,
  };
}

function failureResult(
  config: ReferenceProviderConfig,
  status: ConnectivityStatus,
  note: string,
  input: Record<string, unknown>,
): ConnectivityOperationResult {
  return {
    providerId: config.id,
    providerReference: `REF-${config.id}-${String(input.connectionId ?? "").slice(0, 8).toUpperCase()}`,
    status,
    demo: config.demo ?? true,
    note,
  };
}

function timeoutResult(
  config: ReferenceProviderConfig,
  status: ConnectivityStatus,
  input: Record<string, unknown>,
): Promise<ConnectivityOperationResult> {
  // Simulate an operation that exceeds a short timeout. In a real async test,
  // this is enough to make an AbortSignal/timeout test observable.
  return new Promise((resolve) => {
    const latency = (config.latencyMs ?? 100) + 5000; // always exceeds a short test timeout
    setTimeout(() => {
      resolve({
        providerId: config.id,
        providerReference: `REF-${config.id}-TIMEOUT`,
        status,
        demo: config.demo ?? true,
        note: "operation timed out (simulated)",
      });
    }, latency);
  });
}

// ---------------------------------------------------------------------------
// Contract test helpers
// ---------------------------------------------------------------------------

/** Verifies a ConnectivityProvider implementation satisfies the contract
 *  surface expected by the connectivity engine. Use this in provider contract
 *  tests for every future provider adapter. */
export async function assertProviderContractSatisfied(provider: ConnectivityProvider): Promise<void> {
  // 1) The provider must expose stable, honest metadata.
  if (!provider.id) throw new Error("provider contract: missing id");
  if (!provider.name) throw new Error("provider contract: missing name");
  if (!Array.isArray(provider.capabilities)) throw new Error("provider contract: capabilities must be an array");
  if (!Array.isArray(provider.regions)) throw new Error("provider contract: regions must be an array");

  // 2) The provider must expose every lifecycle operation.
  if (typeof provider.provision !== "function") throw new Error("provider contract: missing provision");
  if (typeof provider.activate !== "function") throw new Error("provider contract: missing activate");
  if (typeof provider.suspend !== "function") throw new Error("provider contract: missing suspend");
  if (typeof provider.resume !== "function") throw new Error("provider contract: missing resume");
  if (typeof provider.terminate !== "function") throw new Error("provider contract: missing terminate");

  // 3) A successful provision must return a valid result shape.
  const provisionResult = await provider.provision({
    uid: "TEST-uid",
    connectionId: "TEST-CONN-001",
    region: "US",
  });
  if (!provisionResult.providerId) throw new Error("provider contract: provision missing providerId");
  if (!provisionResult.providerReference) throw new Error("provider contract: provision missing providerReference");
  if (!provisionResult.status) throw new Error("provider contract: provision missing status");
  if (typeof provisionResult.demo !== "boolean") throw new Error("provider contract: provision demo must be boolean");
  if (typeof provisionResult.note !== "string") throw new Error("provider contract: provision note must be a string");

  // 4) A successful activation must return a valid result shape.
  const activateResult = await provider.activate({
    connectionId: "TEST-CONN-001",
    providerReference: provisionResult.providerReference,
  });
  if (!activateResult.providerId) throw new Error("provider contract: activate missing providerId");
  if (!activateResult.providerReference) throw new Error("provider contract: activate missing providerReference");

  // 5) Every operation must return a result with the same honest shape.
  const suspendResult = await provider.suspend({ connectionId: "TEST-CONN-001", providerReference: activateResult.providerReference });
  const resumeResult = await provider.resume({ connectionId: "TEST-CONN-001", providerReference: activateResult.providerReference });
  const terminateResult = await provider.terminate({ connectionId: "TEST-CONN-001", providerReference: activateResult.providerReference });
  for (const r of [suspendResult, resumeResult, terminateResult]) {
    if (typeof r.demo !== "boolean") throw new Error("provider contract: op demo must be boolean");
  }
}

/** Creates a reference provider configured for a happy-path contract test. */
export function happyPathProvider(): ConnectivityProvider {
  return createReferenceConnectivityProvider({
    id: "reference-happy",
    name: "Reference Happy Path Provider",
    behavior: "always-success",
    capabilities: ["voice", "messaging", "data"],
    regions: ["*"],
    demo: true,
    latencyMs: 0,
  });
}

/** Creates a reference provider that fails provisioning permanently. */
export function provisioningFailureProvider(): ConnectivityProvider {
  return createReferenceConnectivityProvider({
    id: "reference-provisioning-failure",
    name: "Reference Provisioning Failure Provider",
    behavior: "provisioning-failure",
    capabilities: ["data"],
    regions: ["*"],
    demo: true,
  });
}

/** Creates a reference provider that fails activation permanently. */
export function activationFailureProvider(): ConnectivityProvider {
  return createReferenceConnectivityProvider({
    id: "reference-activation-failure",
    name: "Reference Activation Failure Provider",
    behavior: "activation-failure",
    capabilities: ["voice"],
    regions: ["*"],
    demo: true,
  });
}

/** Creates a reference provider that fails once then succeeds on retry. */
export function transientFailureProvider(): ConnectivityProvider {
  return createReferenceConnectivityProvider({
    id: "reference-transient",
    name: "Reference Transient Failure Provider",
    behavior: "transient-failure-then-success",
    capabilities: ["voice"],
    regions: ["*"],
    demo: true,
  });
}

/** Creates a reference provider whose operations exceed a short timeout. */
export function timeoutProvider(): ConnectivityProvider {
  return createReferenceConnectivityProvider({
    id: "reference-timeout",
    name: "Reference Timeout Provider",
    behavior: "timeout",
    capabilities: ["voice"],
    regions: ["*"],
    demo: true,
    latencyMs: 10,
  });
}

/** Creates a reference provider that rejects duplicate requests. */
export function duplicateRequestProvider(): ConnectivityProvider {
  return createReferenceConnectivityProvider({
    id: "reference-duplicate",
    name: "Reference Duplicate Request Provider",
    behavior: "duplicate-reject",
    capabilities: ["voice"],
    regions: ["*"],
    demo: true,
  });
}

/** Creates a reference provider that rejects invalid input. */
export function invalidInputProvider(): ConnectivityProvider {
  return createReferenceConnectivityProvider({
    id: "reference-invalid-input",
    name: "Reference Invalid Input Provider",
    behavior: "invalid-input-reject",
    capabilities: ["voice"],
    regions: ["*"],
    demo: true,
  });
}
