# OneNumbr — Global Plan & Entitlements Architecture (Prompt 13, v1.0)

> **Product principle:** OneNumbr is not selling connectivity first. It is selling
> a persistent global communications identity.
>
> ```
> ONE CUSTOMER
>       ↓
> ONE ONENUMBR ID            — permanent, never changes
>       ↓
> ONE PRIMARY NUMBER         — application-level identity (+1739 …)
>       ↓
> ONE GLOBAL PLAN            — the standard monthly subscription
>       ↓
> ONE COMMUNICATIONS IDENTITY
>       ↓
> MANY ENDPOINTS
>       ↓
> MANY POSSIBLE CONNECTIVITY PROVIDERS
> ```
>
> The provider can change. The endpoint can change. The country can change.
> The network can change. The connectivity mechanism can change.
> **The OneNumbr identity and number remain the constant.**

## 1. Architecture

```
                    ONENUMBR ID
                         │
                  +1739 284739
                         │
                 GLOBAL PLAN          ← catalog (lib/plan-catalog.ts)
                         │                + entitlements engine
              ┌──────────┼──────────┐      (lib/entitlements-server.ts)
              │          │          │
           NUMBER   COMMUNICATIONS ENDPOINTS
              │          │          │
              └──────────┼──────────┘
                         │
                  CONNECTIVITY
                         │
              FUTURE TELECOM LAYER (PSTN / MNO / MVNO / eSIM / SIM)
```

No second billing system exists. The Global Plan reuses the Prompt 5 billing
engine: the same `subscriptions` collection, `createSubscription`,
`setSubscriptionStatus`, `chargeOrder`, `billing_events`, invoices and the mock
`PaymentProvider`.

## 2. Plan catalog & versioning

`lib/plan-catalog.ts` is the server config source of truth.

- **ONE standard plan**: `one_global_v1` (`ONE_GLOBAL_V1`) — no country
  marketplace, no dozens of SKUs.
- **Versions are immutable once released.** A price or entitlement change ships
  as `one_global_v2` via a new catalog entry — never by editing v1.
- **Subscriptions snapshot their economics** at creation
  (`planSnapshot.amountMinor/currency/interval` + the new `planVersion` tag),
  so historical invoices and subscription economics remain accurate forever.
- The catalog is **provider-independent**: "OneNumbr Global", never "Stripe
  plan" or "carrier plan". Providers sit underneath and are replaceable.

## 3. Entitlement model

`types/plan.ts` defines the canonical keys — the centralized product-access
matrix:

| Feature | Entitlement key | v1 state |
|---|---|---|
| Primary Number | `number.primary` | available |
| Voice | `communications.voice` | demo |
| Messaging | `communications.messaging` | demo |
| Voicemail | `communications.voicemail` | available |
| Multi-device endpoints | `endpoints.multi_device` | available (limit 5) |
| Global connectivity | `connectivity.global` | demo (connectivity service layer — Prompt 14) |
| eSIM connectivity | `connectivity.esim` | demo |
| PSTN | `connectivity.pstn` | **coming_soon (disabled)** |
| Physical SIM | `connectivity.physical_sim` | **coming_soon (disabled)** |
| TauCore | `ecosystem.taucore` | **coming_soon (disabled)** |

`EntitlementAvailability` enforces honest product language everywhere:
`available` / `demo` / `coming_soon`. Coming-soon entitlements are **never**
entitled and never actionable, regardless of plan or flags.

## 4. Entitlement resolution (server-authoritative)

`lib/entitlements-server.ts` is the single product-access layer:

- `resolveUserEntitlements(uid)` → `EntitlementsView` (safe for UI):
  entitlement = plan-enabled **AND** active subscription **AND** active account
  **AND** flag-enabled; `coming_soon` always loses.
- `hasEntitlement(uid, key)` / `requireEntitlement(uid, key)` — engine gates.
  `requireEntitlement` throws a clean product-level error (no provider
  internals).
- `getPlanStatus(uid)` → `none | active | past_due | paused | cancelled`.

**Legacy bridge:** users who activated a number before the catalog existed have
no subscription record; the number assignment itself carries the plan
(status `active`, no invented economics — price/period stay null). New
activations always create a real subscription.

**Client state is never authoritative.** Prices, plan ids, versions,
entitlement and subscription state are all server-derived.

## 5. Plan ↔ number ↔ identity relationship

- The plan subscription is the number-sourced subscription
  (`source: "number"`, `linkedEntityId: numberId`) — the Prompt 11 model made
  real: `provisionNumberOrder` now starts it via the existing
  `createSubscription` (single creation path, duplicate-guarded, non-fatal on
  failure with an audit breadcrumb).
- **Number retention policy:** pausing or cancelling the plan affects ONLY the
  subscription. The number assignment, OneNumbr ID, invoices, and history are
  untouched. Number release remains the explicit `releaseUserNumber` product
  action — never an accidental side effect of subscription state.
- Reactivation (`paused/cancelled → active` via `POST /api/billing/plan`) fully
  restores entitlements; it never creates a new OneNumbr ID or number.

## 6. Security invariants (all enforced)

1. OneNumbr ID is permanent; plan changes cannot touch it (the entitlements
   engine reads `onenumbr_ids` but never writes).
2. Plan changes do not silently change the number (the engine reads
   `number_assignments` but never writes).
3. Endpoint changes do not change the plan; connectivity provider changes do
   not change the plan.
4. Historical invoices are immutable; historical subscription economics are
   preserved via `planSnapshot` + `planVersion`.
5. Clients cannot modify entitlements — the API accepts no plan/price fields;
   the plan POST performs a status-only reactivation on the user's own
   subscription with `plan_reactivate` rate limiting (10/h).
6. KYC remains the gate for number activation (the plan starts after KYC-gated
   activation succeeds). No KYC logic is duplicated.
7. Suspended / deletion-requested accounts lose entitlements automatically via
   the account-state gate.

## 7. API surface

- `GET /api/billing/plan` — owner's `EntitlementsView` (plan status/price via
  snapshot, entitlements with honest availability, usage: OneNumbr ID, primary
  number, active endpoint count).
- `POST /api/billing/plan` — reactivate paused/cancelled plan; 404 when no
  plan, 400 when active/expired/failed.
- Existing `POST /api/billing/subscriptions` — pause/resume/cancel retained
  (now emitting suspended/reactivation notifications).

## 8. UI

- **`/app/billing/plan`** — plan detail: "One plan. One number. Anywhere.",
  plan hero with status + honest demo-billing copy, identity anchor card
  (OneNumbr ID / number / endpoints), the Global Benefits list with
  demo/coming-soon badges, and Reactivate.
- **Billing Overview** — Global Plan summary card above existing sections.
- **Dashboard** — Global Plan state card joins Identity/Number/Communications/
  Connectivity/Billing/Security (Prompt 9's single Next Best Action preserved;
  two new deterministic plan states: `plan_paused`, `plan_cancelled`).
- **Customer 360** — Global Plan mini-section (status, version, snapshot
  price, provider marked demo).
- **Admin billing** — Version column in the subscriptions table.

## 9. Future Stripe boundary (documentation only)

The existing `PaymentProvider` abstraction admits a future
`StripePaymentProvider` implementing subscription creation, recurring billing,
payment status, invoice synchronization, cancellation, refunds and webhooks.
Because the plan is provider-independent and subscriptions snapshot their own
economics, adding Stripe requires no redesign — only a new provider
implementation plus `FEATURE_STRIPE_PAYMENTS` (off).

## 10. Future usage billing (documentation only)

Voice minutes / SMS volume / data usage metering is deliberately NOT built.
The strategy remains ONE STANDARD PLAN; any future usage charges must be an
explicit design (a usage ledger + provider metering adapter), never an
accidental emergence from provider APIs.

## 11. Flags

`globalPlanEnabled` (`FEATURE_GLOBAL_PLAN_DISABLED`), `entitlementsEnabled`
(`FEATURE_ENTITLEMENTS_DISABLED`) — both on by default. PSTN, physical SIM and
real TauCore remain off (see `docs/feature-flags.md`).

## 12. Health

`/api/health` reports `features.globalPlan`, `features.entitlements` and
`providers.billing: "mock"` alongside the existing honest provider map.

## 13. Provider independence (re-stated for Prompt 15)

The Global Plan is provider-independent by construction: the catalog lives in
code, subscriptions snapshot their own economics, and entitlements resolve from
plan × subscription × account × flags. Providers sit beneath the plan and are
replaceable — adding a real cloud-telephony, eSIM, MNO/MVNO, physical SIM or
PSTN provider changes only the provider layer (and requires the Prompt 15
readiness checklist + provider-mode guard), never the plan, the OneNumbr ID,
the number, the communications identity or the customer relationship. See
`docs/provider-readiness-architecture.md` and `docs/provider-onboarding-checklist.md`.
