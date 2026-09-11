// =============================================================================
// OneNumbr — Onboarding service (client-side)
//
// Two server round-trips:
//   POST /api/onboarding/profile  — persist the profile (server-validated)
//   POST /api/onboarding/generate-id — allocate the permanent OneNumbr ID
// =============================================================================

import { appError, toAppError } from "@/lib/errors";
import type { OneNumbrIdRecord } from "@/types";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch (err) {
    // fetch() rejects on network failure.
    throw toAppError(err);
  }

  if (res.status === 401) {
    throw appError("auth/unknown", "session expired");
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON body — fall through with generic mapping below.
  }

  if (!res.ok) {
    const code = (payload as { code?: string } | null)?.code;
    if (code === "conflict") throw appError("already-exists", "id already allocated");
    if (code === "forbidden") throw appError("permission-denied", "forbidden by server");
    throw appError("server", `onboarding API ${res.status}`);
  }

  return payload as T;
}

/** Persist profile setup (server-side validation + write). */
export async function submitProfileSetup(input: {
  fullName: string;
  country: string;
  phone?: string;
  timezone?: string;
}): Promise<{ ok: true }> {
  return postJson<{ ok: true }>("/api/onboarding/profile", input);
}

/** Allocate the user's permanent OneNumbr ID (server-generated). */
export async function requestOneNumbrId(): Promise<OneNumbrIdRecord> {
  const res = await postJson<{ identity: OneNumbrIdRecord }>(
    "/api/onboarding/generate-id",
    {},
  );
  return res.identity;
}

export const onboardingService = {
  submitProfileSetup,
  requestOneNumbrId,
};
