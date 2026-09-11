# OneNumbr — Launch Checklist (Prompt 10)

Run top-to-bottom before opening traffic. Items marked with ⛔ block launch.

## Firebase project

- ⛔ Production Firebase project created; Auth email/password enabled.
- ⛔ Firestore in **production mode** with `firestore.rules` deployed.
- ⛔ `storage.rules` deployed; bucket soft-delete/versioning enabled.
- ⛔ All composite indexes deployed (`firebase deploy --only firestore:indexes`).
- ⛔ Service account key rotated; least-privileged roles; stored in secret manager.
- ⛔ Budget alert configured on the billing account.

## Environment & flags

- ⛔ `ONENUMBR_ENV=production` set on the host.
- ⛔ All `NEXT_PUBLIC_FIREBASE_*` values point at the production project.
- ⛔ `ONENUMBR_LOG_LEVEL=info`.
- ⛔ Feature flags reviewed against `docs/feature-flags.md` — real-provider
  flags off until integrations land; mock-in-production either acknowledged
  explicitly or (preferred) not allowed.
- ⛔ `ADMIN_EMAILS` contains only real operator addresses.

## Providers (demo honesty)

- ⛔ `/api/health/providers` shows expected classes with `(demo)` markers.
- ⛔ Demo-environment labeling visible in checkout and marketplace UIs.
- ⛔ No UI text claims real telecom/PSP/2FA capability (final read-through).

## Data seeds

- ⛔ `scripts/seed-esim-plans.ts` run (staging first, then prod).
- ⛔ `scripts/seed-numbers.ts` run; number inventory matches the catalog design.
- ⛔ First admin claim set via `scripts/set-admin.ts`.

## Smoke & regression (run in production)

- ⛔ `GET /api/health`, `/api/health/firebase` → ok.
- ⛔ Unauthenticated: `/app`, `/admin`, `/onboarding` → 307 to login.
- ⛔ Unauthenticated APIs → 401.
- ⛔ Signup → email verify → onboarding → OneNumbr ID issued.
- ⛔ KYC: draft → submit → admin approve (staging-tested decision path).
- ⛔ Number: search → reserve → checkout (mock payment) → assignment active.
- ⛔ eSIM: browse → checkout → provisioning (mock) → QR visible to owner only.
- ⛔ Billing: overview, transactions, invoice detail render own data only.
- ⛔ Failure path: forced mock payment failure → no order paid, no service.
- ⛔ Support: create → reply → staff note (invisible to customer) → resolve.
- ⛔ Rate limiting: 6 rapid ticket creations → 5 succeed, 1 cooldown error.
- ⛔ Security headers present on `curl -I` (CSP, HSTS, XFO, nosniff).

## Operations

- ⛔ Monitoring provider registered (or documented as pending) —
  `lib/monitoring.ts` is the single wiring point.
- ⛔ Uptime monitor pointed at `/api/health` (and `/api/health/firebase`).
- ⛔ Daily Firestore export schedule configured (see production-readiness §Backup).
- ⛔ Rollback tested once in staging (previous build + previous rules).
- ⛔ Support operators have admin or support claims; password manager/2FA on
  the Google accounts that own the Firebase project.

## Known launch requirements (documented, not implemented)

- Refresh-token invalidation on role demotion: rely on 1-hour token TTL or
  add `revokeRefreshTokens` (see `security-audit.md` §1).
- CORS: same-origin only today; add an explicit allowlist before shipping any
  non-web client.
- Search: queue search is page-bounded; a real substring index (Algolia/
  Typesense) is the documented future path.
