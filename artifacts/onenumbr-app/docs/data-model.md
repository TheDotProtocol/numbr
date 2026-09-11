# OneNumbr — Data Model (Manual KYC v1.0)

## Firestore collections — active

### `users/{uid}`
| Field | Type | Notes |
| --- | --- | --- |
| `uid` | string | == doc id |
| `email` | string | lowercase |
| `role` | `"user" \| "admin" \| "support"` | server-managed; rules reject client writes |
| `status` | `"active" \| "suspended" \| "pending"` | server-managed |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |
| `lastLoginAt` | timestamp | updated on sign-in |

### `profiles/{uid}`
| Field | Type | Notes |
| --- | --- | --- |
| `uid` | string | == doc id |
| `fullName` | string | |
| `country` | string | ISO 3166-1 alpha-2, `""` when unset |
| `phone` | string | optional |
| `avatarUrl` | string | Storage download URL |
| `timezone` | string | IANA name, auto-detected at onboarding |
| `createdAt` / `updatedAt` | timestamp | |

### `onenumbr_ids/{uid}`
| Field | Type | Notes |
| --- | --- | --- |
| `uid` | string | == doc id |
| `onenumbr` | string | `ON-XXXXXX`, unique, permanent |
| `status` | `"active" \| "revoked"` | |
| `createdAt` / `updatedAt` | timestamp | |

Server-only writes (rules deny all client writes to this collection).

### `onenumbr_id_keys/{ON-XXXXXX}`
Unique-key index used by the allocation transaction. `onenumbr`, `uid`,
`createdAt`. Server-only.

### `system/onenumbr_id_alloc`
Single doc: `{ counter: number }`. Atomic allocation cursor. Server-only.

### `devices/{uid}/devices/{deviceId}`
| Field | Type |
| --- | --- |
| `uid`, `deviceId` | string |
| `name` | string ("Chrome on macOS") |
| `platform`, `browser` | string |
| `deviceType` | `"desktop" \| "mobile" \| "tablet"` |
| `lastActiveAt` | timestamp |
| `createdAt` | timestamp |

### `audit_logs/{autoId}`
| Field | Type |
| --- | --- |
| `actorUid` | string |
| `action` | string (see below) |
| `targetUid` | string \| null |
| `metadata` | map |
| `createdAt` | timestamp (server) |

Actions: `admin.session_started`, `user.status_changed`, `user.role_changed`,
`user.profile_updated_by_admin`, `identity.onenumbr_id_issued`,
`kyc.submitted`, `kyc.review_started`, `kyc.approved`, `kyc.rejected`,
`kyc.resubmission_requested`.

Read: admin only. Write: server only (rules deny all client writes).
**Never** contains document numbers or document data.

---

## KYC collections (Prompt 2)

### `kyc/{uid}` — one live verification case per user
| Field | Type | Notes |
| --- | --- | --- |
| `uid` | string | == doc id |
| `status` | `not_started \| draft \| submitted \| under_review \| approved \| rejected \| resubmission_required` | submission + review transitions are server-only (rules) |
| `documentType` | `passport \| national_id \| driving_licence` | |
| `documentCountry` | string | ISO 3166-1 alpha-2 of the issuing country |
| `documentNumber` | string | stored for review; not displayed in lists |
| `documentFrontPath` / `documentBackPath` / `selfiePath` | string \| null | Storage paths (private scope `kyc/{uid}/…`) |
| `submittedAt` / `reviewedAt` | timestamp \| null | retention-ready timestamps |
| `reviewedBy` | string \| null | admin uid — never shown to the user |
| `rejectionReason` | string \| null | reason code mapped to user-facing copy |
| `reviewerNotes` | string \| null | internal-only; stripped from all user reads |
| `createdAt` / `updatedAt` | timestamp | |
| `attempt` | number | increments on each resubmission |

Client writes: draft-stage field allowlist only (rules). Submission and all
review decisions go through `/api/kyc/*` (Admin SDK + verified claims).

### `kyc_history/{uid}/entries/{autoId}` — append-only review trail
`actorUid`, `action` (`kyc.submitted`, `kyc.review_started`, `kyc.approved`,
`kyc.rejected`, `kyc.resubmission_requested`), `statusAfter`, `metadata`,
`createdAt`. Server-written; user reads own, staff read all. Preserves the
full decision history across resubmission attempts.

### `notifications/{uid}/items/{autoId}` — user notifications
`uid`, `kind` (`kyc.submitted`, `kyc.approved`, `kyc.rejected`,
`kyc.resubmission_requested`), `title`, `message`, `read`, `createdAt`.
Server-created; user reads own + marks read (`read` field only).

---

## Reserved for future prompts (rules fully closed)

| Collection | Prompt | Purpose |
| --- | --- | --- |
| `esim_plans` | **3 (active)** | Provider plan catalog — customer fields via `toPublicPlan()`, wholesale/margin admin-only |
| `esim_orders` | **3 (active)** | Purchases: planSnapshot, server-computed totals, idempotencyKey, order/payment/provisioning state |
| `esims` | **3 (active)** | Provisioned eSIMs: ICCID, activation code (owner-only), demo usage |
| `numbers` | **4 (active)** | Number inventory: app number, provider ref, capabilities, price, status, reservation TTL fields |
| `number_orders` | **4 (active)** | Number orders: numberSnapshot, server-computed totals, idempotencyKey, state machine |
| `number_assignments` | **4 (active)** | History-preserving assignment rows (active → released, releasedAt stamped; never deleted) |
| `payments` | **5 (active)** | Central financial ledger — integer minor units, orderType esim/number/subscription, idempotencyKey, refund tracking |
| `invoices` | **5 (active)** | Unique sequential invoice numbers (INV-YYYY-######), subtotal/tax/discount/total, state machine |
| `subscriptions` | **5 (active, mock)** | Plan snapshots, period dates, mock provider refs — no automatic recurring charging yet |
| `billing_events` | **5 (active)** | Immutable financial lifecycle events (payment/invoice/subscription) |
| `payment_methods` | **5 (active)** | Provider references only (Demo Payment Method) — never raw card data |
| `billing_counters` | **5 (active)** | Server-only transaction-allocated invoice number sequences |
| `payments` | 5 | Payment intents, invoices, receipts |
| `notifications` | **2 (active)** | Per-user feed (`notifications/{uid}/items`), server-created |
| `kyc` + `kyc_history` | **2 (active)** | Manual identity verification cases + append-only review history |
| `security_events` | later | Sign-in anomalies, blocks |
| `api_keys` | later | Developer API credentials |

TypeScript placeholder shapes for these exist in `types/index.ts`; service
interfaces in `services/placeholders.ts`; provider contracts in
`providers/`.

---

## Cloud Storage structure

```
avatars/{uid}/{fileName}            owner-write, in-app read   (Prompt 1)
kyc/{uid}/documents/{fileName}      owner-only read/write      (Prompt 2)
kyc/{uid}/selfie/{fileName}         owner-only read/write      (Prompt 2)
documents/{uid}/{fileName}          owner + admin only         (future)
```

KYC files: PNG/JPG/PDF only, max 5 MB, no public access. Admin viewing uses
short-lived server-signed URLs (10 min) generated by claim-verified API
routes — Storage URLs are never public and never exposed to other users.

### Number security notes (Prompt 4)

- Inventory browsing happens only through `/api/number/search` (server-side
  filtering, customer-safe projections); direct client reads of `numbers`
  are limited to the owner of an active number.
- `number_orders` / `number_assignments` are read-your-own; all writes are
  Admin-SDK only (`allow write: if false`).
- The KYC gate for activation is enforced server-side in the checkout API —
  the browser cannot bypass it.
- Assignment rows are never deleted: release stamps `releasedAt` and keeps
  the history. See `docs/number-architecture.md`.

### Support & operations notes (Prompt 7)

New collections: `support_tickets` (numbered `SUP-YYYY-######` via
transaction-allocated `support_counters`), subcollections
`support_tickets/{id}/messages` and `support_tickets/{id}/internal_notes`,
and server-only `support_counters` + `operational_alerts`.

- Customers read only their own tickets; **all client writes are denied** —
  every transition (create, reply, status, assignment, priority) is a
  server-side, audited operation.
- Internal notes are never returned by customer APIs and the subcollections
  are client-denied at the rules layer (isolation in depth).
- Storage: private `support/{uid}/…` scope, PNG/JPEG/PDF only, 10 MB cap,
  10-minute signed URLs for viewing. No public URLs.
- Staff endpoints accept the verified `admin` **or** `support` claim
  (`requireStaff`); financial mutations remain admin-only.

### Account & security notes (Prompt 6)

New/activated collections: `account_security/{uid}` (security profile),
`sessions/{sessionId}` (server-coordinated session registry — Firebase Auth
cookies remain the actual authentication), `login_events/{eventId}`
(user-facing security timeline), `notification_preferences/{uid}` and
`privacy_settings/{uid}` (validated user-controlled preferences).
`devices` was extended (rename, trusted, sessions linkage).

- Sessions/devices/login_events: reads via owner-checked APIs only; **client
  writes denied** in rules (registration, revocation and lifecycle are Admin-SDK
  server operations).
- `notification_preferences`/`privacy_settings`: user may read/write own doc
  through the API; security-critical notification categories are locked on
  server-side.
- Account lifecycle (`active → deactivated → deletion_requested`) never hard-
  deletes financial/KYC/audit records; see `docs/account-architecture.md`.

### Billing security notes (Prompt 5)

- Payments/invoices/subscriptions/billing_events: read-your-own only;
  **all client writes denied** — mutations happen exclusively through the
  billing engine (Admin SDK).
- `billing_counters` is completely server-only (invoice sequences).
- Money is integer minor units; amounts/statuses/ownership are always
  server-derived. See `docs/billing-architecture.md`.

### eSIM security notes (Prompt 3)

- Orders/eSIMs: client reads are limited to `where uid == request.uid` —
  no cross-user reads, no client writes at all (Admin SDK only).
- `esim_plans` is publicly readable for catalog browsing but client writes
  are denied; pricing is enforced server-side at checkout.
- Activation codes and QR payloads are excluded from list endpoints and
  audit logs; they are returned only in single, owner-checked detail reads.
- See `docs/esim-architecture.md` for the full order/eSIM state machines.


## Prompt 11 — Communications domain

New collections (all read-your-own, client-writes-denied — see
`docs/cloud-telephony-architecture.md` for full shapes):

- `calls/{callId}` — durable call records (mock-communications provider refs).
- `messages/{messageId}` — application messaging records (NOT PSTN SMS).
- `voicemails/{voicemailId}` — voicemail with demo transcripts (no audio).
- `communication_endpoints/{endpointId}` — where a OneNumbr Number is reachable.
- `routing_rules/{uid}` — ordered inbound routing steps; voicemail terminal.
- `communication_preferences/{uid}` — voicemail/alert preferences.

Numbering honesty: every number carries `numberingStatus: application_only`;
`future_pstn_pending`/`pstn_enabled` require a legitimate numbering
arrangement plus `FEATURE_PSTN_ENABLED`.

Indexes added: calls(uid+startedAt), messages(uid+createdAt),
voicemails(uid+createdAt), communication_endpoints(uid+priority).
