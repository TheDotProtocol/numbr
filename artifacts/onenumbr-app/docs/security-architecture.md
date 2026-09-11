# OneNumbr — Security Architecture (Prompt 6, v1.0)

Companion to `docs/account-architecture.md`. This document covers the
security-specific model only.

## Threat model & principles

- Identity is **always derived server-side** from the verified Firebase
  session cookie (or verified ID token on API routes). UIDs, roles, statuses
  or ownership flags in request bodies are never trusted.
- All sensitive mutations happen in server routes using the Admin SDK.
  Firestore rules deny client writes to every security-relevant collection.
- Honest capabilities only: no fake 2FA, no fabricated device intelligence,
  no invented IP geolocation.

## Authentication

- Firebase Auth remains the sole authentication system (session cookies for
  the app; ID tokens verified per-request by API routes).
- Password changes use Firebase Auth `updatePassword` with mandatory
  reauthentication (`reauthenticateWithCredential`). No password material is
  ever sent to our backend; after success the client notifies
  `POST /api/account/password-changed`, which stamps
  `account_security.lastPasswordChangeAt`, appends a `login_events` entry and
  fires `security.password_changed` (notification + audit event).

## Session registry (server-coordinated)

`sessions/{sessionId}` is a coordination layer over Firebase Auth (registry
TTL: 30 days, refreshed on each registration):

| Field | Notes |
|---|---|
| `uid` | owner, from the verified session cookie — never from the body |
| `deviceId` | correlation key; the device doc is user-scoped (`{uid}_{deviceId}`) and owned by the same uid |
| `ipHash` | 12-hex-char SHA-256 prefix of the caller IP — privacy-safe correlation only; raw IPs are never stored |
| `deviceDescription` | honest UA parse ("Chrome on macOS") |
| `createdAt / lastSeenAt / expiresAt` | 30-day expiry set server-side |
| `revokedAt` | set by revocation |
| `location` | fixed `"Location unavailable"` — no geo-IP exists in this release, none is invented |

- Registration (`POST /api/account/register`) resolves identity from the
  verified session cookie (and requires a verified email); the body carries
  only a client-generated device correlation id and UA metadata. The server
  issues the `sessionId`, which the client stores in a non-sensitive cookie
  used solely so later reads can resolve "current session" server-side.
- One live session per device: re-registering a known device refreshes its
  existing session (`lastSeenAt`/`expiresAt`) instead of minting a new one.
- `isCurrent` is computed server-side for the calling cookie's sessionId —
  client-supplied "current" flags are ignored.
- Revocation (`POST /api/account/sessions` with `action: revoke / revoke_others
  / revoke_all`) marks `revokedAt` and stamps a `login_events` entry + audit
  event + notification. Ownership checks make cross-user revocation impossible
  (404/403). The Firebase session cookie itself expires naturally (registry
  revocation is display/control-plane semantics; refresh-token revocation is
  a documented future hardening step).

## Devices

`devices/{deviceId}` — server-managed registry (the Prompt-1 client-write
rule was removed in this prompt; all writes now flow through the account
APIs):

- Docs are user-scoped (`{uid}_{clientDeviceId}`), created/updated at session
  registration with honest UA-derived platform/browser metadata only.
- Rename (`PATCH /api/account/devices/[deviceId]`) verifies ownership
  server-side. Revoke-sessions and remove require zero active sessions
  (server-enforced).
- Rules: read-your-own; **all client writes denied**.

## Security state machine

`account_security/{uid}`:

- `twoFactorState: unavailable | setup_ready | enabled | disabled` — V1 is
  permanently `unavailable`; UI copy is fixed ("Two-factor authentication
  isn't available yet"). A future provider implements
  `providers/twofactor/types.ts` (`enroll/challenge/verify/unenroll`) and
  flips the state through server routes only.
- `recoveryState: none | configured`, `accountState:
  active | deactivated | deletion_requested | deleted`.
- All writes Admin-SDK only; rules deny client writes to the whole doc.

## Security activity

`login_events/{eventId}` — user-facing, append-only timeline (distinct from
the admin audit log): signed in, signed out, session revoked, password
changed, security settings changed, device events. Never stores credentials
or tokens. Read-your-own via API; writes are server-only.

## Notification preferences as a security control

`notification_preferences/{uid}`: the **security** category is mandatory —
the API rejects disabling it, so critical security notifications cannot be
silently switched off by the user (or by an attacker with the session).

## Firestore rule posture (summary)

| Collection | Client read | Client write |
|---|---|---|
| `account_security/{uid}` | via API (owner) | denied |
| `sessions` | via API (owner) | denied |
| `login_events` | via API (owner) | denied |
| `devices` | own docs | denied (server-only via account APIs) |
| `notification_preferences/{uid}` | own | via API (validated) |
| `privacy_settings/{uid}` | own | via API (validated) |

Admin operations continue to require verified admin custom claims
(`requireAdmin`).

## Known limitations

- Session revocation is enforced at the registry layer (visibility,
  "current session" resolution, sign-out controls); the underlying Firebase
  session cookie expires naturally. Server-side `revokeRefreshTokens` on
  revocation is the documented next hardening step.
- IP is reduced to an unsalted SHA-256 prefix for correlation only — it is
  never displayed. Unsalted IPv4 hashes are technically enumerable, so this
  field is pseudonymous rather than anonymous; salting it or dropping it
  entirely are documented future hardening options.
- `lastSeenAt` is updated on registration, not continuously — a live
  heartbeat would cost writes on every page view (free-tier trade-off,
  documented in account-architecture.md).
- No rate limiting on `/api/account/register` yet (add at the edge/WAF when
  deploying).
