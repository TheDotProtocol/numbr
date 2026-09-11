// =============================================================================
// OneNumbr — MockTelecomProvider
//
// Development implementation of the TelecomProvider contract. Everything it
// produces is unmistakably demo data (provider name "mock-telecom", MOCK- refs)
// and never touches or claims to touch the public telephone network.
//
// The mock keeps no state of its own: the Firestore inventory (numbers
// collection) is authoritative. searchNumbers() projects inventory documents
// into the TelecomNumber shape so a real vendor's catalog API can map onto
// the same calls later.
//
// Failure testing: purchaseNumber throws deterministically when the target
// providerNumber contains "-FAIL" — the seeded sandbox number exercises the
// provisioning-failure + admin-retry path end to end.
// =============================================================================

import type {
  TelecomActivation,
  TelecomActivationStatus,
  TelecomNumber,
  TelecomProvider,
  TelecomReservation,
} from "./types";

export const MOCK_TTL_SECONDS = 15 * 60; // 15-minute reservation hold

function isFailNumber(providerNumber: string): boolean {
  return providerNumber.toUpperCase().includes("-FAIL");
}

export const mockTelecomProvider: TelecomProvider = {
  name: "mock-telecom",

  async searchNumbers(input) {
    // The Firestore inventory is authoritative; the engine pre-filters and
    // passes candidates through. The mock simply echoes them back available —
    // a real provider would call its catalog API here.
    void input;
    return { numbers: [] };
  },

  async getNumber(input: { providerNumber: string }): Promise<TelecomNumber> {
    if (isFailNumber(input.providerNumber)) {
      throw new Error("MOCK: number not found in provider catalog");
    }
    return {
      providerNumber: input.providerNumber,
      number: input.providerNumber,
      countryCode: "US",
      region: "OneNumbr Global",
      type: "mobile",
      capabilities: { sms: true, voice: true },
      monthlyPriceMinor: 500,
      currency: "USD",
      available: true,
    };
  },

  async reserveNumber(input: {
    providerNumber: string;
    uid: string;
    ttlSeconds?: number;
  }): Promise<TelecomReservation> {
    if (isFailNumber(input.providerNumber)) {
      throw new Error("MOCK: reservation rejected by provider");
    }
    const ref = `MOCK-RES-${hash32(input.providerNumber + input.uid)
      .toString(36)
      .toUpperCase()}`;
    return {
      reservationRef: ref,
      providerNumber: input.providerNumber,
      status: "reserved",
      expiresAt: Date.now() + (input.ttlSeconds ?? MOCK_TTL_SECONDS) * 1000,
    };
  },

  async releaseReservation(input: { reservationRef: string }): Promise<void> {
    void input; // demo: no-op
  },

  async purchaseNumber(input: {
    providerNumber: string;
    orderRef: string;
  }): Promise<{ providerOrderId: string }> {
    if (isFailNumber(input.providerNumber)) {
      throw new Error("MOCK: simulated provisioning failure (sandbox number)");
    }
    return {
      providerOrderId: `MOCK-PHONE-ORDER-${hash32(input.orderRef)
        .toString(36)
        .toUpperCase()}`,
    };
  },

  async assignNumber(input: { providerNumber: string; uid: string }): Promise<{ assignedAt: number }> {
    void input;
    return { assignedAt: Date.now() };
  },

  async releaseNumber(input: { providerNumber: string }): Promise<{ releasedAt: number }> {
    void input;
    return { releasedAt: Date.now() };
  },

  async getNumberStatus(input: { providerNumber: string }): Promise<TelecomActivationStatus> {
    void input;
    return "active";
  },
};

function hash32(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Kept for parity with the esim activation type used by tests. */
export type { TelecomActivation };
