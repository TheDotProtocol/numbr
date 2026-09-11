// =============================================================================
// OneNumbr — App navigation structure (Prompt 14)
//
// Primary product surface: Dashboard / Identity / Number / Communications /
// Connectivity / Billing. "Connectivity" is the service layer experience
// (/app/connectivity); the eSIM marketplace remains reachable from there as
// one mechanism — not the product. Account & system surface is a grouped
// section below. Routes are the existing architecture (no duplicates).
// =============================================================================

import {
  LayoutDashboard,
  Fingerprint,
  Hash,
  MessagesSquare,
  SignalHigh,
  Smartphone,
  CreditCard,
  ShieldCheck,
  Settings,
  LifeBuoy,
  CircleHelp,
  Bell,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Modules arriving in later prompts render a "coming soon" hint. */
  soon?: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/app", icon: LayoutDashboard },
  { label: "Identity", href: "/app/identity", icon: Fingerprint },
  { label: "Number", href: "/app/number", icon: Hash },
  { label: "Communications", href: "/app/communications", icon: MessagesSquare },
  { label: "Connectivity", href: "/app/connectivity", icon: SignalHigh },
  { label: "Billing", href: "/app/billing", icon: CreditCard },
];

export const ACCOUNT_NAV: NavItem[] = [
  { label: "Account", href: "/app/account", icon: Settings },
  { label: "Security", href: "/app/security", icon: ShieldCheck },
  { label: "Devices", href: "/app/devices", icon: Smartphone },
  { label: "Support", href: "/app/support", icon: LifeBuoy },
  { label: "Help", href: "/app/help", icon: CircleHelp },
];

/** Back-compat export for any consumer of the flat list. */
export const APP_NAV: NavItem[] = [...PRIMARY_NAV, ...ACCOUNT_NAV];

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Platform", items: PRIMARY_NAV },
  { label: "Account", items: ACCOUNT_NAV },
];

export const NOTIFICATIONS_ICON = Bell;
