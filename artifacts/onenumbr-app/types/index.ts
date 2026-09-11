// =============================================================================
// OneNumbr — Core domain types (Foundation v1.0)
// =============================================================================

/** Role of an account. Server-assigned via custom claims + Firestore; never client-settable. */
export type UserRole = "user" | "admin" | "support";

/** Lifecycle status of an account. */
export type AccountStatus = "active" | "suspended" | "pending";

/** Lifecycle status of a OneNumbr ID. */
export type OneNumbrIdStatus = "active" | "revoked";

/** Identity verification states (KYC arrives in Prompt 2). */
export type VerificationStatus = "not_started" | "pending" | "verified" | "rejected";

/**
 * Firestore `users/{uid}` — the account record.
 * `role` and `status` are server-managed; security rules reject client writes to them.
 */
export interface UserRecord {
  uid: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: number | null;
  updatedAt: number | null;
  lastLoginAt: number | null;
}

/**
 * Firestore `profiles/{uid}` — editable profile.
 */
export interface ProfileRecord {
  uid: string;
  fullName: string;
  country: string; // ISO 3166-1 alpha-2, "" when unset
  phone: string; // optional
  avatarUrl: string;
  timezone: string;
  createdAt: number | null;
  updatedAt: number | null;
}

/**
 * Firestore `onenumbr_ids/{uid}` — the permanent OneNumbr identity ID.
 * Immutable from the client by security rules.
 */
export interface OneNumbrIdRecord {
  uid: string;
  onenumbr: string; // e.g. "ON-284739"
  status: OneNumbrIdStatus;
  createdAt: number | null;
  updatedAt: number | null;
}

/** Firestore `devices/{uid}/{deviceId}` — device/session registry. */
export interface DeviceRecord {
  uid: string;
  deviceId: string;
  name: string; // "Chrome on macOS"
  platform: string; // "macOS"
  browser: string; // "Chrome"
  deviceType: "desktop" | "mobile" | "tablet";
  lastActiveAt: number;
  createdAt: number | null;
}

/** Firestore `audit_logs/{logId}` — written server-side only. */
export interface AuditLogRecord {
  actorUid: string;
  action: string; // e.g. "user.status_changed"
  targetUid: string | null;
  metadata: Record<string, unknown>;
  createdAt: number | null;
}

/** Aggregate account bundle used across the UI. */
export interface AccountBundle {
  user: UserRecord;
  profile: ProfileRecord | null;
  identity: OneNumbrIdRecord | null;
}

/** Result shape for paginated admin user listing. */
export interface AdminUserListPage {
  users: UserRecord[];
  nextCursor: string | null;
}

// =============================================================================
// Future-domain placeholders — shapes only, no functionality yet.
// These keep later prompts from needing a data-model rewrite.
// =============================================================================

/** KYC case (Prompt 2). */
export interface KycCase {
  uid: string;
  status: VerificationStatus;
  submittedAt: number | null;
  reviewedAt: number | null;
  reviewerUid: string | null;
  notes: string;
}

/** Provisioned OneNumbr number (Prompt 4). */
export interface NumberRecord {
  uid: string;
  number: string;
  status: "not_activated" | "activating" | "active" | "released";
  createdAt: number | null;
}

/** eSIM purchase/order (Prompt 3). */
export interface EsimOrder {
  uid: string;
  planId: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: number | null;
}

/** Payment record (Prompt 5). */
export interface PaymentRecord {
  uid: string;
  amountMinor: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "refunded";
  createdAt: number | null;
}
