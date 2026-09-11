// =============================================================================
// OneNumbr — Future-domain service placeholders
//
// These modules define the service surface for domains that arrive in
// Prompts 2–5. They intentionally contain NO business logic and NO fake
// data — only typed interfaces, honest "not available" errors, and notes
// about where the real implementation will live. Pages that call them get
// consistent, honest empty states.
// =============================================================================

import { appError } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Number service (Prompt 4 — OneNumbr number management)
// ---------------------------------------------------------------------------
export interface ActivateNumberInput {
  uid: string;
  /** ISO country for the number, e.g. "US". */
  country: string;
  /** Preferred area/range, provider-dependent; optional. */
  preference?: string;
}

export const numberService = {
  /** Real activation arrives with telecom provider integration (Prompt 4). */
  async activateNumber(_input: ActivateNumberInput): Promise<never> {
    throw appError(
      "server",
      "numberService.activateNumber: telecom integration not yet available (Prompt 4)",
    );
  },
};

// ---------------------------------------------------------------------------
// NOTE: kycService is now a real implementation (services/kycService.ts).
// It was removed from these placeholders in Prompt 2.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// eSIM service (Prompt 3 — real marketplace)
// ---------------------------------------------------------------------------
export const esimService = {
  /** Real marketplace arrives with eSIM provider integration (Prompt 3). */
  async searchPlans(_input: { country: string }): Promise<never> {
    throw appError(
      "server",
      "esimService.searchPlans: eSIM provider integration not yet available (Prompt 3)",
    );
  },
};

// ---------------------------------------------------------------------------
// Payment service (Prompt 5 — billing; later Stripe)
// ---------------------------------------------------------------------------
export const paymentService = {
  /** Real payments arrive in Prompt 5 (Stripe). */
  async createCheckout(_uid: string): Promise<never> {
    throw appError(
      "server",
      "paymentService.createCheckout: payments not yet available (Prompt 5)",
    );
  },
};

// ---------------------------------------------------------------------------
// Notification service (future — in-app + email notifications)
// ---------------------------------------------------------------------------
export const notificationService = {
  /** Notification center arrives in a later prompt. */
  async listNotifications(_uid: string): Promise<never> {
    throw appError(
      "server",
      "notificationService.listNotifications: not yet available",
    );
  },
};
