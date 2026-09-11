# OneNumbr — Platform (Foundation v1.0)

> ONE IDENTITY. ONE NUMBER. ANYWHERE.

The authenticated OneNumbr platform: accounts, identity, onboarding, and the
application foundation that Prompts 2–5 build upon.

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind CSS 4 · Firebase
(Auth, Firestore, Storage, Admin SDK, Functions scaffold)

## Quick start

```bash
# from the repo root
pnpm install

# configure (see docs/firebase-setup.md)
cp artifacts/onenumbr-app/.env.example artifacts/onenumbr-app/.env.local
#   …fill in the NEXT_PUBLIC_FIREBASE_* values from the Firebase console

pnpm --filter @workspace/onenumbr-app dev   # → http://localhost:3100
```

## Routes

| Route | Description |
| --- | --- |
| `/` | Public entry (real marketing site lives in `artifacts/numbr-website`) |
| `/signup`, `/login`, `/reset-password` | Authentication |
| `/verify-email` | Verification gate |
| `/onboarding` | Profile setup → server-issued OneNumbr ID → welcome |
| `/app` | Dashboard home (protected) |
| `/app/identity` | OneNumbr ID, account status, KYC-ready section |
| `/app/number` | Number — honest empty state (Prompt 4) |
| `/app/esim` | eSIM marketplace shell (Prompt 3) |
| `/app/devices` | Device/session registry |
| `/app/billing` | Billing foundation (Prompt 5) |
| `/app/security` | Password, sessions, 2FA placeholder |
| `/app/settings` | Profile & account settings |
| `/admin` | Admin console (role-claim protected) |

## Architecture

```
UI (app/, components/)
  ↓
Services (services/)        — all business logic, no Firebase calls in pages
  ↓
Firebase (firebase/)        — client SDK + Admin SDK wrappers
  ↓
Providers (providers/)      — vendor abstraction (eSIM/telecom/identity/payments)
```

- **Security:** Firestore/Storage rules in `firestore.rules` / `storage.rules`;
  role/status/OneNumbr-ID are server-managed and immutable from clients.
- **OneNumbr ID:** allocated server-side with transactional collision-safe
  generation (`services/identityService.ts` → `POST /api/onboarding/generate-id`).
- **Errors:** every Firebase error is mapped to a safe, friendly `AppError`
  (`lib/errors.ts`) — raw errors never reach users.

## Documentation

- `docs/firebase-setup.md` — manual console steps + credentials
- `docs/data-model.md` — Firestore/Storage model incl. future collections
- `docs/testing.md` — full acceptance walkthrough + negative security tests

## First admin

```bash
pnpm --filter @workspace/onenumbr-app set-admin you@yourdomain.com
# then sign out and sign in again
```
