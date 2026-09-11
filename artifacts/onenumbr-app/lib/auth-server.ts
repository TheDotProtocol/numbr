// =============================================================================
// OneNumbr — Token verification + custom claim management (server-side)
// =============================================================================

import { getAdminAuth } from "@/firebase/admin";
import type { ApiIdentity } from "@/lib/api";
import { appError } from "@/lib/errors";

/** Verify a Firebase ID token and map it to an ApiIdentity. */
export async function verifyIdTokenSafely(
  token: string,
): Promise<ApiIdentity | null> {
  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    const role = decoded.role;
    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      role: role === "admin" || role === "support" ? role : "user",
      emailVerified: Boolean(decoded.email_verified),
    };
  } catch (err) {
    console.error(
      "[OneNumbr] token verification failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Set or clear the server-side `role` custom claim. Only callable from
 * server contexts (API routes, scripts). Never trust client input here.
 */
export async function setUserRoleClaim(
  uid: string,
  role: "user" | "admin" | "support",
): Promise<void> {
  try {
    await getAdminAuth().setCustomUserClaims(uid, { role });
  } catch (err) {
    throw appError(
      "server",
      `setUserRoleClaim failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
