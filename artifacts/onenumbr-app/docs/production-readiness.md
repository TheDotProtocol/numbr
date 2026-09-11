# OneNumbr — Production Readiness (Prompt 10, v1.0)

What was added to make OneNumbr deployable, observable, and safe to operate.
Companion docs: `security-audit.md`, `deployment-guide.md`,
`environment-management.md`, `feature-flags.md`, `launch-checklist.md`.

## Logging (`lib/logger.ts`)

- JSON lines: `{ ts, level, msg, meta }` — parseable by Cloud Logging/Vercel.
- Levels `debug|info|warn|error|security`; `security` always emits. Min level
  via `ONENUMBR_LOG_LEVEL` (default `info` in production).
- **Automatic redaction** — keys like password/token/cookie/authorization/
  apikey/privateKey/cvv are masked; signed URLs and KYC file paths are
  truncated to collection roots. Long strings truncated at 500 chars.
- Rule: server code logs through `logger`, never raw `console` with
  interpolated request data.

## Unified API errors + request IDs (`lib/api-response.ts`)

- Every error response: `{ error: { message, code, requestId, timestamp } }`.
- Request ID: 24-char id, propagated from `x-onenumbr-request-id` when
  present; returned in both the body and the response header.
- Server logs carry the same id (`logger.error("api_error", { requestId … })`)
  → a user-reported requestId pinpoints the exact server log line.
- Stack traces never leave the server; `lib/errors.ts` continues to own the
  user-safe message mapping.

## Monitoring extension point (`lib/monitoring.ts`)

- `MonitoringProvider` interface (captureException / captureMessage /
  addBreadcrumb / isConfigured) with a no-op default. Nothing is sent
  anywhere today.
- Integration: implement the interface, call
  `registerMonitoringProvider()` once at server bootstrap. The shared error
  path already forwards 5xx-class failures to the registered provider.
- Future providers: Sentry, Datadog, OpenTelemetry — call sites do not change.

## Health endpoints

| Endpoint | Reports |
|---|---|
| `GET /api/health` | status, environment, maintenance flag, active provider classes (mock/real), timestamp |
| `GET /api/health/firebase` | Firestore + Auth reachability (trivial reads), `503` when degraded |
| `GET /api/health/providers` | active provider registry names with explicit `(demo)` markers — no identifiers/endpoints |

All three: no secrets, no PII, safe for uptime monitors.

## Rate limiting & abuse protection (`lib/rate-limit.ts`)

- Firestore-backed fixed-window limiter: `rate_limits/{scope}:{subject}`
  with transaction-allocated windows; per-process memo skips needless
  round-trips (Firestore stays authoritative).
- Scopes: `kyc_submit` 5/h, `support_create` 5/h, `support_reply` 30/h,
  `number_reserve` 20/h, `checkout` 10/h, `session_register` 60/h,
  `admin_mutation` 120/min, `auth` 10/5min (pre-auth placeholder).
- Subject = verified uid, or SHA-256 IP hash pre-auth (raw IPs never stored).
- Over-limit → typed `auth/too-many-attempts` AppError → calm cooldown
  message via the existing error system. No CAPTCHA; extension point
  documented in the module and in `security-audit.md` §10.
- Replacement point for Upstash/Redis when multi-instance atomicity at scale
  is required: swap `applyFirestoreWindow`; call sites unchanged.

## Feature flags & maintenance (`lib/features.ts`, `middleware.ts`)

- All flags server-readable; provider guard refuses mock-in-production (and
  real-in-development) unless explicitly acknowledged. See
  `docs/feature-flags.md`.
- Maintenance mode: platform-wide flag → 307 to `/maintenance`; staff, admin,
  health and static bypass. Per-domain flags ready for engine wiring.

## Security headers (`middleware.ts`)

Applied to every response: CSP (Firebase Auth + emulators permitted; prod
build removes dev sources and `unsafe-eval`), `X-Content-Type-Options`,
`X-Frame-Options: DENY`, `Referrer-Policy`,
`Permissions-Policy` (camera/mic/geo/payment/usb denied), COOP
`same-origin`, HSTS (2y, preload) in production. Firebase auth flows verified
permitted by the CSP (`apis.google.com`, `*.googleapis.com`,
`*.firebaseio.com`, `*.firebasestorage.googleapis.com`).

## Performance audit (Part 30)

- Queries: all dashboards ride the single `getAccountSummary` (parallel
  targeted reads); admin lists are cursor/offset-paginated with bounded
  counts; support messages/notes capped at 200 per detail load. No new N+1s
  introduced (device live-session counts were already batched).
- Listeners: none added; no polling.
- Bundle: no new client dependencies (zero new packages in Prompt 10 — rate
  limiting/logger/monitoring are server-only modules).
- Payloads: 1 MB JSON body ceiling in middleware (413).
- Images/fonts unchanged from Prompt 8 (next/image + self-hosted).

## Backup & recovery (Part 32, documented strategy)

- **Firestore**: scheduled managed exports (`gcloud firestore export` /
  Firebase managed backups) daily to a separate bucket; 30-day retention;
  restore via `gcloud firestore import`. Collections that matter most:
  `users`, `onenumbr_ids`, `kyc`, `kyc_history`, `payments`, `invoices`,
  `subscriptions`, `billing_events`, `number_orders`, `esim_orders`,
  `support_tickets` (incl. subcollections), `audit_logs`.
- **Counters** (`billing_counters`, `support_counters`): exported with the
  same schedule; they are tiny but sequence-consistency matters.
- **Storage**: enable Object Versioning + soft delete on the bucket; KYC and
  support prefixes included in the export lifecycle.
- **Audit history**: immutable; included in daily exports; never mutated.
- No automatic implementation in this prompt (per scope); the schedule above
  is a runbook for launch.

## Privacy & data retention (Part 33, honest strategy)

- Account deletion: deactivation-first lifecycle (Prompt 6) — personal access
  locked, records retained; invoices/payments/KYC/audit history are retained
  because financial/tax and integrity obligations require it (stated to the
  user in-product at request time — no invented compliance claims).
- KYC documents: retained with the KYC case (review integrity); deletable by
  server-side flows when a case is voided.
- Support tickets + attachments: retained while operationally needed;
  attachments expire only via signed-URL TTLs (objects removed by ops on
  request closure per policy).
- Sessions/devices: server-side TTL (30-day expiry), revoked records retained
  in `login_events` as security history.
- Notifications: user-deletable; no third-party data sharing exists today.
- No claims of GDPR/CCPA certification are made anywhere; the lifecycle above
  is the implemented behavior.

## Global Plan readiness notes (Prompt 13)

- The Global Plan reuses the Prompt 5 billing engine; no second billing path
  exists. Plan subscriptions snapshot their economics (`planSnapshot` +
  `planVersion`), so future Stripe recurring billing can replace the mock
  provider without redesign (see `docs/global-plan-architecture.md` §9).
- Plan pause/cancel is deliberately non-destructive: number assignments,
  OneNumbr IDs, invoices and audit history are untouched. Any future
  number-release-on-cancellation policy must be an explicit product decision
  wired through the existing `releaseUserNumber` flow.
- Entitlements are server-derived (catalog × subscription × account × flags);
  clients hold no authority over plan or entitlement state.
- Pre-launch checklist addition: confirm the catalog price review, and enable
  `FEATURE_STRIPE_PAYMENTS` only with a real provider-mode acknowledgement.

## Connectivity layer readiness notes (Prompt 14)

- Connectivity is a service abstraction; every mechanism's environment honesty
  is reported by /api/health (cloud/esim demo; mno/mvno disabled;
  physicalSim/sip future; pstn disabled). No unavailable provider is reported
  healthy.
- Provider selection is server-side and gated by the `connectivity.global`
  entitlement; clients cannot select providers, flip statuses or set prices.
- Enabling MNO/MVNO requires their feature flags AND a signed carrier/host
  agreement with credentials; the provider-mode guard (Prompt 10) still
  refuses live-mode boots without explicit configuration.

## Provider readiness notes (Prompt 15)

- Provider architecture is provider-independent: numbering, connectivity and
  communications are separate concerns, and a single future vendor may or may
  not combine them.
- Providers are described by a declarative registry (`lib/provider-registry.ts`)
  with explicit capability sets, categories, environments, availability and
  configuration state — **never** with credentials, tokens, signed URLs, ICCIDs,
  IMSIs, subscriber references, SIP credentials or carrier account identifiers.
- Provider selection is server-side only; the client sends a requirement, never
  a provider id.
- Webhook architecture exists as a secure boundary (`lib/webhooks-server.ts`):
  signature verification, timestamp/replay validation, idempotency, event
  normalization, audit and safe notification routing — no real provider webhook
  is implemented yet (the route returns 503 honestly).
- Provider errors are normalized into OneNumbr domain error codes; raw provider
  messages never leak to customers.
- Provider health snapshots are honest (`not_measured` when no real traffic);
  no fabricated availability/latency/error-rate numbers.
- No uncontrolled automatic customer migration between providers exists.
- Pre-launch checklist: complete `docs/provider-onboarding-checklist.md` and the
  relevant items in `docs/telecom-regulatory-readiness.md` **before** enabling any
  real provider flag; enable real-provider flags only with an explicit
  provider-mode acknowledgement (Prompt 10), never by inference.

## Trust & safety readiness notes (Prompt 16)

- Spam/abuse/anti-automation is another replaceable infrastructure layer beneath
  OneNumbr identity, number, plan, communications and endpoints.
- Trust-and-safety providers are described by a declarative registry
  (`lib/trust-and-safety-registry.ts`) with explicit capabilities,
  categories, interfaces, environments, availability and configuration state —
  **never** with credentials or raw risk signals.
- Trust-and-safety decisions never redefine the OneNumbr identity, number, plan,
  communications or endpoints.
- Provider selection is server-side only; the client never picks a spam/abuse/
  reputation/anti-automation provider.
- Inbound/outbound guard/anti-automation/abuse-reporting are defined as
  non-operational boundaries today; no live spam filter, reputation engine,
  anti-automation challenge provider or inbound abuse pipeline exists.
- Today's protection is basic abuse-resistant design from Prompt 10: rate
  limiting, safe errors, ownership checks, audit logging, request IDs and secret
  redaction.
- Webhook/events foundation from Prompt 15 is reused for any future inbound
  trust-and-safety events (signature/timestamp/replay/idempotency).
- Pre-launch checklist: complete the relevant provider onboarding and regulatory
  items before enabling any trust-and-safety real-provider flag; enable
  real-provider flags only with explicit acknowledgement, never by inference.
