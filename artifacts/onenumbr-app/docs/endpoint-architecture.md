# OneNumbr — Endpoint Architecture (Prompt 12, v1.0)

The endpoint layer proves the core OneNumbr promise at the application level:

**ONE ONENUMBR NUMBER → MULTIPLE COMMUNICATION ENDPOINTS → SAME IDENTITY.**

> Your number belongs to your OneNumbr identity. It does **not** belong to a phone,
> a SIM, an eSIM, a carrier, a country, a device, or a single application.
> The endpoint is simply *where the identity is currently accessed*.

## 1. The concept

An **endpoint** is a destination through which the user's OneNumbr communications
identity can operate. One number can serve many endpoints simultaneously; adding,
changing, revoking or losing an endpoint never touches the OneNumbr ID or the
OneNumbr Number.

```
ONE IDENTITY
     |
ONE NUMBER
     |
GLOBAL PLAN
     |
COMMUNICATIONS CORE
     |
ENDPOINT MANAGER
     |
+-----+-----+-----+-----+
|     |     |     |     |
WEB  TAUPHONE TAUTALK SIM  PSTN
|     |     |     |     |    (future)
+-----+-----+-----+-----+
          |
     CONNECTIVITY
```

SIM and PSTN are **future infrastructure** — modeled in the type system
(`SIP_FUTURE`, `SIM_FUTURE`, `PSTN_FUTURE`) and rejected by the API while their
boundaries are disabled. They are never shown as operational.

## 2. Relationship to identity and number

```
USER (Firebase Auth uid)
 ↓
ONENUMBR ID        — permanent (onenumbr_ids/{uid}), never changes
 ↓
PRIMARY NUMBER     — +1739 XXXXXX, application-level numbering abstraction
 ↓
ENDPOINT(s)        — where the number is reachable today
 ↓
DEVICE/APP         — the physical/virtual thing behind an endpoint
```

Enforced invariants (see §10 tests):

- Endpoint create/update/revoke **cannot** modify `onenumbr_ids` or
  `number_assignments`. The endpoint engine never writes to those collections.
- A device can disappear; the ID and number persist.
- Re-registering an endpoint of the same type creates a **new** endpoint record;
  identity and number are untouched.
- The number is derived server-side from the user's active assignment — never
  accepted from the client.

## 3. Data model

Collection: `communication_endpoints` (created in Prompt 11; endpoint engine is
its primary writer). Owner-only reads via Firestore rules; all writes server-side.

Key fields: `endpointId`, `uid`, `numberId`, `type`, `name`, `platform`,
`status`, `capabilities[]`, `verificationStatus`, `isPrimary`, `availability`,
`providerReference`, `deviceId?`, `lastActiveAt`, `revokedAt?`, `createdAt`,
`updatedAt`.

No endpoint_events collection was created — the existing audit log
(`communications.endpoint_*` actions) provides the historical record. This is a
deliberate "prefer fewer collections" decision.

## 4. Lifecycle

```
pending → active → suspended → revoked
              ↘ revoked (terminal)
```

- **Registration** creates the endpoint `active` (demo endpoints need no
  separate verification step; `verificationStatus: "unverified"` for non-device
  endpoints).
- **Suspend/activate** are reversible states for app-managed availability.
- **Revocation is terminal.** The record is preserved (history), the endpoint is
  immediately unusable by the routing engine, and re-access requires a fresh
  registration. A revoked endpoint cannot be reactivated — documented decision:
  silent reactivation would bypass the "fresh registration establishes a new
  trusted binding" principle.
- Exactly one endpoint per user may be `isPrimary`. Setting a new primary
  atomically unsets the previous one (server-side transaction).

## 5. Endpoint types and availability

| Type | Status | Provider |
|---|---|---|
| `WEB` | available | WebEndpointProvider (demo) |
| `MOBILE_APP` | architecture/demo | DemoEndpointProvider |
| `TAUPHONE` | demo | TauPhoneEndpointProvider (mock) |
| `TAUTALK` | demo | TauTalkEndpointProvider (mock) |
| `VERIFIED_DEVICE` | available where a devices/ record exists | — |
| `SIP_FUTURE` / `SIM_FUTURE` / `PSTN_FUTURE` | **disabled** | rejected at API |

Capabilities (voice, messaging, voicemail, notifications, caller_id, contacts,
routing) are advertised per endpoint but **capability ≠ live**. Every demo
endpoint's capabilities operate on the Prompt 11 mock communications provider.
The UI labels such endpoints `Demo` and the API stamps `availability: "demo"`.

Since Prompt 13, registration also requires the Global Plan entitlement
`endpoints.multi_device` (server-side gate; endpoints are never billing
objects themselves — the plan carries them).

## 6. Provider abstraction

`providers/endpoints/` holds the contracts (`types.ts`) and mock adapters
(`mocks.ts`): `register`, `verify`, `deactivate`, `deliverEvent` — all returning
`MOCK-*` provider references and clearly typed `demo: true` results. The registry
in `providers/index.ts` resolves per-type providers; TauPhone/TauTalk adapters
are placeholders that define the future integration contract (§7) without any
network behavior.

### TauPhone contract (future responsibilities)

Endpoint registration, device authentication, capability registration, number
association, communication event delivery, endpoint status reporting, push
notification registration, call/message event routing.

### TauTalk contract (future responsibilities)

Endpoint registration, identity linking, message delivery, presence,
notification events, communication history synchronization.

### TauCore identity boundary

Future mapping (interfaces/types + docs only — **no** fake integration):

```
TauID → OneNumbr Identity → OneNumbr Number → Communication Endpoints
```

Distinct identifiers, never interchangeable: `tauCoreIdentityId`,
`tauDeviceId`, `tauApplicationId` are *reference fields* on the OneNumbr side;
`oneNumbrId` remains the OneNumbr platform identity. See
`types/endpoints.ts` (`TauCoreIdentityRef`) and
`docs/cloud-telephony-architecture.md` §TauCore.

## 7. Endpoint authentication

**This sprint:** the existing authenticated application session (Firebase ID
token → verified server-side) authorizes all endpoint operations. No device
attestation exists and none is faked.

**Documented future boundary:** signed endpoint registration, short-lived
endpoint tokens, platform attestation, OAuth/OIDC, or TauID — pluggable via the
provider contract's `verify` hook without changing the engine.

Since Prompt 14, each connection in the connectivity service layer can
reference a consuming endpoint (`endpointId`); the endpoint remains the access
surface — never the owner of connectivity or the number. See
`docs/connectivity-architecture.md` §2.

## 8. Routing

Extends Prompt 11's deterministic demo routing:

```
Inbound (demo) → OneNumbr Number → communications layer
  → routing rules → active endpoints (primary first, then others)
  → fallback → voicemail (always terminal)
```

`simulateRouting(kind)` evaluates live endpoint state and returns the decision
plus the ordered evaluation trace shown in the Communications UI. No PSTN is
involved anywhere in this chain.

Presence (`online | offline | busy | unavailable | suspended`) is an
application-layer preference updated explicitly — no heartbeats, no continuous
listeners (Firebase free-tier constraint).

## 9. Security controls

Inherited from the Prompt 10 architecture: authenticated access on every route;
ownership derived from the verified session (never from request body); zod
validation; per-scope rate limits (`endpoint-register` 20/h,
`endpoint-revoke` 30/h, `endpoint-activate` 30/h,
`endpoint-routing-update` 60/h); audit events
(`communications.endpoint_registered|activated|suspended|revoked|primary_changed|routing_changed|provider_operation`);
safe error envelopes with request IDs; no secrets, tokens or private
credentials stored in endpoint metadata. Provider-mode guard remains
authoritative at boot.

## 10. Tests

See `docs/testing.md` §12. Highlights:

- **Number immutability test** (the core promise): register Web → TauPhone →
  TauTalk, revoke TauPhone, re-register TauPhone — OneNumbr ID and number are
  byte-identical throughout.
- **Isolation test**: user B's GET/revoke/activate/set-primary against user A's
  endpoint all fail with 403/404.
- **Lifecycle test**: pending→active→suspended→revoked; revoked reactivation
  rejected; history preserved.
- **Routing test**: deterministic primary → fallback → voicemail evaluation.
- **TauPhone/TauTalk mock test**: both register against the same identity and
  number; `MOCK-*` references; zero network operations.
