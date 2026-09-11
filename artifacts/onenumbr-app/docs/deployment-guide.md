# OneNumbr — Deployment Guide (Prompt 10)

OneNumbr is a standard Next.js (App Router) application with Firebase as the
backend. Two supported targets: **Vercel** (recommended for the web app) and
**Firebase App Hosting / Cloud Run** (same-project hosting).

## 0. Prerequisites

- Firebase project with **Auth (email/password)**, **Firestore (production
  mode)**, **Storage** enabled.
- Service account key (rotate at launch; least-privileged roles).
- Node 20+, `npm ci` locally.

## 1. Configure the environment

Copy `.env.example` → `.env.local` locally; for hosting, set the same vars in
the platform's environment UI per environment (dev/staging/prod). The full
variable list lives in `docs/environment-management.md`. Server secrets are
never client-prefixed.

## 2. Deploy Firebase artifacts

```bash
# indexes
firebase deploy --only firestore:indexes          # firestore.indexes.json

# security rules
firebase deploy --only firestore:rules,storage     # firestore.rules, storage.rules
```

Order matters: **rules before first traffic, indexes before features that
query them.** Composite indexes are pre-declared in `firestore.indexes.json`
(32 covering eSIM, numbers, billing, sessions, support). If a new query fails
with `failed-precondition`, the console links the exact index to create.

## 3. Seed reference data

```bash
npx tsx scripts/seed-esim-plans.ts   # eSIM catalog
npx tsx scripts/seed-numbers.ts      # number inventory
ADMIN_EMAILS=ops@yourdomain.com npx tsx scripts/set-admin.ts  # first admin claim
```

Seed scripts are idempotent and safe to re-run. Run them against staging
first, then production.

## 4. Deploy the app

### Vercel

```bash
vercel link
vercel env pull          # sanity: matches .env.production checklist
vercel --prod
```

- Build: `next build`. Region: choose closest to your users; Firebase calls
  originate from the function region — keep them near the Firebase location.
- Set `ONENUMBR_ENV=production`, `ONENUMBR_LOG_LEVEL=info`, and all
  `FEATURE_*` flags per `docs/feature-flags.md`.

### Firebase App Hosting / Cloud Run

`GOOGLE_APPLICATION_CREDENTIALS` is unnecessary — Application Default
Credentials work. Deploy the container built by `next build`; health checks
can poll `GET /api/health`.

## 5. Post-deploy verification

1. `GET /api/health` → `{"status":"ok"}` with expected provider modes.
2. `GET /api/health/firebase` → firestore+auth `ok`.
3. `GET /api/health/providers` → provider names + demo markers.
4. Sign up a test user → onboarding → ID issuance → KYC draft → eSIM browse.
5. Confirm security headers: `curl -sI https://<host>/login | grep -i
   'content-security\|strict-transport\|x-frame'`.

## 6. Rollback

- **App**: redeploy the previous immutable build (Vercel instant rollback /
  previous Cloud Run revision). Data is unaffected.
- **Rules**: redeploy the previous `firestore.rules`/`storage.rules`; rules
  are versioned in git.
- **Indexes**: never delete in-use indexes during rollback; new indexes are
  additive.

## 7. First-traffic runbook

1. Watch logs for `[OneNumbr]` lines (JSON, level-tagged; `security` stream is
   always emitted).
2. Confirm rate-limit collection (`rate_limits`) is receiving writes on the
   checkout endpoints (expected: one doc per scope:user).
3. Verify a real purchase round-trip in the mock provider with a test user.
