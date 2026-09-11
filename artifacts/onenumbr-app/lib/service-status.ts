// =============================================================================
// OneNumbr — Service status (Prompt 7)
//
// Deterministic, honest status derived from the environment. This release has
// no real provider integrations, so every service reports its true state:
// components backed by working in-app engines are "operational"; external
// network-dependent capabilities are declared "demo" — we never claim real
// telecom/payment availability and never fabricate outages.
// =============================================================================

export type ServiceStatusState = "operational" | "degraded" | "maintenance" | "unavailable" | "demo";

export type ServiceComponent = {
  id: string;
  name: string;
  description: string;
  state: ServiceStatusState;
  note: string;
};

export function getServiceStatus(): ServiceComponent[] {
  return [
    {
      id: "platform",
      name: "OneNumbr Platform",
      description: "Account, identity and dashboard services.",
      state: "operational",
      note: "All core platform services are running normally.",
    },
    {
      id: "identity",
      name: "Identity Verification",
      description: "OneNumbr ID issuance and KYC review.",
      state: "operational",
      note: "Reviews are completed manually by our team.",
    },
    {
      id: "number",
      name: "Number Services",
      description: "OneNumbr Number assignment and lifecycle.",
      state: "demo",
      note: "Numbers are application-level identities. In this environment they run on a demo telecom provider and are not connected to the public telephone network.",
    },
    {
      id: "communications",
      name: "Communications",
      description: "Voice, messaging, voicemail and routing on your OneNumbr Number.",
      state: "demo",
      note: "Communications run on a demo provider — calls, messages and voicemail are clearly-labeled simulations and are not connected to the public telephone network.",
    },
    {
      id: "endpoints",
      name: "Endpoints",
      description: "Connect your OneNumbr to this browser, TauPhone or TauTalk.",
      state: "demo",
      note: "Endpoint connections are application-level demos. Your number belongs to your identity — endpoints only change where it is reached.",
    },
    {
      id: "connectivity",
      name: "Connectivity",
      description: "The service layer underneath your OneNumbr — cloud today, eSIM, carriers and SIM later.",
      state: "demo",
      note: "Connectivity runs on a demo provider. Mechanisms (eSIM, MNO/MVNO, physical SIM, PSTN) can evolve without changing your number or plan.",
    },
    {
      id: "esim",
      name: "eSIM Services",
      description: "eSIM marketplace, purchase and activation.",
      state: "demo",
      note: "eSIM provisioning runs on a demo provider in this environment. Purchased eSIMs cannot be installed on a device.",
    },
    {
      id: "billing",
      name: "Billing",
      description: "Payments, invoices and subscriptions.",
      state: "demo",
      note: "Payments use a demo provider — no real charges are made and no card data is collected.",
    },
    {
      id: "account",
      name: "Account & Security",
      description: "Sessions, devices and security settings.",
      state: "operational",
      note: "Session and device management are fully available. Two-factor authentication is not available yet.",
    },
    {
      id: "providers",
      name: "Provider Readiness",
      description: "Declared telecom/connectivity provider slots, configuration state and health (Prompt 15).",
      state: "demo",
      note: "Provider readiness describes vendor slots and their honest configuration state — it does not enable any real provider. No live carrier, MNO, MVNO, eSIM, PSTN, SIP or physical SIM provider is configured in this environment.",
    },
  ];
}

/** Overall banner: worst non-demo state wins; demo-only platforms show the demo notice. */
export function getOverallStatus(components: ServiceComponent[]): {
  state: "operational" | "degraded" | "demo";
  message: string;
} {
  if (components.some((c) => c.state === "unavailable" || c.state === "maintenance" || c.state === "degraded")) {
    return { state: "degraded", message: "Some services are experiencing issues." };
  }
  if (components.every((c) => c.state !== "demo")) {
    return { state: "operational", message: "All systems operational." };
  }
  return {
    state: "demo",
    message: "Platform operational. Connectivity and billing run on demo providers in this environment.",
  };
}
