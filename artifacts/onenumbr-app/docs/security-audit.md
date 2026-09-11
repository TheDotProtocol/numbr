# OneNumbr — Security Audit (Prompt 10, v1.0)

Full-codebase security audit performed before launch. Scope: authentication,
authorization, Firestore/Storage rules, session handling, Admin SDK usage, all
API routes, provider registry, billing/number/eSIM/KYC/support/operations/
account engines, environment usage. Findings marked **FIXED** were changed in
this prompt; **OK** items were verified sound; **OPEN** items are documented
launch requirements or future work.

## 1. Authentication

| Area | Status | Notes |
|---|---|---|
| Token verification | OK | Every API request verifies the Firebase ID token with the Admin SDK (`verifyIdToken(token, true)`) — full verification incl. revocation checking. |
| Identity derivation | OK | UID/email/role always come from the verified token. No API route trusts a body/query uid. Grep-verified across all routes. |
| Reauthentication | OK | Sensitive Firebase operations (password change) ride Firebase Auth's `requires-recent-login`; mapped to a calm message in `lib/errors.ts`. |
| Session cookie validation | OK | API auth is per-request token verification (bearer or cookie), stateless; no unvalidated cookie auth exists. |
| Cookie flags | FIXED | Client coordination cookies now set `Secure` alongside `SameSite=Lax` (`services/accountService.ts`). They carry only Firestore doc IDs (non-sensitive correlation keys, re-verified server-side per use). |
| `__session` convention | FIXED | Middleware accepted `__session`, which nothing in the codebase writes (grep-verified). Removed from the matcher to keep the guard honest. |
| Refresh-token revocation architecture | OK | `verifyIdToken(token, true)` honors Firebase's revocation semantics; sign-out-all-sessions revokes the server `sessions` records (Prompt 6). |
| Custom-claim trust | OK (documented) | Role claims gate Firestore rules and admin routes. Server-side claims cannot be spoofed from the client. *Launch note:* `setCustomUserClaims` alone does not instantly invalidate previously-issued ID tokens on other servers; rely on the 1-hour token TTL, or call `revokeRefreshTokens` on role demotion (recommended follow-up). |

## 2. Authorization (all routes audited)

- All 56 route files call `getApiIdentity` / `requireUser` / `requireAdmin` /
  `requireStaff` (script-verified; zero unauthenticated mutations).
- Deliberately public GET-only endpoints: `/api/esim/plans` (catalog),
  `/api/help`, `/api/help/search`, `/api/health*`. No state changes.
- Ownership: numbers, eSIMs, payments, invoices, subscriptions, billing
  events, support tickets, devices, sessions, notifications, preferences —
  every read/write is `uid == request.auth.uid` in rules **and** owner-checked
  in the engines (`getOwnedTicket`, `getOwnedSession`, `getOwnedDevice`, …).
- Admin: `requireAdmin` checks the verified `role == "admin"` claim. Support:
  `requireStaff` (admin|support) on support-read surfaces; financial
  mutations remain admin-only in `/api/admin/billing`.
- Self-demotion lock on `/api/admin/users/[uid]/role`; role changes write both
  Firestore and the Auth claim and are audit-logged.

## 3. Firestore rules

Audited the full file (users, profiles, onenumbr_ids, kyc, kyc_history,
notifications, esim_plans, esim_orders, esims, numbers, number_assignments,
number_orders, payments, invoices, subscriptions, billing_events,
payment_methods, billing_counters, sessions, devices, account_security,
login_events, notification_preferences, privacy_settings, support_tickets (+subcollections),
support_counters, operational_alerts, audit_logs, deny-all).

- **FIXED** — dead rule removed: `security_events` was matched but no code
  reads/writes it (security activity lives in `login_events`).
- **FIXED** — new `rate_limits` collection added under server-only deny.
- OK — client writes only: `users` (shape-locked create + lastLogin/email
  updates), `profiles` (field allowlist), `kyc` (draft-only allowlist),
  notification/privacy preference docs (with the mandatory
  `securityNewLogin=true` constraint). Everything else: server-only.
- OK — support ticket `messages`/`internal_notes` subcollections are fully
  client-denied (note isolation is enforced at three layers).
- OK — deny-all fallback closes every unmatched path.
- No wildcard client reads; every `list` is role-gated or uid-filtered.

## 4. Storage rules

- KYC + support: private, conservative MIME allowlists (PNG/JPEG/PDF), 5 MB /
  10 MB caps, owner-only reads, admins only via short-lived server-signed URLs.
- **FIXED** — client deletes removed: `allow delete: if isSelf(uid)` allowed a
  client to delete and re-upload under the same name (post-validation
  overwrite risk). Deletes are now server-only (Admin SDK) for KYC, and the
  future `documents/` scope gained the same create/update validation.
- Avatars intentionally remain public-read (rendered via public URLs), capped
  to images < 5 MB, owner-only writes.
- No public buckets; deny-all fallback intact.

## 5. Input validation

- Zod schemas on every mutating route (checked per route during the audit).
- **FIXED** — payload-size guard added globally in `middleware.ts` for JSON
  API POSTs (1 MB ceiling, 413).
- Unknown-field rejection: zod `.strict()` object shape on checkout/reserve/
  support bodies; engines snapshot server-derived values only.
- IDs/paths validated: support attachments must exist inside the caller's
  `support/{uid}/` scope and exist in Storage before message send.

## 6. Billing / number / eSIM engines

- Amounts, currency, invoice totals, plan prices: always server-derived
  (client sends only `planId`/`numberId` + idempotency key). Verified in
  checkout routes.
- Payment idempotency: `(uid, idempotencyKey)` unique lookup returning the
  original logical payment; refund validation caps at paid-minus-refunded;
  counters allocated in transactions. **OK**.
- Reservation: server TTL, lazy expiry release, ownership enforced at
  checkout; double activation prevented by state-machine checks. **OK**.
- eSIM: order ownership checks on every read; QR and activation details served
  through owner-checked routes; provider identifiers hidden from client
  projections (`toPublicPlan`). **OK**.

## 7. Support

- Internal notes: separate subcollection, client-denied by rules, never
  projected by customer APIs (defense in depth). **OK**.
- Attachment signed URLs: 10-minute expiry, owner or verified-staff only.
  **OK**.
- Message pagination: bounded queries (`limit(200)` per detail view). **OK**.

## 8. Admin SDK / secrets

- Admin SDK used only in server contexts (`firebase/admin.ts`); service
  account never sent to the client; client bundle contains only
  `NEXT_PUBLIC_*` config (grep-verified — no server secret is NEXT_PUBLIC).
- **OPEN (launch requirement)** — rotate the service account key in the
  Firebase console at launch and store it in the host's secret manager; never
  in the repo. `.env.*` templates document every variable.

## 9. CORS

- No `Access-Control-Allow-*` headers exist anywhere (grep-verified). The API
  is same-origin only; CSP `connect-src` constrains outbound client calls.
- **OPEN (launch requirement)** — if a mobile client or partner API is added,
  introduce an explicit origin allowlist in middleware; do not enable `*`.

## 10. Abuse protection summary

Rate limits (Prompt 10, `lib/rate-limit.ts`): kyc_submit 5/h, support_create
5/h, support_reply 30/h, number_reserve 20/h, checkout 10/h,
session_register 60/h, admin_mutation 120/min. Deterministic cooldown errors;
no CAPTCHA. Extension points documented for CAPTCHA and Redis/Upstash.

## 11. Logging

- No `console.log` of sensitive data found in `app/`/`lib/` during audit.
- **FIXED** — centralized `lib/logger.ts` with automatic redaction
  (passwords/tokens/cookies/signed URLs/KYC paths) is now available; new and
  modified server code routes through it.
- Audit logs remain append-only, server-written, admin-readable.
