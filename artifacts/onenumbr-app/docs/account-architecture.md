# OneNumbr — Account & Security Architecture (Prompt 6, v1.0)

One account control plane for identity, connectivity, numbering, commerce and
security. This layer **extends** the Prompt 1–5 systems; it never duplicates
them.

## Account model

The authoritative account record remains `users/{uid}` (role, status — server
assigned, immutable from client). The Account Center is a *derived view* over
existing collections, never a second copy of them.

### Collections activated in this prompt

| Collection | Path | Purpose | Client access |
|---|---|---|---|
| `account_security` | `account_security/{uid}` | Security profile: twoFactorState, recoveryState, lastPasswordChangeAt, lastSecurityReviewAt, accountState | Read own (via API); **all writes server-only** |
| `sessions` | `sessions/{sessionId}` | Server-coordinated login sessions: uid, deviceId, tokenHashPrefix, createdAt, lastSeenAt, expiresAt, revokedAt, userAgent | No direct client access — API only |
| `devices` | `devices/{deviceId}` | Server-managed device registry: user-scoped docs, platform, browser, deviceName, trusted, firstSeenAt, lastSeenAt | Read own; renames via API |
| `login_events` | `login_events/{eventId}` | User-facing security activity timeline (distinct from admin `audit_logs`) | Read own via API; writes server-only |
| `notification_preferences` | `notification_preferences/{uid}` | Per-category notification opt-outs | Read own; write own via API (validated) |
| `privacy_settings` | `privacy_settings/{uid}` | Product/marketing communication + analytics preferences | Read own; write own via API |

## Session model

The platform's *authentication* is Firebase Auth session cookies (unchanged).
The `sessions` collection is a **coordination layer** that makes sessions
visible and revocable:

1. After sign-in the client calls `POST /api/account/register` with a
   client-generated device correlation id and UA metadata — identity comes
   from the verified session cookie, never the body.
2. The server derives an honest device description from the user agent,
   stores a 12-char SHA-256 prefix of the caller IP (never the raw address)
   and creates or refreshes a session doc with a 30-day expiry.
3. The server-issued `sessionId` is stored in a non-sensitive client cookie
   so every later read can resolve "current session" server-side.
4. Revocation (`POST /api/account/sessions` with `action: revoke`,
   `revoke_others` or `revoke_all`) marks `revokedAt` and stamps a
   `login_events` entry + audit event + notification. "Sign out other
   sessions" revokes all non-current sessions in one server action.

Current-device detection is **server-coordinated**: `isCurrent` is computed
only for the session matching the calling cookie's registered sessionId; no
untrusted client flag is honored.

Honesty rules: no IP geolocation is invented — sessions show
`Location unavailable`. Raw IPs are never stored; only the pseudonymous hash
prefix is kept for correlation (see `docs/security-architecture.md` for its
limits).

## Device model

`devices/{deviceId}` is a server-managed registry. Docs are user-scoped
(`{uid}_{clientDeviceId}`) and created/updated by the account engine at
session registration, using honest UA-derived metadata only. Users can:

- rename a device (`PATCH /api/account/devices/[deviceId]` — server validates
  ownership),
- revoke its sessions,
- remove the record (only when it has no active sessions).

## Security model

### account_security/{uid}

- `twoFactorState`: `unavailable | setup_ready | enabled | disabled` — V1 is
  always `unavailable`; the UI says "Two-factor authentication isn't available
  yet." No fake OTP, no SMS, no Twilio.
- `recoveryState`: `none | configured`.
- `accountState`: `active | deactivated | deletion_requested | deleted`.
- Password changes go through Firebase Auth (`updatePassword` with
  reauthentication); after success the client calls
  `POST /api/account/password-changed` which stamps
  `lastPasswordChangeAt`, appends a `login_events` entry, and fires
  `security.password_changed` notification + audit event. No password material
  ever reaches our servers.

### TwoFactorProvider extension point

`providers/twofactor/types.ts` defines the future contract
(`enroll`, `challenge`, `verify`, `unenroll`). A real provider (authenticator
app / passkeys / SMS) implements it and registers in `providers/index.ts`.
The Security Center UI reads `twoFactorState` — no UI rewrite needed later.

### Security Center

`/app/security` shows status derived from real inputs only:
email verification (Firebase Auth), password age, 2FA availability, active
session count, recent security events. Statuses are simple
`good | needs_attention | unavailable | action_required` indicators — no
fabricated security scores.

## Notification & privacy preferences

`notification_preferences/{uid}` stores per-category opt-outs
(security, identity, connectivity, number, billing, marketing).
**Security-critical categories are locked on**: the API rejects disabling
them. `privacy_settings/{uid}` covers product emails, marketing emails and
analytics — each control maps to a stored flag that backend code checks; no
decorative controls.

## Account lifecycle

`POST /api/account/lifecycle` with a `mode`:

| Mode | Effect |
|---|---|
| `deactivate` | `accountState=deactivated`; sessions revoked; dashboard shows reactivation path. Data preserved. |
| `deletion-request` | `accountState=deletion_requested`; sessions revoked. **No hard delete.** Invoices, payments, KYC and audit history are retained for compliance. A future deletion worker can purge what regulations allow. |
| `reactivate` | Back to `active` (only from `deactivated`). |

Deletion is never client-executable beyond the request itself; all transitions
are server-side and audit-logged.

## Account summary (dashboard unification)

`getAccountSummary(uid)` in `lib/account-server.ts` performs ~8 targeted reads
and returns one snapshot: OneNumbr ID, KYC state, active number, active eSIM,
latest payment + outstanding invoice count, security status, current device,
recent activity. The dashboard and `/app/account` both consume
`GET /api/account` — no N+1 reads from the UI.

## Firestore security assumptions

- `account_security`, `sessions`, `login_events`, `notification_preferences`,
  `privacy_settings`: read-own via rules where safe, but **every mutation flows
  through server routes** with Admin SDK; rules deny direct client writes to
  session/security/lifecycle state.
- `devices`: read-your-own; **all client writes denied** (renames and removal
  go through the account APIs). The Prompt-1 client-write rule was removed in
  this prompt.
- Admin claims (already verified by `requireAdmin`) gate `/admin/*`.

## Future provider / integration points

- `providers/twofactor/types.ts` → real 2FA provider (TOTP, passkeys, SMS).
- Session layer → real device intelligence or IP risk scoring can be added to
  `POST /api/account/register` without changing the UI.
- `login_events` → export to a security SIEM later (append-only by design).
