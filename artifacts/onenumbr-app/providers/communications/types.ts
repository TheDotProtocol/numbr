// =============================================================================
// OneNumbr — CommunicationsProvider contract (Prompt 11)
//
// The communications layer sits ABOVE connectivity:
//
//   OneNumbr Communications Layer
//        ↓
//   CommunicationsProvider          ← this interface
//        ↓
//   TelecomProvider (numbering / provisioning)
//        ↓
//   Carrier / PSTN / MNO / MVNO / cloud telephony (future)
//
// Every operation is against a OneNumbr Number (application-level identity).
// A future PSTN adapter implements the same interface with real routing.
// =============================================================================

import type {
  CallDirection,
  CallRecord,
  CallStatus,
  CallTerminationReason,
  MessageDirection,
  MessageStatus,
  VoicemailStatus,
} from "@/types/communications";

// --- Voice -------------------------------------------------------------------

export interface InitiateCallInput {
  numberId: string;
  to: { label: string; canonical?: string | null };
}

export interface CallUpdate {
  callId: string;
  status?: CallStatus;
  answeredAt?: number | null;
  endedAt?: number | null;
  durationSeconds?: number | null;
  terminationReason?: CallTerminationReason | null;
}

// --- Messaging ----------------------------------------------------------------

export interface SendMessageInput {
  numberId: string;
  to: { label: string; canonical?: string | null };
  body: string;
}

// --- Voicemail -----------------------------------------------------------------

export interface CreateVoicemailInput {
  numberId: string;
  caller: { label: string; canonical?: string | null };
  durationSeconds: number;
  transcript: string | null;
}

// --- Provider interface --------------------------------------------------------

export interface CommunicationsProvider {
  readonly name: string;

  // Voice
  initiateCall(input: InitiateCallInput): Promise<{ providerReference: string; startedAt: number }>;
  updateCallStatus(callId: string, update: CallUpdate): Promise<void>;
  getCallStatus(providerReference: string): Promise<CallStatus>;
  endCall(providerReference: string, reason: CallTerminationReason): Promise<void>;
  forwardCall(providerReference: string, destination: string): Promise<void>;

  // Messaging
  sendMessage(input: SendMessageInput): Promise<{ providerReference: string; createdAt: number }>;
  receiveMessage(input: {
    numberId: string;
    from: { label: string; canonical?: string | null };
    body: string;
  }): Promise<{ providerReference: string; createdAt: number }>;
  getMessageStatus(providerReference: string): Promise<MessageStatus>;

  // Voicemail
  createVoicemail(input: CreateVoicemailInput): Promise<{ providerReference: string; createdAt: number }>;
  getVoicemails(numberId: string): Promise<Array<{ providerReference: string; createdAt: number; durationSeconds: number }>>;
  markVoicemailRead(providerReference: string): Promise<void>;

  // History (provider-side views; OneNumbr keeps durable records server-side)
  getCallHistory(numberId: string): Promise<Array<{ providerReference: string; direction: CallDirection; createdAt: number }>>;
  getMessageHistory(numberId: string): Promise<Array<{ providerReference: string; direction: MessageDirection; createdAt: number }>>;
}

/** Helper type for the demo provider's VoicemailStatus usage. */
export type { VoicemailStatus };
