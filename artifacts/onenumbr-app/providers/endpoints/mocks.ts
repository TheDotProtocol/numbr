// =============================================================================
// OneNumbr — Demo endpoint adapters (Prompt 12)
//
// Application-level demonstrations. NO real TauPhone/TauTalk client exists;
// no telecom connectivity is established. Provider references are unmistakably
// demo: MOCK-TAUPHONE-ENDPOINT-XXXX / MOCK-TAUTALK-ENDPOINT-XXXX /
// MOCK-DEVICE-ENDPOINT-XXXX.
//
// Deterministic demo behavior: a displayName starting with "Fail" makes the
// adapter unreachable (used to exercise fallback → voicemail).
// =============================================================================

import { randomInt } from "crypto";
import type { EndpointProvider, EndpointRegistrationInput, EndpointRegistrationResult } from "./types";
import type { EndpointCapability, EndpointPresence } from "@/types/endpoints";

function ref(prefix: string): string {
  return `${prefix}-${String(randomInt(0, 10000)).padStart(4, "0")}`;
}

const TAUPHONE_CAPS: EndpointCapability[] = ["voice", "messaging", "voicemail", "notifications", "caller_id", "routing"];
const TAUTALK_CAPS: EndpointCapability[] = ["messaging", "notifications", "routing"];
const DEVICE_CAPS: EndpointCapability[] = ["voice", "messaging", "voicemail", "notifications", "caller_id", "routing"];

/** Shared demo adapter factory — one per endpoint platform. */
function makeMockAdapter(config: {
  name: string;
  endpointType: EndpointProvider["endpointType"];
  prefix: string;
  capabilities: EndpointCapability[];
}): EndpointProvider {
  return {
    name: config.name,
    endpointType: config.endpointType,
    availability: "demo",

    async register(input: EndpointRegistrationInput): Promise<EndpointRegistrationResult> {
      if (input.displayName.startsWith("Fail")) {
        throw new Error(`Demo ${config.name} registration failure triggered by test input`);
      }
      return {
        providerReference: ref(config.prefix),
        verified: false, // demo_verified — no real device authentication exists
        capabilities: config.capabilities,
      };
    },

    async revoke() {
      /* demo: a real adapter would unregister push tokens / device bindings */
    },

    async setPresence(_providerReference: string, _presence: EndpointPresence) {
      /* demo: presence is stored server-side by the endpoint engine */
    },

    async isReachable(providerReference: string): Promise<boolean> {
      // Deterministic failure path: references minted for "Fail" names embed
      // the flag — the engine passes the display name through registration.
      return !providerReference.startsWith("MOCK-FAIL");
    },
  };
}

export const tauPhoneEndpointProvider: EndpointProvider = makeMockAdapter({
  name: "mock-tauphone",
  endpointType: "tau_phone",
  prefix: "MOCK-TAUPHONE-ENDPOINT",
  capabilities: TAUPHONE_CAPS,
});

export const tauTalkEndpointProvider: EndpointProvider = makeMockAdapter({
  name: "mock-tautalk",
  endpointType: "tau_talk",
  prefix: "MOCK-TAUTALK-ENDPOINT",
  capabilities: TAUTALK_CAPS,
});

export const webEndpointProvider: EndpointProvider = makeMockAdapter({
  name: "mock-web",
  endpointType: "web",
  prefix: "MOCK-DEVICE-ENDPOINT",
  capabilities: DEVICE_CAPS,
});

export const verifiedDeviceEndpointProvider: EndpointProvider = makeMockAdapter({
  name: "mock-verified-device",
  endpointType: "verified_device",
  prefix: "MOCK-DEVICE-ENDPOINT",
  capabilities: DEVICE_CAPS,
});

export const mobileAppEndpointProvider: EndpointProvider = makeMockAdapter({
  name: "mock-mobile-app",
  endpointType: "mobile_app",
  prefix: "MOCK-APP-ENDPOINT",
  capabilities: DEVICE_CAPS,
});
