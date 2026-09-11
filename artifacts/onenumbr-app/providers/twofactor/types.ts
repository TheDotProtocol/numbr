// =============================================================================
// OneNumbr — Two-factor provider contract (architecture only in Prompt 6)
//
// No implementation is registered and no second factor is enforced. The
// account security UI reads the provider registry's availability and shows
// honest states ("Coming soon" / "Setup unavailable in this environment").
//
// Future adapters (authenticator app/TOTP, passkeys/WebAuthn, SMS, email)
// implement this interface and register in providers/index.ts — the account
// security UI needs no changes.
// =============================================================================

export type TwoFactorMethod = "authenticator_app" | "passkey" | "sms" | "email";

export interface TwoFactorEnrollment {
  /** Provider-side enrollment reference (e.g. TOTP secret id / credential id). */
  enrollmentRef: string;
  method: TwoFactorMethod;
  /** Human-readable label for the enrolled factor ("iPhone 15 · Authenticator"). */
  label: string;
  createdAt: number;
}

export interface TwoFactorChallenge {
  challengeId: string;
  method: TwoFactorMethod;
  expiresAt: number;
}

export interface TwoFactorProvider {
  readonly name: string;
  /** Whether this provider can actually operate in the current environment. */
  readonly available: boolean;
  startEnrollment(input: {
    uid: string;
    method: TwoFactorMethod;
  }): Promise<{ enrollment: TwoFactorEnrollment; /** QR/secret data when applicable. */ secret?: string; uri?: string }>;
  confirmEnrollment(input: { uid: string; enrollmentRef: string; code: string }): Promise<TwoFactorEnrollment>;
  createChallenge(input: { uid: string; method: TwoFactorMethod }): Promise<TwoFactorChallenge>;
  verifyChallenge(input: { uid: string; challengeId: string; code: string }): Promise<{ verified: boolean }>;
  listEnrollments(input: { uid: string }): Promise<TwoFactorEnrollment[]>;
  revokeEnrollment(input: { uid: string; enrollmentRef: string }): Promise<void>;
}

/**
 * Placeholder until a real provider phase. `available: false` makes the UI
 * show an honest unavailable state; methods throw instead of faking success.
 */
export const placeholderTwoFactorProvider: TwoFactorProvider = {
  name: "placeholder",
  available: false,
  async startEnrollment() {
    throw new Error("two-factor enrollment unavailable in this environment");
  },
  async confirmEnrollment() {
    throw new Error("two-factor enrollment unavailable in this environment");
  },
  async createChallenge() {
    throw new Error("two-factor challenge unavailable in this environment");
  },
  async verifyChallenge() {
    return { verified: false };
  },
  async listEnrollments() {
    return [];
  },
  async revokeEnrollment() {
    throw new Error("two-factor unavailable in this environment");
  },
};
