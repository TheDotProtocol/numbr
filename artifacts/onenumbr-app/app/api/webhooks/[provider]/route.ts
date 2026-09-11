// =============================================================================
// /api/webhooks/[provider] — provider webhook boundary (Prompt 15)
//
// ARCHITECTURAL BOUNDARY — not implemented as a live provider webhook today.
//
// When a real provider is configured, the handler for /api/webhooks/<provider>
// MUST:
//   1. Verify the provider signature (verifyProviderWebhookSignature()) with the
//      provider-specific scheme and the stored webhook secret.
//   2. Validate the provider timestamp and reject replays outside the allowed
//      window (validateProviderWebhookTimestamp()).
//   3. Dedup by provider event id (isEventAlreadyProcessed()) so provider
//      retries do not create duplicate effects.
//   4. Normalize the raw provider event to a OneNumbr domain event
//      (normalizeProviderEvent()) — provider-specific error messages must never
//      leak to customers.
//   5. Call handleNormalizedProviderEvent() — the ONLY safe path that may act,
//      which audits and routes notifications but never mutates customer data
//      directly from the webhook payload.
//   6. Never log, store or return secrets, tokens, signed URLs, raw payloads or
//      KYC content.
//
// This file exists so the route shape, auth and contract are in place. Real
// provider webhooks are enabled only when a provider is configured AND the
// corresponding real-provider flag is set. Until then, requests here are
// rejected honestly.
//
// Security notes:
//   - The webhook secret must NEVER be client-readable or committed.
//   - The provider event id is used for idempotency; do not key on mutable
//     customer fields.
//   - The handler does not trust the client to say which customer is affected —
//     it matches the target ref to a customer record server-side.
// =============================================================================

import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  // No real provider webhook is enabled yet.
  return NextResponse.json(
    {
      error: "provider_webhook_not_configured",
      message: "No provider webhook is configured at this path yet. Future real providers will authenticate, validate, normalize and audit provider events through this route.",
    },
    { status: 503 },
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  // Webhooks are inbound-only; a GET here is not meaningful.
  return NextResponse.json(
    {
      error: "method_not_allowed",
      message: "Provider webhooks are inbound-only. POST events to this route when a provider is configured.",
    },
    { status: 405 },
  );
}
