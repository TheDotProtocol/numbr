// =============================================================================
// OneNumbr — Communications service (client-side)
// Thin typed wrappers over /api/communications/*. Identity and ownership are
// resolved server-side; this layer never sends uid or provider data.
// =============================================================================

import { toAppError } from "@/lib/errors";
import type {
  CallRecord,
  CommunicationsOverview,
  CommunicationEndpoint,
  MessageRecord,
  RoutingAction,
  RoutingRule,
  VoicemailRecord,
} from "@/types/communications";

async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw toAppError(err);
  }
  const payload = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok) throw new Error(payload?.message ?? `Request failed (${res.status})`);
  return payload as T;
}

async function sendJson<T>(url: string, method: "POST" | "PUT" | "PATCH", body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw toAppError(err);
  }
  const payload = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok) throw new Error(payload?.message ?? "Request failed.");
  return payload as T;
}

export async function fetchCommunicationsOverview(): Promise<CommunicationsOverview> {
  const data = await getJson<{ overview: CommunicationsOverview }>("/api/communications");
  return data.overview;
}

export async function listCalls(limit = 25): Promise<CallRecord[]> {
  const data = await getJson<{ calls: CallRecord[] }>(`/api/communications/calls?limit=${limit}`);
  return data.calls;
}

export function initiateCall(to: string): Promise<{ call: CallRecord }> {
  return sendJson("/api/communications/calls", "POST", { action: "initiate", to });
}

export function updateCall(input: {
  callId: string;
  status: "ringing" | "answered" | "ended";
  terminationReason?: string;
}): Promise<{ call: CallRecord }> {
  return sendJson("/api/communications/calls", "POST", { action: "update", ...input });
}

export async function listMessages(limit = 25): Promise<MessageRecord[]> {
  const data = await getJson<{ messages: MessageRecord[] }>(`/api/communications/messages?limit=${limit}`);
  return data.messages;
}

export function sendMessage(to: string, body: string): Promise<{ message: MessageRecord }> {
  return sendJson("/api/communications/messages", "POST", { action: "send", to, body });
}

export function markMessageRead(messageId: string): Promise<{ message: MessageRecord }> {
  return sendJson("/api/communications/messages", "POST", { action: "mark_read", messageId });
}

export async function listVoicemails(limit = 25): Promise<VoicemailRecord[]> {
  const data = await getJson<{ voicemails: VoicemailRecord[] }>(`/api/communications/voicemails?limit=${limit}`);
  return data.voicemails;
}

export function markVoicemailRead(voicemailId: string): Promise<{ voicemail: VoicemailRecord }> {
  return sendJson("/api/communications/voicemails", "POST", { action: "mark_read", voicemailId });
}

export async function fetchRouting(): Promise<{
  number: CommunicationsOverview["number"];
  routing: RoutingRule | null;
  endpoints: CommunicationEndpoint[];
}> {
  return getJson("/api/communications/routing");
}

export function updateRouting(input: {
  steps: RoutingAction[];
  forwardEndpointId?: string | null;
  ringTimeoutSeconds?: number;
}): Promise<{ routing: RoutingRule }> {
  return sendJson("/api/communications/routing", "PUT", input);
}

export const communicationsService = {
  fetchCommunicationsOverview,
  listCalls,
  initiateCall,
  updateCall,
  listMessages,
  sendMessage,
  markMessageRead,
  listVoicemails,
  markVoicemailRead,
  fetchRouting,
  updateRouting,
};
