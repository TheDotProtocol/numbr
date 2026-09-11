// =============================================================================
// OneNumbr — Admin route guard
// =============================================================================

import { appError } from "@/lib/errors";
import { getApiIdentity, type ApiIdentity } from "@/lib/api";

/** Throws permission-denied unless the caller carries the admin claim. */
export async function requireAdmin(): Promise<ApiIdentity> {
  const identity = await getApiIdentity();
  if (!identity) {
    throw appError("auth/unknown", "not authenticated");
  }
  if (identity.role !== "admin") {
    throw appError("permission-denied", "admin role required");
  }
  return identity;
}

/**
 * Throws unless the caller carries the admin or support claim.
 * Support agents can read tickets/customers and act on support workflows,
 * but financial mutations still require the admin role (enforced at each
 * route, not here).
 */
export async function requireStaff(): Promise<ApiIdentity> {
  const identity = await getApiIdentity();
  if (!identity) {
    throw appError("auth/unknown", "not authenticated");
  }
  if (identity.role !== "admin" && identity.role !== "support") {
    throw appError("permission-denied", "staff role required");
  }
  return identity;
}

/** Throws unless the caller is authenticated (any role). */
export async function requireUser(): Promise<ApiIdentity> {
  const identity = await getApiIdentity();
  if (!identity) {
    throw appError("auth/unknown", "not authenticated");
  }
  return identity;
}
