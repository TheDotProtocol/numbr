// =============================================================================
// OneNumbr — Connectivity client service (Prompt 14)
// =============================================================================

import type { ConnectivityConnection, ConnectivityMechanism } from "@/types/connectivity";

export type ConnectivityOverviewData = {
  enabled: boolean;
  entitlement: { entitled: boolean; key: string; availability: string };
  region: string | null;
  connection: ConnectivityConnection | null;
  mechanisms: { mechanism: ConnectivityMechanism; label: string; availability: string; capabilities: string[]; note: string }[];
  future: { id: string; name: string; requirement: string }[];
  provider: { id: string; name: string; demo: boolean } | null;
  identity: { oneNumbrId: string | null; primaryNumber: string | null };
  planActive: boolean;
};

/** Resolve the owner's connectivity view (server-derived truth). */
export async function fetchConnectivity(): Promise<ConnectivityOverviewData> {
  const res = await fetch("/api/connectivity", { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "We couldn't load your connectivity.");
  }
  return (await res.json()) as ConnectivityOverviewData;
}

export type ConnectivityAction = "request" | "activate" | "suspend" | "terminate";

/** Connection lifecycle. Clients never send provider ids — server decides. */
export async function connectivityAction(
  action: ConnectivityAction,
  input: { mechanism?: "cloud" | "esim"; connectionId?: string } = {},
): Promise<{ connection: ConnectivityConnection }> {
  const res = await fetch("/api/connectivity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      action === "request"
        ? { action, mechanism: input.mechanism }
        : { action, connectionId: input.connectionId },
    ),
  });
  const body = (await res.json().catch(() => ({}))) as { message?: string; connection?: ConnectivityConnection };
  if (!res.ok) throw new Error(body.message ?? "We couldn't update your connectivity.");
  return { connection: body.connection! };
}
