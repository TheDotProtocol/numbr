// =============================================================================
// OneNumbr — Account, Security, Device & Session types (Prompt 6)
//
// Design rules:
// - The current session is identified SERVER-side: the client holds a
//   sessionId issued by the server at registration; "current" is never a
//   bare client flag.
// - No fabricated data: location is "Location unavailable" unless real;
//   IP addresses are stored as privacy-safe hashes, never raw.
// - 2FA state is honest: "unavailable" until a real provider exists.
// - Account lifecycle is safe: deactivation/deletion never destroys
//   financial, KYC or audit records.
// =============================================================================

import type { AccountStatus } from "./index";

// ---------------------------------------------------------------------------
// Sessions (sessions/{sessionId}) — server-managed
// ---------------------------------------------------------------------------

export interface SessionRecord {
  id: string;
  uid: string;
  deviceId: string | null;
  createdAt: number | null;
  lastSeenAt: number | null;
  expiresAt: number | null;
  revokedAt: number | null;
  /** SHA-256 hash prefix of the client IP — privacy-safe, never the raw IP. */
  ipHash: string | null;
  /** Human description resolved from the user agent ("Chrome on macOS"). */
  deviceDescription: string;
  /** Always "Location unavailable" in this release — never fabricated. */
  location: string;
}

/** Customer-safe session projection (currentSession resolved server-side). */
export interface SessionView {
  id: string;
  deviceId: string | null;
  deviceDescription: string;
  location: string;
  createdAt: number | null;
  lastSeenAt: number | null;
  revokedAt: number | null;
  currentSession: boolean;
}

// ---------------------------------------------------------------------------
// Devices (devices/{deviceId}) — server-coordinated registry
// ---------------------------------------------------------------------------

export interface ManagedDevice {
  id: string;
  uid: string;
  deviceName: string;
  platform: string;
  browser: string;
  deviceType: "desktop" | "mobile" | "tablet";
  trusted: boolean;
  firstSeenAt: number | null;
  lastSeenAt: number | null;
  revokedAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface DeviceView extends ManagedDevice {
  current: boolean;
  activeSessions: number;
}

// ---------------------------------------------------------------------------
// Account security (account_security/{uid})
// ---------------------------------------------------------------------------

/** Honest 2FA availability — "enabled" only when a real provider exists. */
export type TwoFactorState = "unavailable" | "setup_ready" | "enabled" | "disabled";

/** Account lifecycle — records are never destroyed by these transitions. */
export type AccountLifecycle = "active" | "deactivated" | "deletion_requested" | "deleted";

export interface AccountSecurityRecord {
  uid: string;
  /** Derived, explainable status — not a fake score. */
  securityStatus: "good" | "needs_attention";
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorState: TwoFactorState;
  twoFactorMethod: string | null;
  recoveryConfigured: boolean;
  lastPasswordChangeAt: number | null;
  lastSecurityReviewAt: number | null;
  accountState: AccountLifecycle;
  createdAt: number | null;
  updatedAt: number | null;
}

// ---------------------------------------------------------------------------
// Security activity (login_events/{eventId}) — privacy-conscious metadata
// ---------------------------------------------------------------------------

export type SecurityEventType =
  | "login_succeeded"
  | "login_failed"
  | "logout"
  | "session_revoked"
  | "sessions_revoked"
  | "password_changed"
  | "email_verified"
  | "security_updated"
  | "two_factor_changed"
  | "recovery_changed"
  | "device_removed"
  | "device_renamed"
  | "notification_preferences_updated"
  | "privacy_updated"
  | "account_deactivated"
  | "deletion_requested";

export interface SecurityEvent {
  id: string;
  uid: string;
  type: SecurityEventType;
  /** Human title, e.g. "Signed in". */
  title: string;
  /** Privacy-safe metadata (no credentials, no raw IPs). */
  metadata: Record<string, string | number | boolean | null>;
  deviceDescription: string | null;
  ipHash: string | null;
  createdAt: number | null;
}

// ---------------------------------------------------------------------------
// Notification preferences (notification_preferences/{uid})
// ---------------------------------------------------------------------------

export interface NotificationPreferences {
  uid: string;
  // Security — newLogin/sessionRevoked are MANDATORY (cannot be disabled).
  securityNewLogin: boolean;
  securitySessionChanges: boolean;
  securityChanges: boolean;
  // Identity
  identityKycUpdates: boolean;
  // Connectivity
  connectivityEsimActivation: boolean;
  connectivityEsimStatus: boolean;
  // Number
  numberActivation: boolean;
  numberRelease: boolean;
  // Billing
  billingPayments: boolean;
  billingInvoices: boolean;
  billingRefunds: boolean;
  billingSubscriptionChanges: boolean;
  // Marketing (optional)
  marketingProductNews: boolean;
  updatedAt: number | null;
}

export const MANDATORY_NOTIFICATION_KEYS: Array<keyof NotificationPreferences> = [
  "securityNewLogin",
];

// ---------------------------------------------------------------------------
// Privacy settings (privacy_settings/{uid}) — only real, enforced controls
// ---------------------------------------------------------------------------

export interface PrivacySettings {
  uid: string;
  /** Honoured for all product/service communications. */
  productCommunications: boolean;
  /** Honoured for optional announcements (marketing sends do not exist yet). */
  marketingCommunications: boolean;
  updatedAt: number | null;
}

// ---------------------------------------------------------------------------
// Unified account summary (GET /api/account) — one call for the dashboard
// ---------------------------------------------------------------------------

export interface AccountSummary {
  profile: {
    fullName: string;
    email: string;
    emailVerified: boolean;
  } | null;
  onenumbrId: string | null;
  kycState: "not_verified" | "pending" | "verified" | "rejected" | "resubmission_required";
  number: {
    numberId: string;
    displayNumber: string;
    status: string;
    capabilities: string[];
  } | null;
  esim: {
    esimId: string;
    flag: string;
    countryName: string;
    planName: string;
    status: string;
  } | null;
  billing: {
    lastPaymentAt: number | null;
    lastPaymentDescription: string | null;
    lastPaymentStatus: string | null;
  };
  /** Global Plan (Prompt 13) — server-derived from the number subscription. */
  plan: {
    status: "active" | "past_due" | "paused" | "cancelled" | "none";
    name: string;
  };
  security: {
    emailVerified: boolean;
    twoFactorState: TwoFactorState;
    securityStatus: "good" | "needs_attention";
    activeSessionCount: number;
    lastActivityAt: number | null;
  };
  device: {
    deviceId: string | null;
    deviceName: string | null;
  } | null;
  accountState: AccountLifecycle;
}
