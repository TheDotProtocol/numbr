// =============================================================================
// GET /api/health/providers — active provider registry summary.
// Reports WHICH provider class is active per domain and whether it is a
// placeholder/mock — without exposing any provider identifiers or endpoints.
// =============================================================================

import { NextResponse } from "next/server";
import {
  getEsimProvider,
  getIdentityProvider,
  getPaymentProvider,
  getTelecomProvider,
  getTwoFactorProvider,
} from "@/providers";

function describe(p: { readonly name?: string; readonly available?: boolean } & Record<string, unknown>): string {
  const n = String((p as { name?: unknown }).name ?? "unknown");
  return /mock|manual|placeholder/i.test(n) ? `${n} (demo)` : n;
}

export async function GET() {
  return NextResponse.json({
    payment: describe(getPaymentProvider() as unknown as Record<string, unknown>),
    telecom: describe(getTelecomProvider() as unknown as Record<string, unknown>),
    esim: describe(getEsimProvider() as unknown as Record<string, unknown>),
    identity: describe(getIdentityProvider() as unknown as Record<string, unknown>),
    twoFactor: describe(getTwoFactorProvider() as unknown as Record<string, unknown>),
    timestamp: new Date().toISOString(),
  });
}
