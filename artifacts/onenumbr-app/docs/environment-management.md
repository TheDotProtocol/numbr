# OneNumbr — Environment Management (Prompt 10)

OneNumbr runs in three declared environments. The active mode is read from
`ONENUMBR_ENV` (`development` | `staging` | `production`) and drives provider
honesty, logging verbosity, and security-header strictness.

## Files

| File | Purpose | Committed? |
|---|---|---|
| `.env.example` | Annotated template of every variable | yes |
| `.env.development` | Local dev defaults + emulator toggles | yes (no secrets) |
| `.env.staging` | Staging config template | yes (no secrets) |
| `.env.production` | Production config template | yes (no secrets) |
| `.env.local` | Your real local secrets | **never** (git-ignored) |

On Vercel/Firebase Hosting the same variables are set in the platform's
environment configuration per project — the templates are the checklist.

## Variable reference

### Client (NEXT_PUBLIC_*, safe to expose — protected by security rules)
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` — set `true` only for the emulator suite.

### Server-only (NEVER prefix with NEXT_PUBLIC_)
- `FIREBASE_SERVICE_ACCOUNT_JSON` — full service-account JSON on one line, or
  use `GOOGLE_APPLICATION_CREDENTIALS=<path>` / Application Default
  Credentials on Cloud Run / Firebase Hosting.
- `ADMIN_EMAILS` — emails auto-granted the admin claim by `scripts/set-admin.ts`.

### Platform
- `ONENUMBR_ENV` — `development` (default) | `staging` | `production`.
- `ONENUMBR_LOG_LEVEL` — `debug` | `info` | `warn` | `error` (see
  `lib/logger.ts`). Production should use `info`.
- `ONENUMBR_ALLOW_DEMO_IN_PRODUCTION` — must be set to `true` explicitly to
  allow mock providers in production (see the provider guard below). Default:
  refused.

### Feature flags
All `FEATURE_*` flags are documented in `docs/feature-flags.md`.

## Provider mode guard

`assertProviderModeAllowed()` in `lib/features.ts` enforces honesty in both
directions:

- **production + mock provider** → refuses to boot unless
  `ONENUMBR_ALLOW_DEMO_IN_PRODUCTION=true` is set explicitly.
- **development + real provider** → refuses to boot; set
  `ONENUMBR_ENV=staging|production` first.

This makes it impossible to accidentally charge demo money in production or
call a real provider from a dev laptop.

## Secrets rules

1. Secrets live only in the host's secret manager (Vercel env vars / Cloud
   Secret Manager) or local `.env.local` (git-ignored).
2. The service account key is rotated at launch and least-privileged
   (Firestore + Auth + Storage roles only).
3. Nothing sensitive is ever `NEXT_PUBLIC_`-prefixed; the client bundle is
   audited for accidental inlining before each deploy.
4. Adding a future provider (Stripe/Sumsub/Twilio) means adding server-only
   env vars here and in `.env.example` — never in client code.
