# OneNumbr — Provider Readiness Architecture (Prompt 15)

> OneNumbr is the product. Providers are replaceable infrastructure.
> The customer buys ONE ONENUMBR, not a carrier, an eSIM, a SIM, a country plan or a cloud telephony account.

## Purpose

Prompt 15 does **not** integrate a real telecom/connectivity provider. It prepares OneNumbr to do so correctly by defining the provider model, the registry, the secure webhook foundation, idempotency/retry, provider health, provider selection, and the honest documentation boundaries for numbering, PSTN, MNO/MVNO, eSIM, physical SIM and cloud telephony.

## Product hierarchy (unchanged)

```
                 ONENUMBR ID
                      │
                ONENUMBR NUMBER
                      │
                  GLOBAL PLAN
                      │
                COMMUNICATIONS
                      │
                  ENDPOINTS
                      │
                 CONNECTIVITY
                      │
                  PROVIDERS
                      │
        ┌─────────────┼─────────────┐
        │             │             │
      CLOUD          eSIM        MNO/MVNO
        │             │             │
        └─────────────┼─────────────┘
                      │
                PHYSICAL SIM
                   FUTURE
                      │
                    PSTN
                   FUTURE
```

The provider is underneath the OneNumbr number. Changing a provider must never change the OneNumbr ID or the OneNumbr Number.

## Provider capability model

A provider explicitly declares capabilities it supports. Capability is **declared**, not inferred from the provider name or category.

- `numbering` — number inventory, reservation, assignment, release
- `voice` — outbound + inbound voice
- `sms` — outbound + inbound text
- `mms` — media messaging
- `data` — data access (connectivity concern)
- `esim` — eSIM profile lifecycle
- `physical_sim` — physical SIM lifecycle
- `roaming` — international roaming
- `sip` — SIP trunk/endpoint
- `pstn` — PSTN routing/connectivity
- `webhooks` — signed webhook event delivery
- `portability` — number portability where supported

## Provider classification

Provider categories are distinct and intentionally not interchangeable:

- `cloud_telephony` — voice/SMS over cloud APIs, no SIM
- `pstn` — public switched telephone network carrier
- `sip` — SIP trunk/endpoint
- `esim` — eSIM profile + connectivity
- `mno` — mobile network operator
- `mvno` — mobile virtual network operator
- `connectivity_aggregator` — wholesale connectivity from one API surface
- `physical_sim` — physical SIM inventory + activation

A single vendor may implement more than one interface. The domain model must not require it.

## Cross-domain interfaces

A provider may satisfy one or more of the OneNumbr prompt-layer surfaces:

- `numbering` — TelecomProvider-style number operations (Prompt 4)
- `connectivity` — ConnectivityProvider-style lifecycle (Prompt 14)
- `communications` — CommunicationsProvider-style call/message/voicemail (Prompt 11)

## Provider registry

The registry lives in `lib/provider-registry.ts` and is surfaced to admin, Customer 360, health and docs. It describes providers as first-class entities with:

- `id`, `displayName`, `category`
- `environment` (`demo` | `sandbox` | `production`)
- `availability` (`demo` | `sandbox` | `live` | `disabled`)
- `configState` (`not_configured` | `missing_credentials` | `invalid_credentials` | `sandbox_only` | `production_ready` | `disabled`)
- `interfaces`, `capabilities`, `regions`
- `configurationRequirements`, `note`

Provider instances still live in `providers/index.ts`. The registry describes them; it does not store or expose credentials.

## Provider configuration state

The configuration state is derived from environment and feature flags. It is **status only** — it never exposes credential values, tokens, webhook secrets, signing keys, ICCIDs, IMSIs, subscriber references, SIM references, SIP credentials or carrier account identifiers.

In this release every provider is:

- demo providers — `availability: demo`, `configState: not_configured` by choice
- future boundaries — `availability: disabled`, `configState: not_configured`

## Provider health

Provider health is observable, not fabricated. In this release every snapshot is `status: not_measured` with an honest note. We do not claim availability numbers or latency stats that have not been measured against a real provider.

## Provider selection

Provider selection is **server-side only**. The client sends a requirement (interface, optional capability, optional region), never a provider id. The server chooses from providers that declare the required interface + capability + region, preferring a configured/live provider when one exists.

A real provider may be selected only when:

- its feature flag is set
- the Prompt 10 provider-mode guard allows it in the current environment
- it actually satisfies the capability/interface/region requested

## Provider-mode guard (Prompt 10)

The Prompt 10 `assertProviderModeAllowed()` guard remains authoritative and is re-exposed through `describeProviderMode()` for admin/ops display. Production may not run a mock provider without the real-provider flag or the explicit `ONENUMBR_ALLOW_DEMO_IN_PRODUCTION` acknowledgement. Development may not activate a real provider. This guard is not weakened by Prompt 15.

## Webhook architecture (foundation)

When a real provider sends webhooks, the handler MUST:

1. verify the provider signature (`verifyProviderWebhookSignature()`)
2. validate the provider timestamp and reject replays (`validateProviderWebhookTimestamp()`)
3. dedup by provider event id (`isEventAlreadyProcessed()` / `markEventProcessed()`)
4. normalize the raw event to a OneNumbr domain event (`normalizeProviderEvent()`)
5. act only through `handleNormalizedProviderEvent()` — which audits and routes notifications, but never mutates customer data directly from the webhook payload
6. never log, store or return secrets, tokens, signed URLs, raw payloads or KYC content

Webhook endpoints live under `app/api/webhooks/[provider]/route.ts` (placeholder today). A provider webhook must never directly mutate arbitrary customer data — it passes through a verified adapter.

The webhook secret must be server-side, environment-driven, never client-readable, never committed.

## Idempotency

Provider operations must be idempotent where applicable (provision, activate, suspend, resume, terminate, send message, initiate call). The webhook foundation includes provider-event-id dedup so provider retries do not create duplicate numbers, charges, connections or communications.

In this release the dedup store is a placeholder for the contract; a real provider webhook deployment must use a durable store before go-live.

## Retry model

Provider errors are classified as:

- `transient` — safe to retry with backoff
- `permanent` — do not retry automatically
- `authentication` — credentials/configuration problem
- `rate_limited` — wait and retry
- `not_found` — resource does not exist
- `conflict` — idempotent conflict, likely already done
- `unsupported` — capability/region/operation not supported

Provider-specific errors are mapped into OneNumbr domain errors (`mapProviderError()`). Raw provider messages must not leak to customers.

## Multi-provider architecture (no uncontrolled failover)

The architecture supports multiple providers and future failover, but this sprint does **not** automatically move active customers between providers. Provider migration can affect numbers, routing, SIMs, eSIM profiles, voice, SMS and regulatory obligations, so failover is a planned operation, not an automatic reaction.

## Numbering readiness

The current `+1739` OneNumbr numbering abstraction is application-level and is **not** represented as an officially assigned PSTN country code. Numbering readiness documents the future relationship:

OneNumbr Number → Numbering Authority → Assigned Range → PSTN Routing

Future metadata may include numbering authority, allocation status, routing status, country association, carrier assignment and portability status. Only real values are used when a real numbering arrangement exists.

## PSTN readiness

PSTN is not merely connectivity. It may eventually provide numbering, voice, SMS and carrier routing, and is kept separate from generic connectivity. Future requirements include legitimate numbering, carrier relationship, voice/SMS routing, caller ID, emergency services, lawful/regulatory requirements, portability, fraud/spam controls, geographic restrictions and number validation. Live PSTN is not implemented.

## MNO / MVNO readiness

Future MNO/MVNO integration would need subscriber provisioning, SIM/eSIM lifecycle, IMSI, ICCID, APN where applicable, voice, SMS, data, roaming, network lifecycle, webhook/events, suspension, termination, replacement. These identifiers are connectivity/provider identifiers — not the OneNumbr number. Live MNO/MVNO is not implemented.

## eSIM readiness

The existing eSIM abstraction is preserved and repositioned as one connectivity mechanism under the Connectivity Service Layer. Future eSIM readiness would include eSIM inventory, profile provisioning, activation, SM-DP+ relationship, QR/LPA where applicable, profile lifecycle, device compatibility, deletion/replacement, roaming. SM-DP+ is not implemented. GSMA compliance is not claimed. Production eSIM provisioning is not claimed.

## Physical SIM readiness

A physical SIM is connectivity infrastructure, not the OneNumbr identity. Future readiness would need SIM inventory, ICCID/IMSI, carrier association, activation, shipping, replacement, suspension. Live physical SIM is not implemented.

## Cloud telephony readiness

Future cloud-telephony requirements would include inbound/outbound voice, SMS, caller ID, call routing, recording where legally supported, voicemail, webhooks, number provisioning, number porting, fraud controls. No provider is selected yet. No provider is integrated yet.

## Regulatory readiness

See `docs/telecom-regulatory-readiness.md` — a checklist of areas requiring professional/regulatory review before launch. It does not claim compliance.

## Provider security

Reuse Prompt 10 security architecture:

- secret storage is server-side and environment-driven
- webhook signature verification is mandatory for inbound provider events
- key rotation and least privilege apply to provider accounts
- sandbox/production separation is enforced
- audit logs record provider operations without secrets
- request IDs and error redaction apply
- provider credentials are never client-readable

## Honest status everywhere

Every provider must explicitly declare:

- `environment` (`demo` | `sandbox` | `production`)
- `availability` (`demo` | `sandbox` | `live` | `disabled`)

The UI uses this distinction. "Live" is used only when an actual production provider exists.

## Do not build

- choose a carrier as the permanent architecture
- claim a provider agreement
- implement live carrier APIs, MNO, MVNO, PSTN, SMS, voice, eSIM, SM-DP+, GSMA compliance, emergency calling, number portability, physical SIM, roaming or usage billing
- claim +1739 is an official country code
- expose wholesale costs
- create provider-specific customer plans
- bypass the provider-mode guard, KYC or entitlements
- break Prompts 1–14

## Success criteria

- Provider architecture is provider-independent.
- Numbering, connectivity and communications are separate concerns.
- Provider capabilities are explicit.
- Provider configuration is server-side and status-only.
- Provider registry is clean.
- Provider selection is server-side.
- Provider errors normalize into OneNumbr errors.
- Webhook architecture is defined securely.
- Idempotency and retry classification exist.
- Provider health model exists.
- No uncontrolled automatic failover exists.
- Numbering/PSTN/MNO/MVNO/eSIM/physical-SIM/cloud-telephony readiness is documented.
- Regulatory and commercial onboarding checklists exist.
- Global Plan remains provider-independent.
- Customer economics remain separate from provider wholesale economics.
- Customer 360 and admin expose appropriate provider status.
- Health endpoints expose safe provider status.
- Feature flags control real-provider activation.
- Demo/live boundaries are explicit.
- Typecheck passes, production build passes, Prompt 1–14 regression passes.
