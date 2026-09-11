// =============================================================================
// OneNumbr — Endpoints service (client-side; Prompt 12)
// Thin typed wrappers. Identity/ownership resolved server-side.
// =============================================================================

import { toAppError } from "@/lib/errors";
import type { EndpointRoutingDecision, EndpointType, EndpointView } from "@/types/endpoints";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw toAppError(err);
  }
  const payload = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok) throw new Error(payload?.message ?? "Request failed.");
  return payload as T;
}

export async function listMyEndpoints(): Promise<EndpointView[]> {
  const data = await json<{ endpoints: EndpointView[] }>("/api/communications/endpoints");
  return data.endpoints;
}

export function registerEndpoint(input: {
  type: EndpointType;
  name: string;
  platform?: string;
  deviceId?: string | null;
}): Promise<{ endpoint: EndpointView }> {
  return json("/api/communications/endpoints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function endpointAction(
  endpointId: string,
  action: "revoke" | "activate" | "suspend",
  reason?: string,
): Promise<{ endpoint: EndpointView }> {
  return json(`/api/communications/endpoints/${endpointId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, reason }),
  });
}

export function setPrimaryEndpoint(endpointId: string): Promise<{ endpoint: EndpointView }> {
  return json("/api/communications/endpoints", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set_primary", endpointId }),
  });
}

export function setEndpointPresence(endpointId: string, presence: "online" | "offline" | "busy"): Promise<{ endpoint: EndpointView }> {
  return json("/api/communications/endpoints", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set_presence", endpointId, presence }),
  });
}

export function simulateRouting(kind: "call" | "message"): Promise<{ decision: EndpointRoutingDecision }> {
  return json("/api/communications/endpoints", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });
}

export const endpointsService = {
  listMyEndpoints,
  registerEndpoint,
  endpointAction,
  setPrimaryEndpoint,
  setEndpointPresence,
  simulateRouting,
};
