// =============================================================================
// OneNumbr — Payments & Billing Engine v1.0 (Prompt 5)
// =============================================================================

# Billing Architecture

## Core principle: ONE billing system

Every source of revenue flows through the same engine:

```
CUSTOMER → ONENUMBR ACCOUNT
                ↓
          BILLING ENGINE  (lib/billing-server.ts)
          ├── eSIM purchase            (orderType "esim")
          ├── Number purchase          (orderType "number")
          ├── Number/plan subscription (orderType "subscription")
          └── future services          (orderType "other")
                ↓
          PaymentProvider → MockPaymentProvider (today)
                          → StripePaymentProvider (later)
```

eSIM and Number checkouts call `chargeOrder()` — they never create their own
payment records. The billing engine is the financial source of truth.

## Money representation

All amounts are **integer minor units**: `1999` = $19.99 with
`currency = "USD"`. No floating-point arithmetic is ever used for money;
`formatMinor()` converts at the display edge only. Currency is stored per
record (USD default in development); INR/THB/EUR/GBP/SGD are supported by
the schema — conversion is intentionally not built and no exchange rates are
hardcoded.

## Firestore collections

| Collection | Contents |
| --- | --- |
| `payments/{paymentId}` | The financial ledger. `orderType` (esim/number/subscription/other), `orderId`, `providerPaymentId`, `amountMinor`, `status`, `refundedAmountMinor`, `refundReason`, `relatedOrderFailed`, `idempotencyKey` |
| `invoices/{invoiceId}` | `invoiceNumber` ("INV-2026-000001", sequential, unique — never the doc id), subtotal/tax/discount/total (minor units), `status`, `paidAt` |
| `subscriptions/{subscriptionId}` | `planSnapshot`, `status`, `billingInterval`-equivalent (`planSnapshot.interval`), `currentPeriodStart/End`, `nextBillingDate`, `providerSubscriptionId` |
| `billing_events/{eventId}` | Immutable lifecycle events: `payment.created/paid/failed/refunded`, `invoice.created/paid`, `subscription.created/activated/paused/cancelled` |
| `payment_methods/{methodId}` | Provider references only (mock: "Demo Payment Method"). No raw card data exists anywhere |
| `billing_counters/invoice-YYYY` | Server-side sequence counter for invoice numbering (transaction-allocated) |

## Payment state machine (server-side only)

```
pending → paid | failed | cancelled
paid → refunded | partially_refunded
```

## Invoice state machine (server-side only)

```
draft → issued → paid | void
issued/paid → refunded
```

P5 single-purchase invoices are created directly in `paid` status
(`createPaidInvoice`) with `issuedAt = paidAt`; the full draft→issued flow
remains available for future recurring billing.

## Subscription lifecycle (mock)

```
trialing → active → past_due → paused → cancelled | expired | failed
```

`createSubscription()` (used by future number-plan flows) creates an ACTIVE
subscription with period dates and a MOCK- provider id. Pause/cancel/resume
work through the user billing page and the admin console against the mock
model. **No automatic recurring charging occurs in this release** — the
period/nextBillingDate fields exist so a scheduler (Cloud Function + real
provider) can be added later without schema changes.

## Refund lifecycle (admin-initiated)

1. Admin opens the payment in `/admin/billing → Payments → Refund`.
2. Confirmation modal: full refund (default) or **partial** (amount entered
   in major units, validated server-side against
   `amountMinor − refundedAmountMinor`), plus a reason.
3. `refundPayment()` calls `PaymentProvider.refundPayment`, updates the
   payment (`refunded`/`partially_refunded`), writes `payment.refunded`,
   updates the linked invoice status, notifies the user, and audit-logs.

Refunds never automatically cancel/destroy a service.

## Idempotency

- Every charge carries `(uid, idempotencyKey)` uniqueness. A retried
  checkout returns the original payment (`alreadyCharged: true`) instead of
  charging twice. The eSIM and Number checkout pages hold **one key per
  checkout session** (created on mount), so double-clicks and retries are
  safe.
- Invoice numbers are allocated inside a Firestore transaction on
  `billing_counters` — concurrent checkouts cannot collide.
- Subscription creation rejects duplicates for the same
  (uid, source, linkedEntity).
- Refunds run against freshly-read state with server-side amount
  validation.

## eSIM billing integration

`lib/esim-server.ts → createOrderAndProvision()`:

```
plan loaded (server) → order CREATED
  → chargeOrder({ orderType:"esim", orderId, idempotencyKey, amountMinor })
      payment PENDING → provider → PAID | FAILED
  → FAILED: order paymentStatus=failed (no provisioning)
  → PAID:   order paid → provisionOrder() → READY | FAILED (retry by admin;
            the payment is never re-charged on retry because the idempotency
            key resolves to the original payment)
```

## Number billing integration

`lib/number-server.ts → checkoutNumber()`: identical pattern with
`orderType: "number"`, after the KYC gate and live-reservation check. A
failed payment releases the reservation; a succeeded payment provisions.

## Mock payment provider behavior

- `confirmPayment` returns **succeeded** deterministically, **except** when
  the generated intent id contains "FAIL" — the documented failure trigger.
  Test recipe: see `docs/testing.md`.
- Provider references look like `MOCK-PAY-XXXX` / `MOCK-SUB-XXXX` and are
  clearly development values.
- No card numbers, CVV, bank details or wallet credentials exist anywhere
  in the platform.

## Security model

- Firestore: clients can **read their own** payments/invoices/subscriptions
  /billing_events; **all client writes are denied**. `billing_counters` is
  fully server-only.
- Amount, currency, status, ownership and provider are always
  server-derived; the client sends only identifiers + confirmed actions.
- Admin operations (`refund`, subscription status) verify the admin role
  claim per request (`requireAdmin`).
- Audit (`billing.*`) and billing_events store ids and amounts only — never
  credentials.

## Free-tier notes

- One overview call aggregates recent data (limits 10–50 per collection).
- No realtime listeners or polling on billing pages.
- Admin lists are capped (100) with joined emails memoized per uid.

## Future Stripe integration point

1. Implement `StripePaymentProvider` against `providers/payment/types.ts`
   (`createPaymentIntent`, `confirmPayment`, `refundPayment`, plus the
   optional `capturePayment`/`cancelPayment`/`getPaymentStatus` hooks).
2. Register it in `providers/index.ts` → `getPaymentProvider()`.
3. Add Stripe webhook handlers beside `chargeOrder()` to drive
   `payment.*`/`invoice.*` billing events for asynchronous states.
4. Add real payment-method tokenization under the existing
   `payment_methods` schema (provider references only — the schema already
   forbids raw credentials).

Billing UI, eSIM UI, Number UI, dashboard, invoice and transaction views
require **zero changes** for the swap.
