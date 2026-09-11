# OneNumbr — Cloud Telephony Architecture (Prompt 11, v1.0; endpoints added in Prompt 12)

> **"ONE NUMBER. ANYWHERE."**
> Product promise: *"Your number doesn't change when your country changes."*

OneNumbr is **not** an eSIM marketplace. The eSIM engine (Prompt 3) is the
first **connectivity abstraction layer** underneath the real product: a global
communications identity platform. This document defines the architecture that
lets OneNumbr **become** a cloud-telephony platform without rewriting the core.

## Numbering disclaimer (read first)

**+1739 is an application-level OneNumbr numbering abstraction.** It is not an
officially assigned international telecom country code, OneNumbr +1739 numbers
are not PSTN-routable, and no carrier functionality is claimed or faked. The
data model, provider boundaries and UI all encode this honestly, and a future
legitimate PSTN/numbering arrangement can be plugged in without redesign.

## 1. Domain hierarchy

```
USER
 ↓
ONENUMBR ID          (onenumbr_ids/{uid} — ON-284739, PERMANENT, never changes)
 ↓
PRIMARY ONENUMBR NUMBER   (+1739 284739 — public communications identity)
 ↓
GLOBAL PLAN          (one standard monthly subscription via the billing engine)
 ↓
COMMUNICATIONS       (voice · messaging · voicemail · routing · endpoints)
 ↓
CONNECTIVITY         (eSIM today-as-abstraction · PSTN/MVNO/SIM future)
```

Identity invariants (verified in tests):

- Releasing, replacing or (eventually) porting a number **never** changes the
  OneNumbr ID.
- The number engine (`number_assignments`) remains the ownership source of
  truth; communications reads it, never duplicates it.
- Product model: **one primary number** per OneNumbr ID; additional active
  assignments project as `secondary`; released assignments remain as history.

## 2. Numbering status model

| Field | Values today | Purpose |
|---|---|---|
| `numberingStatus` | `application_only` | `future_pstn_pending` / `pstn_enabled` reserved for a real arrangement |
| `pstnStatus` | `not_available` | `pending_arrangement` / `enabled` gated on a carrier agreement |
| `routingStatus` | `application` | `pstn` only with a live PSTN adapter |

No code path can set `pstn_enabled` without `PSTN_PROVIDER_BOUNDARY.enabled`
(flipped only alongside a signed arrangement) and `FEATURE_PSTN_ENABLED=true`.

Number structure: `applicationPrefix` (`+1739`) + `subscriberNumber`
(`284739`) + `canonicalRepresentation` (`+1739284739`). Display formatting is
derived, never hard-coded per call site.

## 3. Layer / provider architecture

```
OneNumbr Communications Layer          lib/communications-server.ts
        ↓
CommunicationsProvider                 providers/communications/types.ts
        ↓  (mock today)                mockCommunicationsProvider
   future PSTN adapter                 providers/communications/pstn-future.ts (boundary only)
        ↓
TelecomProvider (numbering)            providers/telecom/*  (Prompt 4 — unchanged)
        ↓
Connectivity (eSIM engine)             Prompt 3 — unchanged, consumed as abstraction
        ↓
Carrier / PSTN / MNO / MVNO / cloud    future integrations
```

Decision recorded (per the prompt's A/B question): **Option B** — the existing
`TelecomProvider` stays the numbering/provisioning provider; the new
`CommunicationsProvider` sits **above** it. This gives clean separation
between NUMBERING (provision a number), CONNECTIVITY (data/transport), and
COMMUNICATIONS (voice/messages/voicemail/routing on top of a number).

### CommunicationsProvider interface

Voice: `initiateCall`, `updateCallStatus`, `getCallStatus`, `endCall`,
`forwardCall`. Messaging: `sendMessage`, `receiveMessage`,
`getMessageStatus`. Voicemail: `createVoicemail`, `getVoicemails`,
`markVoicemailRead`. History: `getCallHistory`, `getMessageHistory`.
A real provider implements the same interface and registers in
`providers/index.ts` — and only there.

### Mock provider honesty

`mockCommunicationsProvider` (name `mock-communications`) returns
`MOCK-CALL-XXXX`, `MOCK-MSG-XXXX`, `MOCK-VM-XXXX` references. It never touches
a network. Deterministic test paths: a `to.label` starting with `"Fail"`
triggers the failure path. The UI always says **demo/simulation** — never
"live call connected".

## 4. Data model (Firestore)

| Collection | Doc shape | Notes |
|---|---|---|
| `calls/{callId}` | `CallRecord` | lifecycle `initiated → ringing → answered → ended`, failures `failed/cancelled/busy/no_answer`; provider fields isolated |
| `messages/{messageId}` | `MessageRecord` | `queued → sent → delivered → read`, `failed`; demo delivery is instant |
| `voicemails/{voicemailId}` | `VoicemailRecord` | demo **transcript only**; no audio stored (future audio = private Storage + signed URLs) |
| `communication_endpoints/{endpointId}` | `CommunicationEndpoint` | web / mobile_app / tau_phone / verified_device / forwarding / voicemail / sip / pstn (last two blocked while PSTN disabled) |
| `routing_rules/{uid}` | `RoutingRule` | ordered steps + ring timeout; **voicemail is always the terminal fallback** |
| `communication_preferences/{uid}` | `CommunicationPreferences` | voicemail/alerts toggles |

Indexes added: `calls(uid+startedAt)`, `messages(uid+createdAt)`,
`voicemails(uid+createdAt)`, `communication_endpoints(uid+priority)`.

Security (Prompt 10 model): all six collections are **read-your-own,
client-writes-denied**; every transition happens in
`lib/communications-server.ts` with owner checks. Audit actions
`communications.*` never log message bodies or party details.

## 5. Inbound routing (architectural preparation)

```
incoming call (future)
      ↓
OneNumbr routing engine          (routing_rules/{uid}, ordered steps)
      ↓ preferred endpoint       app → tau_phone → verified device → forward
      ↓ fallback endpoint(s)     next enabled step by priority
      ↓ voicemail                ALWAYS terminal fallback
```

No carrier forwarding exists; `forwardCall` on the mock provider is a
documented no-op with a deterministic failure path for tests.

## 6. Endpoints — one number, many places to be reached

`communication_endpoints` models where a OneNumbr Number can ring: the web
app today; TauPhone, mobile app, verified devices, SIP and PSTN later.
**The number never changes when endpoints change** — this is the architectural
foundation of "ONE NUMBER. ANYWHERE." Adding a `sip`/`pstn` endpoint is
rejected while `PSTN_PROVIDER_BOUNDARY.enabled` is false.

**Prompt 12 expands this into a first-class ENDPOINT LAYER** with its own
provider abstraction, lifecycle (pending → active → suspended → revoked),
capabilities, primary-endpoint preference, presence and deterministic routing
simulation. Full details, contracts and the TauPhone/TauTalk/TauCore
boundaries: **`docs/endpoint-architecture.md`**.

```
OneNumbr Identity
        ↓
OneNumbr Number
        ↓
Global Plan
        ↓
Communications Core
        ↓
Endpoint Layer          ← Prompt 12
        ↓
Connectivity Layer
        ↓
Future Telecom Infrastructure
```

## 7. Global Plan

One standard monthly plan, built on the existing billing subscriptions
(`source === "number"`). `getGlobalPlanView(uid)` projects it honestly,
including `demoProvider: true`. Entitlements (voice/messaging/voicemail/
connectivity/cross-device) are conceptually bundled; no new recurring billing
was built, and no real charges occur (demo payment provider unchanged).

**Prompt 13 makes this a first-class commercial domain:** the plan catalog
(`one_global_v1`, immutable versions), the entitlements engine (server-side
resolution, engine gates on voice/messaging/endpoint registration), and the
subscription linkage — number activation now starts the Global Plan
subscription through the existing billing engine. See
**`docs/global-plan-architecture.md`**.

## 8. Connectivity reframing

**Prompt 14 completes this reframing:** connectivity is now a first-class
service layer (`lib/connectivity-server.ts` + `providers/connectivity/`) with a
provider contract (cloud demo + eSIM adapter; MNO/MVNO/SIM boundaries typed but
disabled), the `connectivity.global` entitlement gate, and a dedicated
`/app/connectivity` experience. See **`docs/connectivity-architecture.md`**.

The eSIM engine is untouched and fully functional. Conceptually it is now the
first **connectivity provider** beneath communications; the nav item and
dashboard card are relabeled **Connectivity**, and the Communications card
shows voice/messages/voicemail on the primary number. Future connectivity
types (cloud, PSTN, MNO/MVNO, eSIM, physical SIM, SIP) plug in under the same
boundary; communications code consumes connectivity only through provider
interfaces.

## 9. TauCore integration boundary (contract only)

`types/communications.ts` defines `TauCoreIdentityToken` and
`TauCoreEndpointRegistration` — the payloads TauPhone/TauTalk/TauID would
consume. Nothing emits or accepts them; `FEATURE_TAUCORE_ENABLED` defaults to
false. Intended future flow:

```
TauID → OneNumbr Identity → OneNumbr Number → TauPhone / TauTalk endpoints
```

No fake integration is claimed anywhere.

## 10. Security boundaries

Prompt 10 model enforced throughout: per-request token verification; uid from
the verified session only; server-side ownership on every record; server-
derived plan/price; rate limits (`comm_call` 30/h, `comm_message` 60/h,
`comm_routing`/`comm_endpoint` 20/h); audit + notification kinds extended;
demo provider references safe to display; future carrier credentials live
only in a server secret manager.

## 11. Feature flags

`communicationsEnabled` (default **on**), `voiceEnabled` / `messagingEnabled`
/ `voicemailEnabled` / `connectivityEnabled` (on, **demo-only**),
`pstnEnabled` (**off**), `tauCoreIntegrationEnabled` (**off**). Disabled
features return calm 503s and are never shown as active.

## 12. Future migration path

1. Register a real `CommunicationsProvider` (cloud telephony) in the
   registry → communications become live without UI changes.
2. Execute a numbering arrangement → flip
   `PSTN_PROVIDER_BOUNDARY.enabled` + `FEATURE_PSTN_ENABLED`; numbers gain
   `future_pstn_pending` → `pstn_enabled`; PSTN endpoints unlock.
3. Portability, emergency-calling design and regulatory review are
   pre-conditions documented in `providers/communications/pstn-future.ts`.
4. TauCore services integrate via the §9 contracts.

**Prompt 15 provider readiness:** every real provider integration goes through
the provider-readiness layer — capability model, classification, registry
metadata, server-side selection, webhook architecture, idempotency, error
normalization, provider health and the Prompt 10 provider-mode guard. See
`docs/provider-readiness-architecture.md`, `docs/provider-onboarding-checklist.md`
and `docs/telecom-regulatory-readiness.md`. The same provider-readiness
surface also covers future MNO/MVNO, eSIM, physical SIM, SIP and PSTN
boundaries — the existing `TelecomProvider` (numbering) and
`CommunicationsProvider` remain separate concerns that a single future vendor
may or may not combine.
