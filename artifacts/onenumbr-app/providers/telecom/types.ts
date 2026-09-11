// =============================================================================
// OneNumbr — Telecom provider contract (Prompt 4)
//
// A real carrier/vendor adapter implements this interface and registers in
// providers/index.ts — the marketplace UI, checkout, number service and API
// routes never change. Voice/SMS delivery is intentionally not implemented;
// sendSms/makeCall/configureWebhook exist so future phases slot in without
// reshaping the contract.
// =============================================================================

export interface TelecomNumberCapabilities {
  sms: boolean;
  voice: boolean;
  mms?: boolean;
  sip?: boolean;
}

export type TelecomNumberType = "mobile" | "local" | "toll_free" | "international";

export interface TelecomNumber {
  /** Vendor-side unique number reference. */
  providerNumber: string;
  /** E.164-ish application number the vendor exposes. */
  number: string;
  countryCode: string;
  region: string;
  type: TelecomNumberType;
  capabilities: TelecomNumberCapabilities;
  /** Monthly recurring cost in minor units (vendor pricing). */
  monthlyPriceMinor: number;
  currency: string;
  available: boolean;
}

export type TelecomReservationStatus =
  | "reserved"
  | "released"
  | "expired"
  | "converted"
  | "failed";

export interface TelecomReservation {
  reservationRef: string;
  providerNumber: string;
  status: TelecomReservationStatus;
  expiresAt: number;
}

export type TelecomActivationStatus =
  | "active"
  | "suspended"
  | "released"
  | "failed";

export interface TelecomActivation {
  providerNumber: string;
  status: TelecomActivationStatus;
  activeFrom: number;
}

/**
 * Methods a real telecom provider adapter must implement. Critical V1
 * operations: search / reserve / purchase / assign / release / status.
 */
export interface TelecomProvider {
  readonly name: string;

  searchNumbers(input: {
    countryCode: string;
    /** Prefix/pattern hint, e.g. "284" (contains-match is vendor-specific). */
    contains?: string;
    type?: TelecomNumberType;
    /** Vendor paging token if supported. */
    pageToken?: string;
    limit?: number;
  }): Promise<{ numbers: TelecomNumber[]; nextPageToken?: string }>;

  getNumber(input: { providerNumber: string }): Promise<TelecomNumber>;

  reserveNumber(input: {
    providerNumber: string;
    uid: string;
    /** Vendor hold duration hint in seconds. */
    ttlSeconds?: number;
  }): Promise<TelecomReservation>;

  releaseReservation(input: { reservationRef: string }): Promise<void>;

  purchaseNumber(input: {
    providerNumber: string;
    orderRef: string;
  }): Promise<{ providerOrderId: string }>;

  assignNumber(input: {
    providerNumber: string;
    uid: string;
  }): Promise<{ assignedAt: number }>;

  releaseNumber(input: { providerNumber: string }): Promise<{
    releasedAt: number;
  }>;

  getNumberStatus(input: {
    providerNumber: string;
  }): Promise<TelecomActivationStatus>;

  // ---- Future phases (declared, not implemented by the mock beyond errors) --
  sendSms?(input: {
    from: string;
    to: string;
    body: string;
  }): Promise<{ messageId: string }>;
  makeCall?(input: { from: string; to: string }): Promise<{ callId: string }>;
  configureWebhook?(input: {
    providerNumber: string;
    url: string;
  }): Promise<void>;
}
