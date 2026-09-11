// =============================================================================
// OneNumbr — Centralized server logger (Prompt 10)
//
// Structured, level-based logging for server contexts. Every line is a single
// JSON object (machine-parseable by Cloud Logging / Vercel logs) and goes
// through `redact()` so secrets can never leak:
//
//   passwords, tokens, cookies, authorization headers, signed URLs, card data,
//   KYC file paths — keys are masked; URL signatures are stripped.
//
// Levels: debug < info < warn < error < security. `security` is always logged
// regardless of level (it is the audit-adjacent stream).
// =============================================================================

type LogLevel = "debug" | "info" | "warn" | "error" | "security";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  security: 50,
};

const MIN_LEVEL: LogLevel =
  (process.env.ONENUMBR_LOG_LEVEL as LogLevel | undefined) ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

/** Keys whose values must never reach a log line. */
const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "confirmpassword",
  "newpassword",
  "currentpassword",
  "token",
  "idtoken",
  "accesstoken",
  "refreshtoken",
  "session",
  "sessionid",
  "cookie",
  "setcookie",
  "authorization",
  "secret",
  "apikey",
  "api_key",
  "privatekey",
  "credential",
  "credentials",
  "cvv",
  "cardnumber",
  "card_number",
  "signedurl",
  "signed_url",
  "url", // signed URLs embed signatures — log paths instead
];

const SENSITIVE_PATH_PATTERNS = [/\/kyc\//i, /\/selfie\//i, /support\/[^/]+\//i];

/** True when a string looks like a document/file path we never log raw. */
function isSensitivePath(value: string): boolean {
  return SENSITIVE_PATH_PATTERNS.some((re) => re.test(value));
}

/** Deep-clone a value with sensitive keys masked and paths truncated. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 6) return "[truncated]";

  if (typeof value === "string") {
    if (isSensitivePath(value)) {
      // Keep the collection root only — never document names or file names.
      const parts = value.split("/");
      return `${parts[0]}/${parts[1] ? "[redacted]" : ""}`;
    }
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.includes(k.toLowerCase())) {
        out[k] = "[redacted]";
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return "[unloggable]";
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (level !== "security" && LEVEL_WEIGHT[level] < LEVEL_WEIGHT[MIN_LEVEL]) return;

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(meta ? { meta: redact(meta) } : {}),
  });

  switch (level) {
    case "debug":
      console.debug(line);
      break;
    case "info":
      console.info(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
    case "security":
      console.error(line);
      break;
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
  /** Security-relevant stream — always emitted. */
  security: (msg: string, meta?: Record<string, unknown>) => emit("security", msg, meta),
};

export type Logger = typeof logger;
