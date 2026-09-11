// =============================================================================
// OneNumbr — MockPaymentProvider
//
// Deterministic success in development. No card data, no credentials, no
// external calls exist anywhere in this flow. The checkout UI presents this
// honestly as "Demo Payment".
// =============================================================================

import type { PaymentIntent, PaymentProvider } from "./types";

function mockPaymentId(orderRef: string): string {
  let h = 0;
  for (let i = 0; i < orderRef.length; i++) h = (h * 31 + orderRef.charCodeAt(i)) >>> 0;
  return `MOCK-PAY-${h.toString(36).toUpperCase()}`;
}

export const mockPaymentProvider: PaymentProvider = {
  name: "mock",

  async createPaymentIntent(input): Promise<PaymentIntent> {
    return {
      provider: "mock",
      providerPaymentId: mockPaymentId(input.orderRef),
      status: "requires_confirmation",
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
  },

  async confirmPayment({ providerPaymentId }) {
    // Deterministic FAILURE TEST trigger: a payment intent whose orderRef
    // contains "fail" always fails — lets teams exercise the payment-failure
    // path on demand without random behaviour. All other intents succeed.
    if (providerPaymentId.toUpperCase().includes("FAIL")) {
      return { status: "failed", providerPaymentId };
    }
    return { status: "succeeded", providerPaymentId };
  },

  async refundPayment({ providerPaymentId }) {
    void providerPaymentId;
    return { status: "refunded" };
  },
};
