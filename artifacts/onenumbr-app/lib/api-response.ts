// =============================================================================
// OneNumbr — Unified API error responses + request IDs (Prompt 10)
//
// Every API error leaves the server in ONE shape:
//
//   { error: { message, code, requestId, timestamp } }
//
// - Stack traces, provider payloads and Firestore internals never leave the
//   server (the existing AppError system already guarantees safe messages;
//   this adds the envelope and the request id).
// - requestId is a correlation handle: it appears in server logs (via
//   lib/logger.ts) and in the client-visible error, so a support agent can
//   find the exact server log line from a user-reported error.
// =============================================================================

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { appError, type AppError } from "@/lib/errors";

const REQUEST_ID_HEADER = "x-onenumbr-request-id";

/** Get or create the request id for the current call chain. */
export function getRequestId(req?: Request): string {
  const incoming = req?.headers.get(REQUEST_ID_HEADER) ?? "";
  return /^[\w-]{8,64}$/.test(incoming) ? incoming : `req_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

interface ApiErrorBody {
  error: {
    message: string;
    code: string;
    requestId: string;
    timestamp: string;
  };
}

/**
 * Build the unified error envelope from any thrown value. The AppError system
 * remains the source of user-safe messages; this adds requestId + timestamp
 * and logs the technical detail server-side with the same id.
 */
export function buildErrorBody(err: unknown, requestId: string): { status: number; body: ApiErrorBody } {
  const appErr: AppError =
    err instanceof Error && "userMessage" in err
      ? (err as AppError)
      : err instanceof Error
        ? appError("server", err.message)
        : appError("server", String(err));

  const status =
    appErr.code === "permission-denied" ? 403
    : appErr.code === "not-found" ? 404
    : appErr.code === "already-exists" ? 409
    : appErr.code === "invalid-data" ? 400
    : appErr.code.startsWith("auth/") ? 401
    : 500;

  // Server-side technical log with the correlation id; safe details only.
  logger.error("api_error", {
    requestId,
    code: appErr.code,
    detail: appErr.message,
  });

  return {
    status,
    body: {
      error: {
        message: appErr.userMessage,
        code: appErr.code,
        requestId,
        timestamp: new Date().toISOString(),
      },
    },
  };
}

/** NextResponse with the unified error envelope + request-id header. */
export function errorResponse(err: unknown, requestId: string): NextResponse {
  const { status, body } = buildErrorBody(err, requestId);
  const res = NextResponse.json(body, { status });
  res.headers.set(REQUEST_ID_HEADER, requestId);
  return res;
}

/** Attach the request id to any success response for end-to-end correlation. */
export function withRequestId(res: NextResponse, requestId: string): NextResponse {
  res.headers.set(REQUEST_ID_HEADER, requestId);
  return res;
}
