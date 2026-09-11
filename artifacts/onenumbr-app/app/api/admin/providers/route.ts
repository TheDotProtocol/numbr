// =============================================================================
// GET /api/admin/providers — provider readiness (staff only, Prompt 15)
// =============================================================================

import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { toAppError } from "@/lib/errors";
import { requireStaff } from "@/lib/admin-server";
import { listProviderMetadata, providerAvailability, providerConfigState, providerHealthSummary, describeProviderMode } from "@/lib/provider-registry";
import { getCloudCommunicationsHealth } from "@/lib/cloud-comms-service";
import { getFeatureFlags } from "@/lib/features";

export async function GET() {
  try {
    await requireStaff();
    const providers = listProviderMetadata();
    const summary = providerHealthSummary();
    const flags = getFeatureFlags();
    const cloudComms = await getCloudCommunicationsHealth();

    return NextResponse.json({
      providers: providers.map((p) => ({
        id: p.id,
        name: p.displayName,
        category: p.category,
        environment: p.environment,
        availability: providerAvailability(p),
        configState: providerConfigState(p),
        interfaces: p.interfaces,
        capabilities: Object.entries(p.capabilities)
          .filter(([, v]) => v)
          .map(([k]) => k),
        regions: p.regions,
        configurationRequirements: p.configurationRequirements,
        note: p.note,
      })),
      summary: {
        ...summary,
        providersDeclared: providers.length,
      },
      environment: describeProviderMode("telecom").environment,
      providerMode: describeProviderMode("telecom"),
      // Prompt 17: first real provider slot status (no secrets, no fabricated health).
      cloudCommunications: {
        flagEnabled: flags.cloudCommunicationsProviderEnabled,
        status: cloudComms.status,
        note: cloudComms.note,
        providerId: cloudComms.providerId,
        capabilities: cloudComms.capabilities,
        credentialRequirements: ["CLOUD_COMMS_PROVIDER_ID", "CLOUD_COMMS_API_KEY", "CLOUD_COMMS_API_SECRET", "CLOUD_COMMS_WEBHOOK_SECRET", "CLOUD_COMMS_CAPABILITIES", "CLOUD_COMMS_SANDBOX_MODE"],
      },
    });
  } catch (err) {
    return jsonError(toAppError(err));
  }
}
