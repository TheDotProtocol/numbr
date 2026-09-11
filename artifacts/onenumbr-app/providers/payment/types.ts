// =============================================================================
// OneNumbr — Payment provider contract
//
// Prompt 3 ships MockPaymentProvider (deterministic success, zero real
// payment data). A StripePaymentProvider will implement this same interface
// and register in providers/index.ts — checkout code never changes.
// =============================================================================

export interface PaymentIntent {
  provider: string;
  /** Provider's payment reference (e.g. Stripe PaymentIntent id later). */
  providerPaymentId: string;
  /** "requires_confirmation" today; "requires_action" with real Stripe. */
  status: "requires_confirmation" | "requires_action" | "succeeded";
  amountMinor: number;
  currency: string;
}

export interface PaymentProvider {
  readonly name: string;
  createPaymentIntent(input: {
    orderRef: string;
    amountMinor: number;
    currency: string;
    description: string;
  }): Promise<PaymentIntent>;
  confirmPayment(input: { providerPaymentId: string }): Promise<{
    status: "succeeded" | "failed";
    providerPaymentId: string;
  }>;
  refundPayment(input: { providerPaymentId: string; amountMinor?: number }): Promise<{
    status: "refunded";
  }>;
  /** Optional — future phases (declared so adapters can grow without breaking). */
  capturePayment?(input: { providerPaymentId: string }): Promise<{ status: "succeeded" | "failed" }>;
  cancelPayment?(input: { providerPaymentId: string }): Promise<{ status: "cancelled" }>;
  getPaymentStatus?(input: {
    providerPaymentId: string;
  }): Promise<{ status: "pending" | "succeeded" | "failed" | "refunded" }>;
}
