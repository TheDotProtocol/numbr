// =============================================================================
// OneNumbr — Trust & safety service layer (Prompt 16)
//
// The server-side trust-and-safety surface: an honest overview for customers and
// staff, plus the abstract inbound/outbound/anti-automation operations that a
// future real provider would implement.
//
// In this release all of these operations are non-operational boundaries — they
// return honest "not configured" results and never touch the OneNumbr identity,
// number, plan, communications or endpoints.
// =============================================================================

import { appError } from "./errors";
import { writeAuditLog } from "./audit-server";
import { getFeatureFlags } from "./features";
import {
  listTrustAndSafetyProviders,
  trustAndSafetyAvailability,
  trustAndSafetyConfigState,
  trustAndSafetyProviderHealthSnapshot,
  trustAndSafetyHealthSummary,
  selectTrustAndSafetyProvider,
} from "./trust-and-safety-registry";
import type { TrustAndSafetyProviderMetadata, TrustAndSafetyInterface, TrustAndSafetyCapability } from "@/types/trust-and-safety";

// ---------------------------------------------------------------------------
// Overview / resolution
// ---------------------------------------------------------------------------

export type TrustAndSafetyOverview = {
  enabled: boolean; // layer surface is present; does not mean live spam protection
  providers: {
    id: string;
    name: string;
    category: string;
    environment: string;
    availability: string;
    configState: string;
    note: string;
  }[];
  summary: ReturnType<typeof trustAndSafetyHealthSummary>;
  futureBoundaries: {
    id: string;
    name: string;
    requirement: string;
  }[];
  /** Today's honest protection state. */
  currentProtection: {
    note: string;
    capabilities: string[];
  };
};

export async function resolveTrustAndSafetyOverview(): Promise<TrustAndSafetyOverview> {
  const flags = getFeatureFlags();
  const providers = listTrustAndSafetyProviders();
  const summary = trustAndSafetyHealthSummary();

  return {
    enabled: flags.trustAndSafetyEnabled,
    providers: providers.map((p) => ({
      id: p.id,
      name: p.displayName,
      category: p.category,
      environment: p.environment,
      availability: trustAndSafetyAvailability(p),
      configState: trustAndSafetyConfigState(p),
      note: p.note,
    })),
    summary,
    futureBoundaries: providers
      .filter((p) => trustAndSafetyAvailability(p) === "disabled")
      .map((p) => ({ id: p.id, name: p.displayName, requirement: p.configurationRequirements[0] ?? "Configuration required." })),
    currentProtection: {
      note: "Today OneNumbr relies on basic abuse-resistant controls (Prompt 10): rate limiting, safe errors, ownership checks, audit and request IDs. There is no live spam filter, reputation engine, anti-automation challenge provider or inbound abuse pipeline.",
      capabilities: [
        "rate limiting",
        "safe errors",
        "ownership checks",
        "audit logging",
        "request IDs",
        "secret redaction",
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Provider selection helper (server-side only)
// ---------------------------------------------------------------------------

export function selectTrustAndSafetyProviderFor(
  iface: TrustAndSafetyInterface,
  capability?: TrustAndSafetyCapability,
  region?: string,
): TrustAndSafetyProviderMetadata | null {
  return selectTrustAndSafetyProvider({ interface_: iface, capability, region });
}

// ---------------------------------------------------------------------------
// Inbound filter (boundary — not operational today)
// ---------------------------------------------------------------------------

export type InboundFilterRequest = {
  /** The inbound communication/message identity the provider should classify. */
  targetRef: string;
  /** Surface the inbound item arrived on (email / sms / voice / etc.) — future. */
  surface?: string;
};

export type InboundFilterResult = {
  providerId: string;
  decision: "allow" | "flag" | "quarantine" | "block" | "escalate";
  reason: string;
  demo: boolean;
  note: string;
};

export async function classifyInboundItem(input: InboundFilterRequest): Promise<InboundFilterResult> {
  if (!getFeatureFlags().inboundSpamFilterEnabled) {
    throw appError("provider_unavailable", "Inbound spam/abuse filtering is not configured in this environment.");
  }

  const provider = selectTrustAndSafetyProviderFor("inbound_filter", undefined, input.surface) ??
    selectTrustAndSafetyProviderFor("trust_and_safety", undefined, input.surface);
  if (!provider) {
    throw appError("provider_unavailable", "No inbound trust-and-safety provider is available.");
  }

  // Boundary only — no real classification today.
  return {
    providerId: provider.id,
    decision: "flag",
    reason: "Inbound classification is not implemented yet.",
    demo: true,
    note: "No live inbound spam/abuse pipeline exists; this is a future-provider boundary.",
  };
}

// ---------------------------------------------------------------------------
// Outbound guard (boundary — not operational today)
// ---------------------------------------------------------------------------

export type OutboundGuardRequest = {
  /** The outbound item identity the provider should guard. */
  targetRef: string;
  /** Surface the outbound item is leaving through (email / sms / voice / etc.) — future. */
  surface?: string;
};

export type OutboundGuardResult = {
  providerId: string;
  decision: "allow" | "throttle" | "reject" | "flag";
  reason: string;
  demo: boolean;
  note: string;
};

export async function guardOutboundItem(input: OutboundGuardRequest): Promise<OutboundGuardResult> {
  if (!getFeatureFlags().outboundGuardEnabled) {
    throw appError("provider_unavailable", "Outbound guard is not configured in this environment.");
  }

  const provider = selectTrustAndSafetyProviderFor("outbound_guard", undefined, input.surface) ??
    selectTrustAndSafetyProviderFor("trust_and_safety", undefined, input.surface);
  if (!provider) {
    throw appError("provider_unavailable", "No outbound trust-and-safety provider is available.");
  }

  // Boundary only — no real outbound guarding today.
  return {
    providerId: provider.id,
    decision: "allow",
    reason: "Outbound guard is not implemented yet.",
    demo: true,
    note: "No live outbound spam/abuse guard exists; this is a future-provider boundary.",
  };
}

// ---------------------------------------------------------------------------
// Anti-automation / rate-control intelligence (boundary — not operational today)
// ---------------------------------------------------------------------------

export type AntiAutomationRequest = {
  /** Subject being evaluated: account / device / endpoint / session / action. */
  subjectRef: string;
  subjectType: "account" | "device" | "endpoint" | "session" | "action";
};

export type AntiAutomationResult = {
  providerId: string;
  decision: "allow" | "flag" | "step_up" | "restrict";
  reason: string;
  demo: boolean;
  note: string;
};

export async function evaluateAntiAutomation(input: AntiAutomationRequest): Promise<AntiAutomationResult> {
  if (!getFeatureFlags().antiAutomationProviderEnabled) {
    // Fall back to Today's basic Prompt 10 controls. Future richer behavior is a
    // provider boundary only.
    return {
      providerId: "prompt10_basic_controls",
      decision: "allow",
      reason: "No live anti-automation provider is configured; basic rate/ownership controls apply.",
      demo: false,
      note: "Trust-and-safety anti-automation is not operational yet.",
    };
  }

  const provider = selectTrustAndSafetyProviderFor("trust_and_safety", "verification_challenge", undefined) ??
    selectTrustAndSafetyProviderFor("trust_and_safety", "rate_intelligence", undefined);
  if (!provider) {
    throw appError("provider_unavailable", "No anti-automation provider is available.");
  }

  // Boundary only — no real anti-automation behavior today.
  return {
    providerId: provider.id,
    decision: "allow",
    reason: "Anti-automation evaluation is not implemented yet.",
    demo: true,
    note: "No live anti-automation/behavior-detection provider exists; this is a future-provider boundary.",
  };
}

// ---------------------------------------------------------------------------
// Abuse report ingestion (boundary for future abuse reporting)
// ---------------------------------------------------------------------------

export type AbuseReportRequest = {
  /** Who is reporting. */
  reporterRef: string;
  /** What is being reported. */
  targetRef: string;
  category?: string;
  note?: string;
};

export type AbuseReportResult = {
  providerId: string | null;
  reportRef: string;
  demo: boolean;
  note: string;
};

export async function ingestAbuseReport(input: AbuseReportRequest): Promise<AbuseReportResult> {
  if (!getFeatureFlags().abuseReportingEnabled) {
    // Record an internal abuse-report-style audit breadcrumb even without a provider,
    // so the future abuse pipeline has a hook to grow into. No provider ref.
    await writeAuditLog({
      actorUid: "trust_and_safety",
      action: "trust_and_safety_event.record",
      targetUid: null,
      metadata: {
        reporterRef: input.reporterRef,
        targetRef: input.targetRef,
        category: input.category ?? null,
        note: input.note ?? null,
        providerId: null,
        result: "ingested_no_provider",
      },
    });
    return {
      providerId: null,
      reportRef: `ABUSE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      demo: false,
      note: "Abuse reporting is not connected to a provider yet; the report was recorded internally for future provider integration.",
    };
  }

  const provider = selectTrustAndSafetyProviderFor("trust_and_safety", undefined, undefined);
  if (!provider) {
    throw appError("provider_unavailable", "No trust-and-safety provider is available for abuse reporting.");
  }

  await writeAuditLog({
    actorUid: "trust_and_safety",
    action: "trust_and_safety_event.record",
    targetUid: null,
    metadata: {
      reporterRef: input.reporterRef,
      targetRef: input.targetRef,
      category: input.category ?? null,
      note: input.note ?? null,
      providerId: provider.id,
      result: "ingested_no_provider",
    },
  });

  return {
    providerId: provider.id,
    reportRef: `ABUSE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    demo: true,
    note: "No live abuse pipeline exists; the report was recorded with a provider placeholder.",
  };
}
