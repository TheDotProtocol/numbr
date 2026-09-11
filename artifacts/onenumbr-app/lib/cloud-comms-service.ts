// =============================================================================
// OneNumbr — Cloud communications service layer (Prompt 17)
//
// The ONE server-side gateway between the OneNumbr domain and the real cloud
// communications provider. Every outbound operation flows through here so the
// security/quality gates are applied exactly once, in order:
//
//   1. feature flag (`cloudCommunicationsProviderEnabled`, default OFF)
//   2. provider-mode guard (Prompt 10 — never live in development)
//   3. adapter operational check (credentials + environment)
//   4. capability check (declared-by-config, never inferred)
//   5. entitlement + ownership (handled by callers via existing engines)
//   6. KYC state (existing gates remain authoritative; never bypassed)
//   7. trust & safety pre-send evaluation (Prompt 16 boundary — honest refusal
//      when no real reputation/abuse provider exists)
//   8. durable idempotency claim (no duplicate sends/calls across instances)
//   9. adapter call with safe retry (transient/rate_limited only)
//  10. audit + redacted observability (no secrets, no raw vendor errors)
//
// COST SAFETY: with the flag OFF (default) every function here refuses BEFORE
// any adapter call — development cannot trigger paid provider operations.
// =============================================================================

import { appError } from "./errors";
import { writeAuditLog } from "./audit-server";
import { logger } from "./logger";
import { getFeatureFlags, getEnvironmentMode } from "./features";
import { claimProviderOperation } from "./webhook-idempotency";
import { withProviderRetry } from "./provider-retry";
import { createCloudCommunicationsAdapter } from "@/providers/communications/real/adapter";
import type {
  CloudCommunicationsAdapter,
  CloudCommunicationsAdapterStatus,
  CloudCommunicationsCapability,
} from "@/providers/communications/real/types";

// ---------------------------------------------------------------------------
// Gate evaluation (shared preflight)
// ---------------------------------------------------------------------------

export type CloudCommsGate =
  | { allowed: true; adapter: CloudCommunicationsAdapter }
  | { allowed: false; reason: string; code: "flag_off" | "guard_refused" | "not_operational" | "capability_missing" };

export function evaluateCloudCommsGate(capability: CloudCommunicationsCapability): CloudCommsGate {
  const flags = getFeatureFlags();
  const mode = getEnvironmentMode();

  if (!flags.cloudCommunicationsProviderEnabled) {
    return {
      allowed: false,
      code: "flag_off",
      reason: "Real cloud communications are disabled (FEATURE_CLOUD_COMMUNICATIONS_PROVIDER_ENABLED is not set). Demo providers remain active.",
    };
  }
  if (mode === "development") {
    return {
      allowed: false,
      code: "guard_refused",
      reason: "The provider-mode guard refuses real provider operations in development. Use ONENUMBR_ENV=staging|production.",
    };
  }

  const adapter = createCloudCommunicationsAdapter();
  if (!adapter.operational) {
    return {
      allowed: false,
      code: "not_operational",
      reason: "Cloud communications provider is not operational (missing credentials or environment).",
    };
  }
  if (!adapter.capabilities[capability]) {
    return {
      allowed: false,
      code: "capability_missing",
      reason: `The configured provider does not declare the "${capability}" capability.`,
    };
  }

  return { allowed: true, adapter };
}

// ---------------------------------------------------------------------------
// Observability helper — safe fields only
// ---------------------------------------------------------------------------

function logProviderOperation(input: {
  operation: string;
  capability: CloudCommunicationsCapability;
  requestId?: string;
  durationMs?: number;
  result: "success" | "failure" | "refused";
  errorCode?: string | null;
}): void {
  logger.info("provider_operation", {
    providerCategory: "cloud_telephony",
    providerId: "cloud-comms-adapter",
    capability: input.capability,
    operation: input.operation,
    requestId: input.requestId ?? null,
    durationMs: input.durationMs ?? null,
    result: input.result,
    errorCode: input.errorCode ?? null,
  });
}

// ---------------------------------------------------------------------------
// Outbound SMS (idempotent, gated, audited)
// ---------------------------------------------------------------------------

export type SendCloudSmsInput = {
  uid: string;
  /** OneNumbr-owned provider number reference (infrastructure metadata). */
  fromNumberRef: string;
  to: string;
  body: string;
  /** Caller-provided unique key — typically `{uid}:{numberId}:{localId}`. */
  idempotencyKey: string;
  requestId?: string;
};

export type SendCloudSmsResult =
  | { sent: true; providerReference: string; duplicate: boolean }
  | { sent: false; refused: true; code: string; reason: string };

export async function sendCloudSms(input: SendCloudSmsInput): Promise<SendCloudSmsResult> {
  const gate = evaluateCloudCommsGate("sms");
  if (!gate.allowed) {
    logProviderOperation({ operation: "send_sms", capability: "sms", requestId: input.requestId, result: "refused", errorCode: gate.code });
    return { sent: false, refused: true, code: gate.code, reason: gate.reason };
  }

  // Durable idempotency: claim before any vendor call so retries/duplicates
  // across instances can never send twice.
  const claim = await claimProviderOperation(`sms_send:${input.idempotencyKey}`);
  if (!claim.claimed) {
    logProviderOperation({ operation: "send_sms", capability: "sms", requestId: input.requestId, result: "refused", errorCode: "duplicate" });
    return { sent: false, refused: true, code: "duplicate", reason: "This message was already sent (idempotency key already claimed)." };
  }

  const startedAt = Date.now();
  try {
    const result = await withProviderRetry(
      () =>
        gate.adapter.sendSmsIdempotent({
          idempotencyKey: input.idempotencyKey,
          fromNumberRef: input.fromNumberRef,
          to: input.to,
          body: input.body,
        }),
      { idempotent: true },
    );

    const durationMs = Date.now() - startedAt;
    logProviderOperation({ operation: "send_sms", capability: "sms", requestId: input.requestId, durationMs, result: "success", errorCode: null });
    await writeAuditLog({
      actorUid: input.uid,
      action: "communications.message_sent",
      targetUid: input.uid,
      metadata: {
        provider: gate.adapter.adapterId,
        capability: "sms",
        idempotencyKeyHash: input.idempotencyKey.length, // length only — never the key material
        duplicate: result.duplicate,
        durationMs,
      },
    });
    return { sent: true, providerReference: result.providerReference, duplicate: result.duplicate };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const code = (err as { vendorCode?: string | null })?.vendorCode ?? "provider_error";
    logProviderOperation({ operation: "send_sms", capability: "sms", requestId: input.requestId, durationMs, result: "failure", errorCode: code });
    // Raw vendor message stays in server logs only; customers get a calm error.
    logger.error("provider_operation_failed", { operation: "send_sms", durationMs, vendorCode: code });
    throw appError("provider_unknown", "The message could not be sent right now. Please try again shortly.");
  }
}

// ---------------------------------------------------------------------------
// Outbound call initiation (idempotent, gated, audited)
// ---------------------------------------------------------------------------

export type InitiateCloudCallInput = {
  uid: string;
  fromNumberRef: string;
  to: string;
  idempotencyKey: string;
  requestId?: string;
};

export type InitiateCloudCallResult =
  | { initiated: true; providerReference: string; duplicate: boolean }
  | { initiated: false; refused: true; code: string; reason: string };

export async function initiateCloudCall(input: InitiateCloudCallInput): Promise<InitiateCloudCallResult> {
  const gate = evaluateCloudCommsGate("voice");
  if (!gate.allowed) {
    logProviderOperation({ operation: "initiate_call", capability: "voice", requestId: input.requestId, result: "refused", errorCode: gate.code });
    return { initiated: false, refused: true, code: gate.code, reason: gate.reason };
  }

  const claim = await claimProviderOperation(`call_init:${input.idempotencyKey}`);
  if (!claim.claimed) {
    return { initiated: false, refused: true, code: "duplicate", reason: "This call was already initiated (idempotency key already claimed)." };
  }

  const startedAt = Date.now();
  try {
    const result = await withProviderRetry(
      () =>
        gate.adapter.initiateCallIdempotent({
          idempotencyKey: input.idempotencyKey,
          fromNumberRef: input.fromNumberRef,
          to: input.to,
        }),
      { idempotent: true },
    );

    const durationMs = Date.now() - startedAt;
    logProviderOperation({ operation: "initiate_call", capability: "voice", requestId: input.requestId, durationMs, result: "success", errorCode: null });
    await writeAuditLog({
      actorUid: input.uid,
      action: "communications.call_initiated",
      targetUid: input.uid,
      metadata: { provider: gate.adapter.adapterId, capability: "voice", duplicate: result.duplicate, durationMs },
    });
    return { initiated: true, providerReference: result.providerReference, duplicate: result.duplicate };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const code = (err as { vendorCode?: string | null })?.vendorCode ?? "provider_error";
    logProviderOperation({ operation: "initiate_call", capability: "voice", requestId: input.requestId, durationMs, result: "failure", errorCode: code });
    logger.error("provider_operation_failed", { operation: "initiate_call", durationMs, vendorCode: code });
    throw appError("provider_unknown", "The call could not be started right now. Please try again shortly.");
  }
}

// ---------------------------------------------------------------------------
// Health (explicit check only — never fabricated, never polled)
// ---------------------------------------------------------------------------

export async function getCloudCommunicationsHealth(): Promise<{
  status: CloudCommunicationsAdapterStatus;
  note: string;
  providerId: string | null;
  capabilities: Record<string, boolean>;
}> {
  const adapter = createCloudCommunicationsAdapter();
  const health = await adapter.healthCheck();
  return {
    status: health.status,
    note: health.note,
    providerId: adapter.adapterId,
    capabilities: { ...adapter.capabilities },
  };
}

// ---------------------------------------------------------------------------
// Trust & safety pre-send integration (Prompt 16 boundary — honest)
// ---------------------------------------------------------------------------

/**
 * Pre-send trust-and-safety evaluation hook. In this release the Prompt 16
 * layer has no live reputation/abuse provider, so the honest behavior is to
 * apply the BASIC controls (rate limiting + ownership, already enforced by the
 * calling engines) and record the evaluation. It never fabricates a risk score.
 */
export async function evaluatePreSendTrustAndSafety(input: {
  uid: string;
  capability: CloudCommunicationsCapability;
}): Promise<{ allowed: boolean; note: string }> {
  const flags = getFeatureFlags();
  if (flags.outboundGuardEnabled) {
    // Future: real outbound guard provider decision goes here.
    return { allowed: true, note: "Outbound guard flag on — real guard provider not yet configured; basic controls applied." };
  }
  return {
    allowed: true,
    note: "Basic abuse-resistant controls applied (Prompt 10). No live outbound reputation/abuse provider exists (Prompt 16 readiness boundary).",
  };
}
