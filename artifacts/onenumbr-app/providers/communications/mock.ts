// =============================================================================
// OneNumbr — MockCommunicationsProvider (Prompt 11)
//
// Development/demo implementation of the CommunicationsProvider contract.
// Every artifact it produces is unmistakably demo data:
//   - provider name "mock-communications"
//   - references MOCK-CALL-XXXX / MOCK-MSG-XXXX / MOCK-VM-XXXX
//
// It does NOT touch the public telephone network, does NOT deliver real SMS
// and does NOT place real calls. The UI must always surface this honestly.
//
// Deterministic demo behavior:
//   - a `to.label` starting with "Fail" fails the operation (testing paths)
//   - messages transition queued → sent → delivered deterministically
//   - calls follow initiated → ringing → answered → ended when driven
// =============================================================================

import { randomInt } from "crypto";
import type { CommunicationsProvider } from "./types";

function mockRef(prefix: "MOCK-CALL" | "MOCK-MSG" | "MOCK-VM"): string {
  return `${prefix}-${String(randomInt(0, 10000)).padStart(4, "0")}`;
}

export const mockCommunicationsProvider: CommunicationsProvider = {
  name: "mock-communications",

  // --- Voice ---------------------------------------------------------------

  async initiateCall(input) {
    if (input.to.label.startsWith("Fail")) {
      throw new Error("Demo call failure triggered by test input");
    }
    return { providerReference: mockRef("MOCK-CALL"), startedAt: Date.now() };
  },

  async updateCallStatus() {
    /* demo: state is stored server-side by the engine; nothing to push */
  },

  async getCallStatus() {
    return "ended";
  },

  async endCall() {
    /* demo: termination recorded by the engine */
  },

  async forwardCall(_providerReference, destination) {
    if (destination.startsWith("Fail")) {
      throw new Error("Demo forward failure triggered by test input");
    }
    /* demo: a real adapter would instruct the carrier here */
  },

  // --- Messaging -----------------------------------------------------------

  async sendMessage(input) {
    if (input.to.label.startsWith("Fail")) {
      throw new Error("Demo message failure triggered by test input");
    }
    return { providerReference: mockRef("MOCK-MSG"), createdAt: Date.now() };
  },

  async receiveMessage(input) {
    return { providerReference: mockRef("MOCK-MSG"), createdAt: Date.now() };
  },

  async getMessageStatus() {
    return "delivered";
  },

  // --- Voicemail -----------------------------------------------------------

  async createVoicemail(input) {
    return { providerReference: mockRef("MOCK-VM"), createdAt: Date.now() };
  },

  async getVoicemails() {
    return []; // durable records live in OneNumbr's own store
  },

  async markVoicemailRead() {
    /* demo: read state is owned by the engine */
  },

  // --- History -------------------------------------------------------------

  async getCallHistory() {
    return [];
  },

  async getMessageHistory() {
    return [];
  },
};
