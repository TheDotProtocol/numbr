// =============================================================================
// OneNumbr — Provider registry
//
// Single place where vendor implementations are selected. Today every domain
// returns its placeholder; Prompts 2–5 swap in real adapters here (and only
// here) — no application code changes required.
// =============================================================================

import { placeholderEsimProvider, type EsimProvider } from "./esim/types";
import { mockEsimProvider } from "./esim/mock";
import { manualIdentityProvider } from "./identity/manual";
import type { IdentityProvider } from "./identity/types";
import { mockPaymentProvider } from "./payment/mock";
import type { PaymentProvider } from "./payment/types";
import { mockTelecomProvider } from "./telecom/mock";
import type { TelecomProvider } from "./telecom/types";
import { placeholderTwoFactorProvider, type TwoFactorProvider } from "./twofactor/types";
import { mockCommunicationsProvider } from "./communications/mock";
import type { CommunicationsProvider } from "./communications/types";
import {
  tauPhoneEndpointProvider,
  tauTalkEndpointProvider,
  webEndpointProvider,
  verifiedDeviceEndpointProvider,
  mobileAppEndpointProvider,
} from "./endpoints/mocks";
import type { EndpointProvider } from "./endpoints/types";
import { cloudConnectivityProvider, esimConnectivityProvider } from "./connectivity/providers";
import type { ConnectivityProvider } from "./connectivity/types";
import { FUTURE_CONNECTIVITY_BOUNDARIES } from "./connectivity/future";
import { createReferenceConnectivityProvider as createReferenceConnectivityProviderImpl } from "./test/reference";

// Connectivity providers (Prompt 14) — one per mechanism that is operational
// in this environment. Future mechanisms stay boundaries (see ./connectivity/future).
const connectivityProviders = new Map<string, ConnectivityProvider>([
  [cloudConnectivityProvider.id, cloudConnectivityProvider],
  [esimConnectivityProvider.id, esimConnectivityProvider],
]);

// Prompt 3 ships the mock provider; swap to a real adapter here later.
let esimProvider: EsimProvider = mockEsimProvider;
let identityProvider: IdentityProvider = manualIdentityProvider;
let paymentProvider: PaymentProvider = mockPaymentProvider;
let telecomProvider: TelecomProvider = mockTelecomProvider;
let twoFactorProvider: TwoFactorProvider = placeholderTwoFactorProvider;
// Communications layer (Prompt 11) — sits ABOVE the telecom/connectivity layer.
let communicationsProvider: CommunicationsProvider = mockCommunicationsProvider;
// Endpoint adapters (Prompt 12) — one per device/application platform.
const endpointProviders = new Map<string, EndpointProvider>([
  ["web", webEndpointProvider],
  ["mobile_app", mobileAppEndpointProvider],
  ["tau_phone", tauPhoneEndpointProvider],
  ["tau_talk", tauTalkEndpointProvider],
  ["verified_device", verifiedDeviceEndpointProvider],
]);

/** Active eSIM provider (real vendor arrives in Prompt 3). */
export function getEsimProvider(): EsimProvider {
  return esimProvider;
}

/** Active payment provider (mock in Prompt 3; Stripe later). */
export function getPaymentProvider(): PaymentProvider {
  return paymentProvider;
}

/** Active telecom provider (mock in Prompt 4; real carrier later). */
export function getTelecomProvider(): TelecomProvider {
  return telecomProvider;
}

/**
 * Active 2FA provider. Unavailable in Prompt 6 — the account UI reads
 * `available` and shows honest states until a real provider is registered.
 */
export function getTwoFactorProvider(): TwoFactorProvider {
  return twoFactorProvider;
}

/**
 * Active communications provider (Prompt 11). Mock today; a future PSTN or
 * cloud-telephony adapter registers here — and only here.
 */
export function getCommunicationsProvider(): CommunicationsProvider {
  return communicationsProvider;
}

/** Endpoint adapter for a platform type (Prompt 12). Null = unsupported. */
export function getEndpointProvider(endpointType: string): EndpointProvider | null {
  return endpointProviders.get(endpointType) ?? null;
}

/** All registered endpoint adapter types (for availability reporting). */
export function getRegisteredEndpointTypes(): string[] {
  return [...endpointProviders.keys()];
}

/** @internal test/seed hook — replaces the active telecom provider. */
export function setTelecomProviderForTests(p: TelecomProvider): void {
  telecomProvider = p;
}

/** @internal test hook — replaces the active payment provider. */
export function setPaymentProviderForTests(p: PaymentProvider): void {
  paymentProvider = p;
}

/** Active identity verification provider (manual review in V1; Sumsub later). */
export function getIdentityProvider(): IdentityProvider {
  return identityProvider;
}

/** @internal test/seed hook — replaces the active identity provider. */
export function setIdentityProviderForTests(p: IdentityProvider): void {
  identityProvider = p;
}

/** @internal test/seed hook — replaces the active eSIM provider. */
export function setEsimProviderForTests(p: EsimProvider): void {
  esimProvider = p;
}

/** @internal test hook — replaces the active communications provider. */
export function setCommunicationsProviderForTests(p: CommunicationsProvider): void {
  communicationsProvider = p;
}

/** Connectivity providers active in this environment, by registry id. */
export function listConnectivityProviders(): ConnectivityProvider[] {
  return [...connectivityProviders.values()];
}

/** Resolve a connectivity provider by registry id; null when unknown. */
export function getConnectivityProvider(id: string): ConnectivityProvider | null {
  return connectivityProviders.get(id) ?? null;
}

/** Future mechanism boundaries (ops/health display only — never operational). */
export function listFutureConnectivityBoundaries() {
  return FUTURE_CONNECTIVITY_BOUNDARIES;
}

// ---------------------------------------------------------------------------
// Test / seed hooks — provider readiness (Prompt 15)
// ---------------------------------------------------------------------------

/** Replace the active connectivity provider for a test/seed run with the
 *  reference (deterministic) provider. Application servers do NOT call this. */
export function setConnectivityProviderForTests(p: ConnectivityProvider): void {
  connectivityProviders.set(p.id, p);
}

/** Create a deterministic reference connectivity provider for contract tests. */
export function createReferenceConnectivityProvider(config: Parameters<typeof createReferenceConnectivityProviderImpl>[0]) {
  return createReferenceConnectivityProviderImpl(config);
}

// Re-export Prompt 15 provider-readiness surface for admin/ops/health/Customer 360.
export { getProviderMetadata, providerAvailability, providerConfigState, providerHealthSnapshot, providerHealthSummary, selectProvider, type ProviderSelectionInput, describeProviderMode } from "@/lib/provider-registry";

// Webhook verification + normalization foundation (Prompt 15).
export {
  verifyProviderWebhookSignature,
  validateProviderWebhookTimestamp,
  normalizeProviderEvent,
  handleNormalizedProviderEvent,
  isEventAlreadyProcessed,
  markEventProcessed,
  mapProviderError,
  type WebhookSignatureScheme,
} from "@/lib/webhooks-server";

// Prompt 16 trust & safety readiness surface.
export { listTrustAndSafetyProviders, getTrustAndSafetyProviderMetadata, trustAndSafetyAvailability, trustAndSafetyConfigState, trustAndSafetyProviderHealthSnapshot, trustAndSafetyHealthSummary, selectTrustAndSafetyProvider, describeTrustAndSafetyProviderMode } from "@/lib/trust-and-safety-registry";

// Reference trust-and-safety test provider (Prompt 16).
export { createReferenceTrustAndSafetyProvider } from "./trust-and-safety/reference";

