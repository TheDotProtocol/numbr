// =============================================================================
// OneNumbr — MockEsimProvider
//
// Development implementation of the EsimProvider contract. Everything it
// produces is clearly marked as demo data and cannot be mistaken for a live
// carrier activation (ICCID prefix "89DEMO", LPA string uses "mock.smdp").
// A real provider adapter will implement the same interface and be
// registered in providers/index.ts — no UI or service changes required.
// =============================================================================

import { randomUUID } from "crypto";
import type {
  EsimProvider,
  EsimProvisionResult,
  EsimUsageSnapshot,
} from "./types";

/** Simulated usage: 6%–20% consumed, deterministic per ICCID. */
function simulateUsageMb(iccid: string, totalMb: number): number {
  let hash = 0;
  for (let i = 0; i < iccid.length; i++) hash = (hash * 31 + iccid.charCodeAt(i)) >>> 0;
  const pct = 0.06 + (hash % 14) / 100;
  return Math.round(totalMb * pct);
}

/**
 * Provision a demo eSIM. Deterministic, clearly-marked mock values:
 *   providerEsimId : MOCK-xxxxxxxx
 *   iccid          : 89DEMO… (real ICCIDs start 89 but never "89DEMO")
 *   matchingId     : MOCK-MATCH-xxxxxxxx
 *   smdpAddress    : mock.smdp.onenumbr.dev (reserved TLD-style, non-routable)
 *   activationCode : LPA:1$mock.smdp.onenumbr.dev$MOCK-MATCH-xxxxxxxx
 */
export function mockProvision(input: {
  providerOrderRef: string;
  providerPlanId?: string;
}): EsimProvisionResult {
  // Deterministic failure path for the seeded "Provisioning Failure Test"
  // sandbox plan — its providerPlanId contains "FAIL" (MOCK-FAIL-PROVISION)
  // and lets teams exercise failure recovery + admin retry on demand.
  if (input.providerPlanId?.toUpperCase().includes("FAIL")) {
    throw new Error("MOCK: simulated provisioning failure (sandbox plan)");
  }
  const rid = randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  const matchingId = `MOCK-MATCH-${rid}`;
  const smdpAddress = "mock.smdp.onenumbr.dev";
  const iccid = `89DEMO${(hash32(input.providerOrderRef) % 10_000_000_000).toString().padStart(10, "0")}0`;
  const activationCode = `LPA:1$${smdpAddress}$${matchingId}`;

  return {
    providerOrderRef: input.providerOrderRef,
    activationCode,
    qrPayload: activationCode,
    iccid,
    activationDetailsUrl: `https://mock.onenumbr.dev/esim/${rid}`,
  };
}

function hash32(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function mockUsage(iccid: string, totalMb: number, durationDays: number): EsimUsageSnapshot {
  const usedMb = simulateUsageMb(iccid, totalMb);
  return {
    usedMb,
    totalMb,
    expiresAt: Date.now() + durationDays * 24 * 60 * 60 * 1000,
  };
}

/**
 * Full MockEsimProvider. Catalog methods intentionally return empty/typed
 * stubs — the authoritative catalog lives in Firestore (esim_plans) and is
 * joined by the service layer; the provider contract keeps them so a real
 * provider's catalog API can be mapped onto the same calls later.
 */
export const mockEsimProvider: EsimProvider = {
  name: "mock",

  async searchPlans({ countryIso }) {
    // Demo provider has no external catalog; the Firestore catalog is
    // authoritative. Returned empty so callers never see fake plans here.
    void countryIso;
    return [];
  },

  async getPlan(providerPlanId: string) {
    throw new Error(
      `mock provider holds no external catalog (${providerPlanId}) — use the Firestore catalog`,
    );
  },

  async createOrder(input) {
    return { providerOrderRef: `MOCK-ORDER-${hash32(input.uid + input.providerPlanId).toString(36).toUpperCase()}` };
  },

  async provisionEsim(input) {
    return mockProvision(input); // sync core; async per contract
  },

  async getActivationDetails({ providerOrderRef }) {
    return mockProvision({ providerOrderRef });
  },

  async getUsage({ iccid }) {
    return {
      usedMb: simulateUsageMb(iccid, 20 * 1024),
      totalMb: 20 * 1024,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
  },

  async suspendEsim() {
    /* demo: no-op */
  },

  async cancelEsim() {
    /* demo: no-op */
  },
};
