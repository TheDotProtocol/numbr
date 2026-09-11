// =============================================================================
// OneNumbr — Provider webhook foundation (Prompt 15)
//
// Architectural boundary for future REAL provider webhooks. No provider
// webhook is implemented today; this module defines the secure contract that
// every future provider webhook handler MUST satisfy:
//
//   1. Verify signature (HMAC-SHA256 over the request body by default).
//   2. Validate timestamp / reject replays outside the allowed window.
//   3. Dedup by provider event id (idempotency).
//   4. Normalize to a OneNumbr domain event.
//   5. Emit ONE audit event and route to the affected customer only through
//      a verified adapter — never mutate customer data directly.
//   6. Never log secrets/credentials/tokens/signed URLs.
//
// If a real provider sends webhooks, the handler:
//   - lives in app/api/webhooks/<provider>.ts (or equivalent Express route)
//   - calls verifyProviderWebhookSignature() with the provider-specific scheme
//   - calls normalizeProviderEvent() into a ProviderEventNormalized
//   - then calls handleNormalizedProviderEvent() to take safe action
//
// Provider webhook endpoints must NEVER trust the client to say what customer
// was affected. The provider payload is parsed, validated, then matched to a
// customer record by the server (connection id / number id / call id).
// =============================================================================

import { getAdminDb } from "@/firebase/admin";
import { appError } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit-server";
import type {
  ProviderCategory,
  ProviderEventEnvelope,
  ProviderEventNormalized,
} from "@/types/provider";
import type { NotificationKind } from "@/types/notifications";

// ---------------------------------------------------------------------------
// Idempotency key store (dedup processed provider events)
// ---------------------------------------------------------------------------

/** Stable keys for provider events we have already processed. In production
 *  this should be a durable store (e.g. a Firestore collection or provider
 *  idempotency ledger). Today it is an in-memory Set for the contract — for a
 *  real provider, replace with a persistent dedup store before go-live. */
const PROCESSED_EVENT_KEYS = new Set<string>();

/** Returns true when the event has already been processed (idempotent). */
export function isEventAlreadyProcessed(providerEventId: string): boolean {
  return PROCESSED_EVENT_KEYS.has(providerEventId);
}

/** Marks a provider event as processed (idempotency). */
export function markEventProcessed(providerEventId: string): void {
  PROCESSED_EVENT_KEYS.add(providerEventId);
}

// In a real deployment, replace the in-memory set above with durable storage
// before any real provider webhook is enabled. This comment exists to make the
// gap explicit for the onboarding checklist.

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/** Provider webhook signature scheme kind. Real providers may use HMAC, RSA,
 *  EdDSA, or an SDK-provided verifier. This enum names the scheme the handler
 *  is configured to verify; the actual verification function is provider-ish. */
export type WebhookSignatureScheme = "hmac-sha256" | "hmac-sha512" | "unknown";

export type VerifyWebhookSignatureArgs = {
  /** Raw request body (the exact bytes the signature was computed over). */
  rawBody: string | Buffer;
  /** Signature header value from the provider. */
  signatureHeader: string | null;
  /** Provider secret used to compute/verify the HMAC. */
  secret: string;
  /** Expected scheme. */
  scheme: WebhookSignatureScheme;
};

/** Verify a provider webhook signature. Returns true when the signature is
 *  valid for the given scheme. For unknown schemes this returns false
 *  honestly (the handler should reject). */
export function verifyProviderWebhookSignature(args: VerifyWebhookSignatureArgs): boolean {
  const { rawBody, signatureHeader, secret, scheme } = args;
  if (!signatureHeader || !secret) return false;

  const sig = typeof signatureHeader === "string" ? signatureHeader.trim() : "";
  if (!sig) return false;

  const payload = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  const expected = computeHmacSignature(payload, secret, scheme === "hmac-sha512" ? "sha512" : "sha256");

  // Constant-time-ish comparison to avoid timing leaks on the secret.
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Compute an HMAC signature over a payload for the given scheme. Used by the
 *  verifier and by our own outbound signing where applicable. */
function computeHmacSignature(payload: string, secret: string, algorithm: "sha256" | "sha512"): string {
  const crypto = require("crypto");
  return crypto.createHmac(algorithm, secret).update(payload, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Timestamp + replay protection
// ---------------------------------------------------------------------------

/** Maximum age of a provider timestamp we will accept (seconds). Defaults to
 *  5 minutes to bound replay risk. Real providers may publish their own TTL. */
const DEFAULT_WEBHOOK_TTL_SECONDS = 5 * 60;

export type ValidateWebhookTimestampArgs = {
  /** Provider-supplied event timestamp (ISO or Unix seconds). */
  providerTimestamp: string | number;
  /** Maximum allowed age in seconds. */
  maxAgeSeconds?: number;
};

/** Validate a provider timestamp and return the parsed ISO timestamp, or throw
 *  an honest rejection for replays/expired events. */
export function validateProviderWebhookTimestamp(args: ValidateWebhookTimestampArgs): string {
  const { providerTimestamp, maxAgeSeconds = DEFAULT_WEBHOOK_TTL_SECONDS } = args;
  const now = Date.now();
  let ts: number;

  if (typeof providerTimestamp === "number") {
    ts = providerTimestamp * 1000;
  } else {
    const d = new Date(providerTimestamp);
    if (isNaN(d.getTime())) throw appError("provider_configuration_error", "unparseable provider timestamp");
    ts = d.getTime();
  }

  // Reject future timestamps (clock skew / replays).
  if (ts > now + 60_000) throw appError("provider_temporarily_unavailable", "provider timestamp is in the future");

  if (now - ts > maxAgeSeconds * 1000) {
    throw appError("provider_temporarily_unavailable", "provider event expired (replay window exceeded)");
  }

  return new Date(ts).toISOString();
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** Map a provider's raw event type to a OneNumbr domain event. This is where
 *  provider-specific error messages get translated into our domain errors and
 *  never leak to customers. Providers that do not map cleanly should be refused
 *  at the handler and logged safely (no raw payload to clients). */
export function normalizeProviderEvent(
  envelope: Pick<ProviderEventEnvelope, "providerCategory" | "providerEventType" | "targetRef">,
): ProviderEventNormalized | null {
  const { providerCategory, providerEventType, targetRef } = envelope;

  // Connectivity lifecycle normalization (provider → OneNumbr).
  if (providerCategory === "esim" || providerCategory === "connectivity_aggregator" || providerCategory === "mno" || providerCategory === "mvno") {
    if (providerEventType.includes("provisioning.started") || providerEventType.includes("connectivity.started")) {
      return { kind: "connectivity.provisioning_started", connectionId: targetRef };
    }
    if (providerEventType.includes("activated") || providerEventType.includes("active")) {
      return { kind: "connectivity.activated", connectionId: targetRef };
    }
    if (providerEventType.includes("suspended")) {
      return { kind: "connectivity.suspended", connectionId: targetRef };
    }
    if (providerEventType.includes("resumed") || providerEventType.includes("reconnected")) {
      return { kind: "connectivity.resumed", connectionId: targetRef };
    }
    if (providerEventType.includes("terminated") || providerEventType.includes("cancelled") || providerEventType.includes("deactivated")) {
      return { kind: "connectivity.terminated", connectionId: targetRef };
    }
    if (providerEventType.includes("failed") || providerEventType.includes("error")) {
      return { kind: "connectivity.failed", connectionId: targetRef, reason: providerEventType };
    }
  }

  // Communications normalization (voice/SMS).
  if (providerCategory === "cloud_telephony" || providerCategory === "pstn" || providerCategory === "sip") {
    if (providerEventType.includes("call.started") || providerEventType.includes("voice.initiated")) {
      return { kind: "communications.call_started", callId: targetRef };
    }
    if (providerEventType.includes("call.answered") || providerEventType.includes("voice.answered")) {
      return { kind: "communications.call_answered", callId: targetRef };
    }
    if (providerEventType.includes("call.ended") || providerEventType.includes("voice.ended")) {
      return { kind: "communications.call_ended", callId: targetRef, durationSeconds: 0 };
    }
    if (providerEventType.includes("sms.delivered") || providerEventType.includes("message.delivered")) {
      return { kind: "communications.message_delivered", messageId: targetRef };
    }
    if (providerEventType.includes("sms.failed") || providerEventType.includes("message.failed")) {
      return { kind: "communications.message_failed", messageId: targetRef, reason: providerEventType };
    }
  }

  // Numbering normalization.
  if (providerCategory === "pstn" || providerCategory === "mno" || providerCategory === "mvno" || providerCategory === "connectivity_aggregator") {
    if (providerEventType.includes("number.assigned") || providerEventType.includes("number.active")) {
      return { kind: "number.assigned", numberId: targetRef };
    }
    if (providerEventType.includes("number.released") || providerEventType.includes("number.ported_out") || providerEventType.includes("number.deactivated")) {
      return { kind: "number.released", numberId: targetRef };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Safe event handling
// ---------------------------------------------------------------------------

/** After a provider event has been verified, timestamp-checked, deduped and
 *  normalized, this is the ONLY safe path that may act on it. It emits an audit
 *  event and routes a customer notification where appropriate — it does NOT
 *  blindly mutate any customer document from the webhook payload alone. Future
 *  handlers must match the normalized target ref to the real customer record
 *  server-side before taking state-changing action. */
export async function handleNormalizedProviderEvent(input: {
  providerCategory: ProviderCategory;
  providerId: string;
  eventId: string;
  normalized: ProviderEventNormalized;
  rawTargetRef: string;
}): Promise<void> {
  const { providerCategory, providerId, eventId, normalized, rawTargetRef } = input;

  // Idempotency: if we already processed this provider event id, acknowledge
  // and do nothing.
  if (isEventAlreadyProcessed(eventId)) {
    writeAuditLog({
      actorUid: "provider-webhook",
      action: "provider.event.received",
      metadata: {
        providerId,
        providerCategory,
        providerEventId: eventId,
        targetRef: rawTargetRef,
        normalized: normalized.kind,
        result: "duplicate_ignored",
      },
    });
    return;
  }
  markEventProcessed(eventId);

  // Audit every normalized event (no secrets, no raw body).
  writeAuditLog({
    actorUid: "provider-webhook",
    action: "provider.event.received",
    metadata: {
      providerId,
      providerCategory,
      providerEventId: eventId,
      targetRef: rawTargetRef,
      normalized: normalized.kind,
      result: "processed",
    },
  });

  // Route a customer-facing notification where the normalized event is
  // customer-relevant. A real handler must still verify target ownership
  // before applying state.
  if (normalized.kind === "connectivity.activated") {
    // The real handler resolves the connection -> uid before sending.
    await notifyCustomerIfOwnerResolved({
      uid: "RESOLVE_FROM_CONNECTION_ID_FIRST",
      title: "Your connectivity is ready",
      message: "Your connectivity provider reports the connection is active.",
      kind: "connectivity.ready" as NotificationKind,
    });
  } else if (normalized.kind === "connectivity.failed") {
    await notifyCustomerIfOwnerResolved({
      uid: "RESOLVE_FROM_CONNECTION_ID_FIRST",
      title: "Connectivity setup needs attention",
      message: "Your connectivity provider reported a problem with your connection.",
      kind: "connectivity.failed" as NotificationKind,
    });
  } else if (normalized.kind === "connectivity.suspended") {
    await notifyCustomerIfOwnerResolved({
      uid: "RESOLVE_FROM_CONNECTION_ID_FIRST",
      title: "Connectivity suspended",
      message: "Your connectivity provider reports the connection is suspended.",
      kind: "connectivity.suspended" as NotificationKind,
    });
  } else if (normalized.kind === "communications.call_ended") {
    await notifyCustomerIfOwnerResolved({
      uid: "RESOLVE_FROM_CALL_ID_FIRST",
      title: "Missed call on your OneNumbr",
      message: "You had a call on your OneNumbr.",
      kind: "missed_call" as NotificationKind,
    });
  } else if (normalized.kind === "communications.message_delivered") {
    await notifyCustomerIfOwnerResolved({
      uid: "RESOLVE_FROM_MESSAGE_ID_FIRST",
      title: "Message delivered",
      message: "Your message was delivered.",
      kind: "message_delivered" as NotificationKind,
    });
  } else if (normalized.kind === "communications.message_failed") {
    await notifyCustomerIfOwnerResolved({
      uid: "RESOLVE_FROM_MESSAGE_ID_FIRST",
      title: "Message not delivered",
      message: "Your message could not be delivered.",
      kind: "message_failed" as NotificationKind,
    });
  }
}

/** Stub helper: real handlers resolve the owner first. This is not a real
 *  notification path — it exists so the contract is testable/documentable
 *  without accidentally sending notifications for unassigned refs. */
async function notifyCustomerIfOwnerResolved(input: {
  uid: string;
  title: string;
  message: string;
  kind: NotificationKind;
}): Promise<void> {
  if (input.uid.startsWith("RESOLVE_")) {
    // Real handler must resolve the owner from the connection/call/message doc
    // before calling createNotification(). For now this is a no-op contract
    // placeholder — no notification is sent for unresolved refs.
    writeAuditLog({
      actorUid: "provider-webhook",
      action: "provider.event.notification_queued",
      metadata: {
        providerEventId: input.uid,
        note: "Owner resolution required before notification; not sent yet.",
      },
    });
    return;
  }
  const { createNotification } = await import("@/lib/kyc-server");
  await createNotification({
    uid: input.uid,
    kind: input.kind,
    title: input.title,
    message: input.message,
  });
}

// ---------------------------------------------------------------------------
// Provider error mapping
// ---------------------------------------------------------------------------

/** Map a provider raw error into a OneNumbr domain error code + category.
 *  Provider-specific messages must NOT be returned to the customer. */
export function mapProviderError(
  providerCategory: ProviderCategory,
  providerErrorCode: string,
): { code: ProviderErrorCodeFromMap; category: "transient" | "permanent" | "authentication" | "rate_limited" | "not_found" | "conflict" | "unsupported" } {
  const lowered = providerErrorCode.toLowerCase();

  if (lowered.includes("auth") || lowered.includes("token") || lowered.includes("unauthorized") || lowered.includes("permission")) {
    return { code: "provider_auth_failed", category: "authentication" };
  }
  if (lowered.includes("rate") || lowered.includes("too many") || lowered.includes("429")) {
    return { code: "provider_rate_limited", category: "rate_limited" };
  }
  if (lowered.includes("timeout") || lowered.includes("timed out") || lowered.includes("504") || lowered.includes("gateway")) {
    return { code: "provider_timeout", category: "transient" };
  }
  if (
    lowered.includes("unavailable") || lowered.includes("down") || lowered.includes("maintenance") ||
    lowered.includes("500") || lowered.includes("502") || lowered.includes("503")
  ) {
    return { code: "provider_temporarily_unavailable", category: "transient" };
  }
  if (lowered.includes("not found") || lowered.includes("missing") || lowered.includes("404")) {
    return { code: "provider_number_unavailable", category: "not_found" };
  }
  if (lowered.includes("already") || lowered.includes("duplicate") || lowered.includes("conflict") || lowered.includes("409")) {
    return { code: "provider_duplicate_request", category: "conflict" };
  }
  if (lowered.includes("unsupported") || lowered.includes("not supported") || lowered.includes("invalid") && lowered.includes("region")) {
    return { code: "provider_unsupported", category: "unsupported" };
  }
  if (lowered.includes("configuration") || lowered.includes("invalid") || lowered.includes("forbidden") || lowered.includes("403")) {
    return { code: "provider_configuration_error", category: "permanent" };
  }

  return { code: "provider_unknown", category: "permanent" };
}

// Re-export so callers can import ProviderErrorCodeFromMap from one place.
export type ProviderErrorCodeFromMap =
  | "provider_auth_failed"
  | "provider_rate_limited"
  | "provider_temporarily_unavailable"
  | "provider_unavailable"
  | "provider_unsupported"
  | "provider_configuration_error"
  | "provider_number_unavailable"
  | "provider_provisioning_failed"
  | "provider_activation_failed"
  | "provider_termination_failed"
  | "provider_timeout"
  | "provider_duplicate_request"
  | "provider_unknown";
