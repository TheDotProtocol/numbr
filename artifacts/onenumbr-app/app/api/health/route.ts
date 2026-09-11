// =============================================================================
// GET /api/health — safe platform health summary (no secrets, no PII).
// =============================================================================

import { NextResponse } from "next/server";
import { getEnvironmentMode, getFeatureFlags } from "@/lib/features";
import { providerHealthSummary } from "@/lib/provider-registry";
import { getCloudCommunicationsHealth } from "@/lib/cloud-comms-service";

export async function GET() {
  const flags = getFeatureFlags();
  const providerSummary = providerHealthSummary();
  // Prompt 17: honest real-provider status — never fabricated health.
  const cloudComms = await getCloudCommunicationsHealth();
  return NextResponse.json({
    status: "ok",
    service: "onenumbr",
    environment: getEnvironmentMode(),
    maintenance: flags.maintenanceMode,
    providers: {
      payments: flags.stripePayments ? "real" : "mock",
      telecom: flags.realTelecom ? "real" : "mock",
      esim: flags.realEsim ? "real" : "mock",
      identity: flags.sumsub ? "real" : "manual",
      communications: "mock",
      billing: "mock",
      endpoints: {
        web: "available",
        tauPhone: flags.tauPhoneEndpointEnabled ? "demo" : "disabled",
        tauTalk: flags.tauTalkEndpointEnabled ? "demo" : "disabled",
        pstn: "disabled",
        physicalSim: "future",
      },
      connectivity: {
        cloud: flags.connectivityCloudEnabled ? "demo" : "disabled",
        esim: flags.realEsim ? "live" : "demo",
        mno: flags.connectivityMnoEnabled ? "enabled" : "disabled",
        mvno: flags.connectivityMvnoEnabled ? "enabled" : "disabled",
        physicalSim: "future",
        pstn: "disabled",
        sip: "future",
      },
      pstn: flags.pstnEnabled ? "enabled" : "disabled",
      cloudCommunications: {
        enabled: flags.cloudCommunicationsProviderEnabled,
        status: cloudComms.status,
        note: cloudComms.note,
        capabilities: cloudComms.capabilities,
      },
      // Provider readiness (Prompt 15): honest summary across registry providers.
      // Never exposes credentials, tokens, or per-provider secret status.
      readiness: flags.providerHealthReportingEnabled
        ? (
            {
              summary: providerSummary,
              realCloudTelephony: flags.realCloudTelephonyEnabled ? "enabled" : "disabled",
              realEsimProvider: flags.realEsimProviderEnabled ? "enabled" : "disabled",
              realMno: flags.realMnoEnabled ? "enabled" : "disabled",
              realMvno: flags.realMvnoEnabled ? "enabled" : "disabled",
              realPhysicalSim: flags.realPhysicalSimEnabled ? "enabled" : "disabled",
              realPstn: flags.realPstnEnabled ? "enabled" : "disabled",
              webhookArchitecture: flags.webhookArchitectureEnabled ? "available" : "disabled",
            }
          )
        : undefined,
    },
    features: {
      communications: flags.communicationsEnabled,
      endpoints: flags.endpointsEnabled,
      globalPlan: flags.globalPlanEnabled,
      entitlements: flags.entitlementsEnabled,
      connectivityCore: flags.connectivityEnabled,
      connectivityCloud: flags.connectivityCloudEnabled,
      voice: flags.voiceEnabled,
      messaging: flags.messagingEnabled,
      voicemail: flags.voicemailEnabled,
      connectivity: flags.connectivityEnabled,
      tauCore: flags.tauCoreIntegrationEnabled,
      providerReadiness: flags.providerReadinessEnabled,
      providerHealthReporting: flags.providerHealthReportingEnabled,
      trustAndSafety: flags.trustAndSafetyEnabled ? {
        enabled: true,
        currentProtection: "basic_abuse_resistant_controls_only",
        inboundSpamFilter: flags.inboundSpamFilterEnabled ? "enabled" : "disabled",
        outboundGuard: flags.outboundGuardEnabled ? "enabled" : "disabled",
        antiAutomation: flags.antiAutomationProviderEnabled ? "enabled" : "disabled",
        senderReputation: flags.senderReputationEnabled ? "enabled" : "disabled",
        abuseReporting: flags.abuseReportingEnabled ? "enabled" : "disabled",
        incidentManagement: flags.incidentManagementEnabled ? "enabled" : "disabled",
        verificationChallenge: flags.verificationChallengeEnabled ? "enabled" : "disabled",
      } : undefined,
    },
    timestamp: new Date().toISOString(),
  });
}
