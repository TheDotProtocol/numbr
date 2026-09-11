// =============================================================================
// OneNumbr — Shared API route helpers (server-side)
// =============================================================================

import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { appError, type AppError } from "@/lib/errors";

export interface ApiIdentity {
  uid: string;
  email: string;
  role: "user" | "admin" | "support";
  emailVerified: boolean;
}

/**
 * Read the session token from the request (cookie first, then
 * Authorization: Bearer header) and verify it with the Admin SDK.
 * Returns null when the caller is not authenticated.
 */
export async function getApiIdentity(): Promise<ApiIdentity | null> {
  const { verifyIdTokenSafely } = await import("@/lib/auth-server");

  let token = "";
  try {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE)?.value ?? "";
  } catch {
    // cookies() unavailable — fall through to headers.
  }
  if (!token) {
    try {
      const h = await headers();
      const auth = h.get("authorization") ?? "";
      if (auth.toLowerCase().startsWith("bearer ")) token = auth.slice(7).trim();
    } catch {
      // no headers either
    }
  }
  if (!token) return null;

  return verifyIdTokenSafely(token);
}

/** Session cookie name (set by the client after login; also used by API). */
export const SESSION_COOKIE = "onenumbr_session";

/** Uniform JSON error response. Raw Firebase errors never leave the server. */
export async function jsonError(err: unknown, fallbackStatus = 500): Promise<NextResponse> {
  const appErr: AppError =
    err instanceof Error && "userMessage" in err
      ? (err as AppError)
      : appError("server", err instanceof Error ? err.message : String(err));

  const status =
    appErr.code === "permission-denied" ? 403
    : appErr.code === "not-found" ? 404
    : appErr.code === "already-exists" ? 409
    : appErr.code === "auth/unverified-email" || appErr.code.startsWith("auth/") ? 401
    : appErr.code === "invalid-data" ? 400
    : fallbackStatus;

  const isUnauthenticated =
    appErr.code === "auth/unknown" || appErr.message === "not authenticated";

  // Monitoring extension point: forward 5xx-class failures to the (future)
  // provider registered in lib/monitoring.ts. No-op today.
  if (status >= 500) {
    const { getMonitoring } = await import("@/lib/monitoring");
    getMonitoring().captureException(err, { code: appErr.code });
  }
  return NextResponse.json(
    {
      code: isUnauthenticated ? "unauthorized" : appErr.code,
      message: isUnauthenticated ? "Authentication required." : appErr.userMessage,
    },
    { status },
  );
}
