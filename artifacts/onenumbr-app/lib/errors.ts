// =============================================================================
// OneNumbr — Consistent error system
//
// Firebase and network errors are never surfaced raw to users. Every error is
// translated to a safe, human-readable message; technical detail is logged to
// the console for debugging.
// =============================================================================

import { FirebaseError } from "firebase/app";

export type AppErrorCode =
  | "auth/invalid-credentials"
  | "auth/email-in-use"
  | "auth/invalid-email"
  | "auth/weak-password"
  | "auth/too-many-attempts"
  | "auth/unverified-email"
  | "auth/user-not-found"
  // generic auth buckets
  | "auth/operation-not-allowed"
  | "auth/requires-recent-login"
  | "auth/wrong-password"
  | "auth/user-mismatch"
  | "auth/invalid-action-code"
  | "auth/expired-action-code"
  | "auth/network"
  | "auth/unknown"
  // provider readiness (Prompt 15) — provider error buckets, mapped from raw provider errors
  | "provider_auth_failed"
  | "provider_rate_limited"
  | "provider_temporarily_unavailable"
  | "provider_unavailable"
  | "provider_unsupported"
  | "provider_configuration_error"
  | "provider_number_unavailable"
  | "provider_provisioning_failed"
  | "provider_activation_failed"
  | "provider_termination_failed"
  | "provider_timeout"
  | "provider_duplicate_request"
  | "provider_unknown"
  | "permission-denied"
  | "not-found"
  | "already-exists"
  | "invalid-data"
  | "network"
  | "server"
  | "unknown";

const FRIENDLY_MESSAGES: Record<AppErrorCode, string> = {
  "auth/invalid-credentials": "Incorrect email or password. Please try again.",
  "auth/email-in-use": "An account with this email already exists.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/weak-password": "That password is too weak. Use at least 8 characters.",
  "auth/too-many-attempts":
    "Too many attempts. Please wait a moment and try again.",
  "auth/unverified-email":
    "Please verify your email address before continuing. Check your inbox for the verification link.",
  "auth/user-not-found":
    "No account found with that email. Check the address or create an account.",
  "auth/operation-not-allowed":
    "This sign-in method is not enabled yet. Contact support if you believe this is an error.",
  "auth/requires-recent-login":
    "For security, please sign in again before doing this.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/user-mismatch": "The signed-in user does not match this request.",
  "auth/invalid-action-code":
    "This link is invalid or has already been used. Request a new one.",
  "auth/expired-action-code": "This link has expired. Please request a new one.",
  "auth/network": "Network problem. Check your connection and try again.",
  "auth/unknown": "Something went wrong. Please try again.",
  // provider readiness (Prompt 15) — provider errors mapped from raw provider responses
  provider_auth_failed: "The connectivity/communications provider rejected the request. Please try again.",
  provider_rate_limited: "The connectivity/communications provider is busy. Please wait and try again.",
  provider_temporarily_unavailable: "The connectivity/communications provider is temporarily unavailable. Please try again shortly.",
  provider_unavailable: "The connectivity/communications provider is unavailable. Please try again later.",
  provider_unsupported: "That request isn't supported by the current connectivity provider.",
  provider_configuration_error: "The connectivity/communications provider isn't configured correctly. Please contact support.",
  provider_number_unavailable: "That number isn't available from the current provider.",
  provider_provisioning_failed: "Connectivity setup failed. Please try again or contact support.",
  provider_activation_failed: "Connectivity activation failed. Please try again or contact support.",
  provider_termination_failed: "Connectivity termination failed. Please try again or contact support.",
  provider_timeout: "The connectivity/communications provider didn't respond in time. Please try again.",
  provider_duplicate_request: "That request was already processed.",
  provider_unknown: "The connectivity/communications provider returned an unexpected error. Please try again.",
  "permission-denied": "You don't have permission to do that.",
  "not-found": "We couldn't find that record.",
  "already-exists": "That record already exists.",
  "invalid-data": "Some of the information provided is invalid.",
  network: "Network problem. Check your connection and try again.",
  server: "The service is temporarily unavailable. Please try again shortly.",
  unknown: "Something went wrong. Please try again.",
};

/** Normalize any thrown value into an AppError. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof FirebaseError) {
    const code = err.code as string;
    const mapped = mapFirebaseCode(code);
    // Log full technical detail for debugging; never shown to users.
    console.error(`[OneNumbr] ${code}: ${err.message}`);
    return new AppError(mapped, FRIENDLY_MESSAGES[mapped], { cause: err });
  }

  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    console.error("[OneNumbr] network error:", err.message);
    return new AppError("network", FRIENDLY_MESSAGES.network, { cause: err });
  }

  console.error("[OneNumbr] unexpected error:", err);
  return new AppError("unknown", FRIENDLY_MESSAGES.unknown, { cause: err });
}

function mapFirebaseCode(code: string): AppErrorCode {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "auth/invalid-credentials";
    case "auth/email-already-in-use":
      return "auth/email-in-use";
    case "auth/invalid-email":
      return "auth/invalid-email";
    case "auth/weak-password":
      return "auth/weak-password";
    case "auth/too-many-requests":
      return "auth/too-many-attempts";
    case "auth/requires-recent-login":
      return "auth/requires-recent-login";
    case "auth/user-mismatch":
    case "auth/no-current-user":
      return "auth/user-mismatch";
    case "auth/invalid-action-code":
      return "auth/invalid-action-code";
    case "auth/expired-action-code":
      return "auth/expired-action-code";
    case "auth/network-request-failed":
      return "auth/network";
    case "auth/operation-not-allowed":
      return "auth/operation-not-allowed";
    case "permission-denied":
      return "permission-denied";
    case "not-found":
      return "not-found";
    case "already-exists":
      return "already-exists";
    case "unavailable":
      return "network";
    default:
      return "auth/unknown";
  }
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly userMessage: string;

  constructor(code: AppErrorCode, userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

/** Convenience constructor for raising typed errors in services. */
export function appError(code: AppErrorCode, detail?: string): AppError {
  if (detail) console.error(`[OneNumbr] ${code}: ${detail}`);
  return new AppError(code, FRIENDLY_MESSAGES[code]);
}
