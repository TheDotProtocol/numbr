// =============================================================================
// GET /api/admin/trust-and-safety — trust & safety readiness (staff only)
// =============================================================================

import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { requireStaff } from "@/lib/admin-server";
import {
  listTrustAndSafetyProviders,
  trustAndSafetyAvailability,
  trustAndSafetyConfigState,
  trustAndSafetyHealthSummary,
} from "@/lib/trust-and-safety-registry";
import { getFeatureFlags } from "@/lib/features";

export async function GET() {
  try {
    await requireStaff();
    const flags = getFeatureFlags();
    const providers = listTrustAndSafetyProviders();
    const summary = trustAndSafetyHealthSummary();

    return NextResponse.json({
      providers: providers.map((p) => ({
        id: p.id,
        name: p.displayName,
        category: p.category,
        availability: trustAndSafetyAvailability(p),
        configState: trustAndSafetyConfigState(p),
        interfaces: p.interfaces,
        capabilities: Object.entries(p.capabilities).filter(([, v]) => v).map(([k]) => k),
        configurationRequirements: p.configurationRequirements,
        note: p.note,
      })),
      summary,
      capabilities: {
        inboundSpamFilter: flags.inboundSpamFilterEnabled ? "enabled" : "disabled",
        outboundGuard: flags.outboundGuardEnabled ? "enabled" : "disabled",
        antiAutomation: flags.antiAutomationProviderEnabled ? "enabled" : "disabled",
        senderReputation: flags.senderReputationEnabled ? "enabled" : "disabled",
        abuseReporting: flags.abuseReportingEnabled ? "enabled" : "disabled",
        incidentManagement: flags.incidentManagementEnabled ? "enabled" : "disabled",
        verificationChallenge: flags.verificationChallengeEnabled ? "enabled" : "disabled",
      },
      currentProtection: {
        enabled: flags.trustAndSafetyEnabled,
        model: "basic_abuse_resistant_controls_only",
        capabilities: [
          "rate limiting",
          "safe errors",
          "ownership checks",
          "audit logging",
          "request IDs",
          "secret redaction",
        ],
      },
    });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
