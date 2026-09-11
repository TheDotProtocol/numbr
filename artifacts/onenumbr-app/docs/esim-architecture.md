// =============================================================================
// OneNumbr — eSIM Marketplace & Provisioning Engine v1.0 (Prompt 3)
// =============================================================================

# eSIM Architecture

## Overview

The eSIM platform is built in four strict layers. No layer skips the one
below it:

```
UI (marketplace, checkout, activation, admin console)
  ↓   fetch() → /api/esim/* , /api/admin/esim/*
API routes (auth: session cookie → verified ID token; role claim for admin)
  ↓
lib/esim-server.ts   ← order/payment/provisioning engine (Admin SDK, Firestore)
  ↓
providers/  (EsimProvider ← mock today; real vendor later. PaymentProvider ← mock; Stripe later)
```

Business logic lives in `lib/esim-server.ts` and the provider layer — never
in React components.

## Firestore collections

### esim_plans/{planId} — product catalog

| Field | Notes |
| --- | --- |
| id, providerPlanId, provider | provider = "mock" today |
| countryCode, countryName, region, flag | destination grouping; regional/global packages allowed later (e.g. `EU`) |
| planName, dataAmount, dataUnit ("GB"\|"MB"), durationDays | |
| speed, networkType, coverage, hotspot, activationPolicy | display metadata |
| price, currency | authoritative price — client can never set it |
| **wholesaleCost, margin** | **admin-only. Stripped by `toPublicPlan()` before any customer response** |
| status | `active` \| `inactive` \| `archived` — only `active` is purchasable |
| featured, sortOrder | marketplace placement |

### esim_orders/{orderId} — the order ledger

All state transitions happen server-side in `lib/esim-server.ts`. The client
can only read its own orders.

```
orderStatus:        created → payment_pending → paid → provisioning → ready
                          ↘ (payment failed) failed          ↘ (provision failed) failed
                    failed orders keep paymentStatus = "paid" and can be retried by admin
paymentStatus:      payment_pending → paid → (failed | refunded)
provisioningStatus: not_started → in_progress → succeeded | failed
```

- `planSnapshot` — immutable commercial copy (plan fields + unitPrice,
  quantity, total) taken at purchase time. Historical orders never change
  when a plan is edited later.
- `idempotencyKey` — client-generated UUID sent with checkout. The server
  queries on (uid, idempotencyKey) before creating an order: duplicate
  submissions return the original order (`alreadyExists: true`). A paid but
  unprovisioned duplicate resumes provisioning instead of failing.
- `providerOrderId`, `esimId`, `provisioningError` — operational links.

### esims/{esimId} — provisioned SIMs

```
status: pending → ready → active → suspended → expired | cancelled
                          ↘ failed
iccid            demo: "89DEMO…" (never a real ICCID)
activationCode   demo: LPA:1$mock.smdp.onenumbr.dev$MOCK-MATCH-XXXXXXXXXX
qrPayload        exact string encoded into the QR (demo = activationCode)
dataTotalMb / dataUsedMb   demo usage is deterministic per ICCID
```

Customer list reads (`/api/esim/me`) exclude `activationCode`/`qrPayload`;
they are returned only for a single owner-checked eSIM detail fetch.

## Provider abstraction

`providers/esim/types.ts` defines `EsimProvider`:

```
searchPlans() getPlan() createOrder() provisionEsim() getActivationDetails()
getUsage() suspendEsim() cancelEsim()
```

`providers/esim/mock.ts` (MockEsimProvider) is registered in
`providers/index.ts`. Everything it emits is unmistakably demo data
(`89DEMO` ICCIDs, `mock.smdp.onenumbr.dev` SM-DP+ address, `MOCK-` refs). Its
catalog methods intentionally return empty/stub values — the Firestore
catalog is authoritative.

Failure testing: if the plan id contains "fail" (the seeded sandbox plan),
`provisionEsim` throws deterministically — exercising the order-failure path
and admin retry without touching code.

## Payment abstraction

`providers/payment/types.ts` defines `PaymentProvider`
(`createPaymentIntent` / `confirmPayment` / `refundPayment`).
`providers/payment/mock.ts` confirms deterministically. No card data, CVV or
bank credentials exist anywhere in the flow. Stripe later implements the
same interface and is swapped in `providers/index.ts` only.

## Checkout flow (server-authoritative)

```
POST /api/esim/checkout { planId, idempotencyKey }   ← client sends NOTHING else
  1. requireUser() — verified ID token + email verified
  2. Idempotency lookup (uid + key) → return existing order if found
  3. Load plan from Firestore; reject if status != active
  4. total = plan.price × 1 (server-computed; client value ignored)
  5. Create esim_orders doc with planSnapshot
  6. Audit: esim.order_created → notification
  7. PaymentProvider.createPaymentIntent → confirmPayment
     ├─ failed → orderStatus=failed, paymentStatus=failed, throw
     └─ paid   → paymentStatus=paid, audit + notification
  8. provisionOrder():
     ├─ orderStatus=provisioning, audit + notification
     ├─ EsimProvider.provisionEsim() → esims/{esimId} (batch: create SIM + set order ready)
     ├─ audit esim.provisioning_completed → "…eSIM ready" notification
     └─ on error: orderStatus=failed, provisioningError stored,
        audit esim.provisioning_failed → honest user notification; admin can retry
```

Price integrity: the client cannot influence price, currency, plan data,
provider, or any status field — the API schema only accepts
`{ planId, idempotencyKey }`.

## Security model

- Firestore rules: customers read only their own orders/eSIMs; `esim_plans`
  is read-only for the public (active fields only via client SDK) and
  writable only through the Admin SDK. No client can create/modify orders,
  eSIMs, or plan pricing.
- All privileged routes verify the ID token per request; admin routes verify
  the role claim (`requireAdmin`), never a browser-sent role field.
- Activation codes/QR payloads are owner-only and excluded from list reads.
- Audit logs contain IDs only — never activation codes or QR secrets.

## Free-tier notes

- Catalog: single 60-second client cache (`services/esimService.ts`), one
  Firestore read burst per navigation burst — no per-card queries.
- No continuous polling or realtime listeners on catalog/order pages.
- Admin lists are capped (50–300 docs) with joined emails memoized per uid.

## Routes

| Route | Purpose |
| --- | --- |
| `/app/esim` | Marketplace home (search, featured, destinations) |
| `/app/esim/c/[country]` | Country plans (sort + filters + compare drawer) |
| `/app/esim/c/[country]/[plan]` | Plan detail |
| `/app/esim/checkout?plan=…` | Review + demo payment (idempotent) |
| `/app/esim/activation/[esimId]` | Ready screen: QR, install guide, copy |
| `/app/esim/s/[esimId]` | eSIM detail (status, usage, activation) |
| `/app/esim/active` | My eSIMs |
| `/app/esim/orders` | Order history |
| `/app/admin/esim` | Admin console: Plans / Orders / eSIMs / Providers |

## Future real-provider integration points

1. Implement `EsimProvider` against the vendor API.
2. Register it in `providers/index.ts` (`getEsimProvider`).
3. Add `providerPlanId` mapping in the admin plan editor (field already
   exists) and keep the Firestore catalog as commercial truth.
4. Swap `PaymentProvider` for Stripe the same way; webhook handling slots in
   beside `confirmPayment` in `lib/esim-server.ts`.

No marketplace, checkout, activation or admin UI changes are required for
either swap.
