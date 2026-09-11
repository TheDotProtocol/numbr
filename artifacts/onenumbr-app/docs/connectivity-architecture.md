# OneNumbr — Connectivity Architecture (Prompt 14, v1.0)

> **"Global connectivity, underneath your OneNumbr."**
> The network can change. The provider can change. The device can change. The
> endpoint can change. The country can change. The connectivity mechanism can
> change. **The OneNumbr Number does not change.**

## 1. Where connectivity sits

```
                 ONENUMBR ID
                      │
                +1739 284739
                      │
                 GLOBAL PLAN
                      │
                COMMUNICATIONS
                      │
                  ENDPOINTS
                      │
              CONNECTIVITY CORE      ← Prompt 14
                      │
        ┌─────────────┼─────────────┐
        │             │             │
       CLOUD         eSIM        MNO/MVNO
   (demo, live     (demo, via      (future
   app reality)    adapter)       boundaries)
        │             │             │
        └─────────────┼─────────────┘
                      │
        PHYSICAL SIM (future) · SIP (future)
                      │
                   PSTN (future — its own Prompt 11 boundary)
```

Connectivity is **infrastructure beneath the experience** — the customer thinks
"I have OneNumbr", never "I purchased an eSIM."

## 2. Domain model

`types/connectivity.ts`:

- `ConnectivityMechanism`: `cloud | esim | mno | mvno | physical_sim | pstn | sip`.
- `ConnectivityStatus` lifecycle: `not_configured → requested → provisioning →
  active`; plus `suspended`, `failed`, `terminated`. **A demo connection never
  reports a state implying live carrier service; `environment: "demo"` is
  stamped on every demo record.**
- `ConnectivityCapability`: `voice | messaging | data | roaming | esim |
  physical_sim | pstn | sip` — *supported by architecture ≠ available ≠ live*.
- `CONNECTIVITY_MECHANISMS`: static honest availability per mechanism
  (`available`/`demo`/`coming_soon` + capability list + UI note).
- `ConnectivityConnection` (`connectivity_connections/{id}`): owner-scoped,
  server-written. `refs` hold provider identifiers (ICCID/IMSI-class) — these
  are **internal integration identifiers, never the OneNumbr Number**.

**Number/identity invariant (enforced):** the connectivity engine reads
`onenumbr_ids`/`number_assignments`/`subscriptions` for labels and entitlements
and **never writes them**. Provider changes, eSIM changes and endpoint changes
cannot touch the identity, the number or the plan.

## 3. Provider abstraction

`providers/connectivity/types.ts` — the `ConnectivityProvider` contract:
`provision / activate / suspend / resume / terminate`, plus `id`, `mechanism`,
`name`, `demo`, `capabilities`, `regions`. Registry: `providers/index.ts`
(`listConnectivityProviders`, `getConnectivityProvider`); **provider selection
is server-side only** — clients send a mechanism at most, never a provider id.

Implementations:

- **`cloudConnectivityProvider`** (`cloud-demo`) — demo, region-neutral,
  application-level; the current honest reality.
- **`esimConnectivityProvider`** (`esim-demo-adapter`) — **adapter** over the
  existing eSIM engine. The eSIM provisioning flow (orders, profiles, QR)
  remains owned by `lib/esim-server.ts` + `MockEsimProvider`; nothing is
  duplicated or migrated.

Future boundaries (`providers/connectivity/future.ts`) — typed stubs with
documented responsibilities, **never operational**: MNO (subscriber
provisioning, network access, roaming, carrier webhooks), MVNO, physical SIM
(SIM inventory, ICCID/IMSI, shipping, replacement), SIP (trunks, registration,
routing). PSTN stays its own separate Prompt 11 boundary — PSTN is numbering +
voice + carrier routing, not merely connectivity.

## 4. Resolution & plan integration

`lib/connectivity-server.ts`:

- `resolveConnectivity(uid)` — the single server answer: enabled flag,
  `connectivity.global` entitlement state, current connection, honest mechanism
  list, future boundaries, provider label (demo/live), identity labels.
- Lifecycle functions (`requestConnection`, `activateConnection`,
  `suspendConnection`, `terminateConnection`) all:
  1. enforce the **`connectivity.global` entitlement** (Prompt 13 — the Global
     Plan carries connectivity; eSIM is not a plan of its own),
  2. enforce server-side state validity,
  3. delegate to the selected provider,
  4. audit + notify (no noisy per-state notifications).
- One live connection per user in this release; terminate then re-request to
  change mechanism.

## 5. Region abstraction

Regions are a **label on the connection**, never country plans. The customer
sees "Current region: X · Provider: Demo/Live · Status: Y" — never "India Plan".
Provider availability per region is deliberately not fabricated: with no real
carrier data the honest answer is "Provider availability not configured."

## 6. eSIM reframing

- `/app/connectivity` is the Connectivity experience (nav item "Connectivity"
  now points here); it frames mechanisms honestly and links to the eSIM
  marketplace as **one mechanism**.
- `/app/esim` is preserved intact (catalog, checkout, orders, admin) with a
  context line: "eSIM is one of the connectivity mechanisms underneath your
  OneNumbr — not the product itself."
- `esim_orders` / `esims` / `esim_plans` remain the compatibility layer; no
  destructive migration, no forced `connectivityConnectionId` backfill.

## 7. API, UI, admin

- `GET/POST /api/connectivity` — overview + lifecycle (`request` accepts only
  `cloud|esim`; provider ids are never accepted). Rate limits:
  `connectivity_provision` 5/h, `connectivity_lifecycle` 20/h.
- Dashboard "Connectivity" state card now points at `/app/connectivity` with
  honest "Not set up / demo" copy.
- Global Plan page: "Global connectivity — included with your plan" panel.
- Customer 360: connectivity section shows the current connection (mechanism,
  status, environment) plus legacy eSIM count; provider secrets are never
  projected.
- Health reports `providers.connectivity` per mechanism (cloud demo, esim
  demo, mno/mvno disabled, physicalSim/sip future, pstn disabled) and
  `features.connectivityCore/connectivityCloud`.

## 8. Security & flags

Prompt 10 model throughout: session-derived ownership, entitlement gates, zod
validation, rate limiting, audit (`connectivity.requested`,
`provisioning_started`, `activated`, `suspended`, `resumed`, `terminated`,
`failed`, `provider_selected`, `endpoint_linked`), notifications
(`connectivity.setup_started|ready|setup_failed|suspended`), safe errors, no
provider secrets client-side, provider-mode guard untouched. Flags:
`connectivityCloudEnabled` (on), `connectivityMnoEnabled` /
`connectivityMvnoEnabled` (**off** — require real agreements).

## 9. Multi-provider readiness (Prompt 15)

Provider readiness lives in `types/provider.ts` + `lib/provider-registry.ts`:

- **Capability model:** providers declare a `ProviderCapabilitySet` explicitly
  (numbering / voice / sms / mms / data / esim / physical_sim / roaming / sip /
  pstn / webhooks / portability) — never inferred from names.
- **Classification:** each provider has a category (cloud_telephony / pstn /
  sip / esim / mno / mvno / connectivity_aggregator / physical_sim) and declares
  which Prompt-layer interfaces it satisfies (numbering / connectivity /
  communications).
- **Registry:** `listProviderMetadata()` describes every provider slot (existing
  + future boundaries) with environment, availability, configState,
  capabilities, regions and configuration requirements — **no secrets, no
  credentials**.
- **Selection:** `selectProvider()` is server-side only (client sends a required
  interface/capability/region, never a provider id). Currently the operational
  connectivity path is the demo cloud provider; future real providers register
  both their metadata and their implementation in `providers/index.ts`.
- **Health:** `providerHealthSnapshot()` returns honest per-provider snapshots
  (`not_measured` when no real provider traffic exists); `providerHealthSummary()`
  summarizes available/demo/disabled/configured counts.
- **Provider-mode awareness:** `describeProviderMode()` reuses the Prompt 10 guard
  so admin/health/docs can show whether a provider domain is permitted in the
  current environment without exposing any credential.

**Privacy/separation reminders:** ICCID/IMSI/subscriber references/SIP accounts
are connectivity identifiers, not the OneNumbr Number; number, identity and plan
collections remain read-only to the connectivity layer.

See `docs/provider-readiness-architecture.md`, `docs/provider-onboarding-checklist.md`
and `docs/telecom-regulatory-readiness.md`.
