// =============================================================================
// OneNumbr — Number Engine v1.0 (Prompt 4)
// =============================================================================

# Number Architecture

## OneNumbr ID vs OneNumbr Number

These are two separate concepts and stay separate forever:

| | OneNumbr ID | OneNumbr Number |
| --- | --- | --- |
| Example | `ON-284739` | `+1739 284739` |
| Meaning | Permanent identity identifier | Public communications identity |
| Storage | `onenumbr_ids/{uid}` (Prompt 1) | `numbers` + `number_assignments` (Prompt 4) |
| Mutable? | Never by the user | Can be released; a new number can be activated later |
| Count | Exactly one per user | History of many; V1 UI exposes one active at a time |

Releasing a number never touches the OneNumbr ID. The database supports
multiple simultaneous assignments per user in future (personal, business,
travel numbers).

> Routing truth: `+1739` is an **application-level numbering abstraction**.
> The platform makes no claim that it is an internationally routable country
> code. Real routing arrives only with a real telecom arrangement.

## Layered architecture

```
UI (marketplace, checkout, detail, admin console)
  ↓   fetch() → /api/number/* , /api/admin/numbers|number-data
API routes (auth: session cookie → verified ID token; admin role claim)
  ↓
lib/number-server.ts   ← engine: search, reservation, orders, provisioning,
  ↓                       assignment, release (Admin SDK, Firestore)
providers/             ← TelecomProvider (mock-telecom today; real carrier later)
                         PaymentProvider (mock today; Stripe later)
```

The browser never talks to a provider directly and never sees provider
credentials.

## Firestore collections

### numbers/{numberId} — inventory

- `onenumbrNumber` (globally unique, E.164-style app number),
  `providerNumber` (unique per provider), `provider` ("mock-telecom")
- `countryCode`, `region`, `type` (mobile/local/toll_free/international)
- `capabilities` (`["SMS","VOICE"]`; MMS/SIP reserved)
- `monthlyPrice`, `currency` — authoritative; client can never set them
- `status`: `available | reserved | provisioning | active | suspended | released | failed`
- Reservation fields: `reservedBy`, `reservedAt`, `reservationExpiresAt`
- `uid` — set only when active

### number_orders/{orderId}

- `numberSnapshot` — immutable commercial copy (number, capabilities, type,
  price, currency) taken at checkout
- `totalAmount` — server-computed (first month)
- `paymentStatus`: `payment_pending | paid | failed | refunded`
- `orderStatus`: `created → payment_pending → paid → provisioning → active`
  with `failed | cancelled | released` side states
- `idempotencyKey` — duplicate checkouts return the original order
- `assignmentId`, `providerOrderId`, `provisioningError`

### number_assignments/{assignmentId} — history-preserving

One row per assignment, **never deleted**:

```
status: active → released (releasedAt stamped) | suspended
```

Enables account history, support workflows and future multi-number support.

## State machines

```
NUMBER     available → reserved → provisioning → active → suspended → released
                                ↘ failed   (paid; admin retry)
           reserved → available        (15-min reservation TTL expiry, lazy)

ORDER      created → payment_pending → paid → provisioning → active
                                ↘ failed    (payment kept; retry by admin)

ASSIGNMENT active → released (row preserved forever)
```

## Reservation lifecycle

1. **Reserve** — `POST /api/number/reserve` runs a Firestore transaction:
   the number must be `available` (or already reserved by the same user —
   idempotent). The provider's reservation call runs inside the transaction
   boundary and the hold is stamped `reservationExpiresAt = now + 15 min`.
2. **Hold window** — the number cannot be reserved/checked out by anyone
   else while the reservation is live.
3. **Expiry** — lazily expired by `expireStaleReservations()` on every
   search/checkout (no timers, no cron on the free tier). Expiry is
   audit-logged (`number.reservation_expired`).
4. **Conversion** — a live reservation is required at checkout; the order
   pipeline then moves the number `provisioning → active`.

## Checkout flow (server-authoritative)

```
POST /api/number/checkout { numberId, idempotencyKey }   ← nothing else
  1. requireUser() + KYC gate (deriveIdentityState must be "verified")
  2. Idempotency lookup (uid + key) → return existing order if present
  3. Load inventory record; require live reservation owned by this user
  4. total = monthlyPrice (server-computed); snapshot onto the order
  5. Audit number.order_created
  6. PaymentProvider.createPaymentIntent → confirmPayment
     └─ failed → order failed, reservation released, honest error
  7. payment_confirmed audit → provisionNumberOrder()
```

### Provisioning (`provisionNumberOrder`)

1. Order → `provisioning`; number → `provisioning`; audit + notification.
2. `TelecomProvider.purchaseNumber()` (mock throws deterministically for the
   `-FAIL` sandbox number).
3. `TelecomProvider.assignNumber()`.
4. Single batch: create `number_assignments` row (active), set number
   `active` + `uid`, set order `active` + `assignmentId`.
5. Audits `number.assigned` + `number.provisioning_completed`; notification
   "Your OneNumbr number is active".
6. **Failure recovery**: order → `failed` with `provisioningError`, number →
   `failed`, payment stays recorded, user notified honestly, admin can
   retry from `/admin/numbers → Orders → Retry`.

## Release lifecycle

`POST /api/number/release` verifies ownership twice (active assignment uid
AND number record uid), calls `TelecomProvider.releaseNumber()`, then in one
batch stamps the assignment `released + releasedAt` and sets the number
`released` (inventory row retained, `uid` cleared). Confirmation modal warns
the number may become unavailable for future use. Audit `number.released` +
notification. OneNumbr ID is untouched.

## Security model

- Clients can read only their own `number_orders` / `number_assignments`
  and their own active numbers; inventory browsing happens exclusively
  through the controlled `/api/number/search` (customer-safe projections).
- All writes are server-side (`allow write: if false` in rules). Status,
  ownership, price and provider fields are unreachable from the browser.
- KYC gate is enforced **server-side** in checkout (`permission-denied`
  unless `verified`); the UI lock is a courtesy, not the mechanism.
- Search/checkout send only identifiers + idempotency keys — price, status,
  provider and ownership are never trusted from the client.
- Admin routes verify the role claim per request (`requireAdmin`).
- Audit metadata contains ids only — no provider credentials, no secrets.

## Telecom provider abstraction

`providers/telecom/types.ts` — `TelecomProvider`:

```
searchNumbers() getNumber() reserveNumber() releaseReservation()
purchaseNumber() assignNumber() releaseNumber() getNumberStatus()
sendSms? makeCall? configureWebhook?      ← declared, not built (future)
```

`MockTelecomProvider` ("mock-telecom") keeps no state of its own — the
Firestore inventory is authoritative — and emits unmistakable mock refs
(`MOCK-RES-…`, `MOCK-PHONE-ORDER-…`). It never implies PSTN connectivity;
the marketplace footer and admin Providers tab state this explicitly, and
customer-facing copy uses "demo number" language that production can drop
without redesign.

## Future real-provider integration

1. Implement `TelecomProvider` against the vendor API.
2. Register it in `providers/index.ts` (`getTelecomProvider`).
3. Map the vendor catalog through `searchNumbers`/`getNumber`; keep the
   Firestore inventory as commercial truth (or flip to provider-of-record —
   engine call sites do not change).
4. Replace `PaymentProvider` with Stripe the same way.

Marketplace UI, checkout UI, dashboard, number service API and user
experience require **zero changes** for either swap.

## Free-tier notes

- Search is server-side with 350 ms client debounce, `limit ≤ 50` docs per
  query, and no per-keystroke Firestore reads.
- Reservations expire lazily inside existing reads — no schedulers.
- Dashboard uses one list read for numbers (same pattern as eSIMs).
- Admin lists are capped with pagination cursors.

## Routes

| Route | Purpose |
| --- | --- |
| `/app/number` | Marketplace: hero, KYC gate, search, filters, cards |
| `/app/number/checkout?number=…` | Review + demo payment (idempotent) |
| `/app/number/[numberId]` | Detail: status, settings (coming-soon), release |
| `/admin/numbers` | Console: Inventory / Orders / Assignments / Providers |

## Audit events

`number.reserved`, `number.reservation_expired`, `number.order_created`,
`number.payment_confirmed`, `number.provisioning_started`,
`number.provisioning_completed`, `number.provisioning_failed`,
`number.assigned`, `number.released`.

## Notifications

`number.reservation_confirmed` (reserved), `number.activation_started`,
`number.activated` ("Your OneNumbr number is active. +1739 284739"),
`number.activation_failed`, `number.released`.
