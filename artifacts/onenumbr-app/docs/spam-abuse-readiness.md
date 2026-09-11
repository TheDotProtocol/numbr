# OneNumbr — Spam / Abuse / Anti-Automation Readiness (Prompt 16, v1.0)

> **OneNumbr is the product. Trust and safety is infrastructure beneath it.**
>
> This document is architecture + readiness only. It does **not** implement a real
> spam filter, a real abuse dashboard, a real sender reputation system, a real
> CAPTCHA/verification vendor, a real telemetry/ticketing vendor, or any live
> inbound/outbound message processing beyond what already exists. It defines the
> contracts, controls, selection plumbing, testing foundation and honest readiness
> boundaries so that future trust-and-safety providers can be integrated without
> changing the OneNumbr identity, number, plan, communications or endpoint layers.

## 1. Where trust and safety sits

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
              TRUST & SAFETY LAYER        ← Prompt 16
              (spam / abuse / automation)
                      │
              PROVIDERS (future)
```

Trust and safety is **another replaceable infrastructure layer** under the same rule
as connectivity providers (Prompt 14) and telecom/communications providers
(Prompts 11/15):

- OneNumbr owns identity, number, plan, communications, endpoints and the customer
  relationship.
- Spam/abuse/anti-automation controls are **capability providers** that OneNumbr
  may or may not enable.
- Provider changes, filter changes, reputation-model changes and automation-policy
  changes **must never redefine the OneNumbr identity or number**, and must never
  become a side channel for business logic that belongs higher in the stack.

## 2. The problem this layer is for (honest scope)

Future OneNumbr communications may need to handle:

- inbound spam and abusive messages
- inbound abusive calls/communications
- outbound spam and abuse prevention
- bulk/automated abuse and rate abuse
- account/device/endpoint automation
- reputation and sender behavior signals
- policy enforcement across communications surfaces

This document does **not** claim any of that is implemented today.

## 3. Capability model

Trust-and-safety providers declare capabilities explicitly, the same way
connectivity (Prompt 14) and provider readiness (Prompt 15) do.

Canonical trust-and-safety capabilities:

- inbound spam classification
- inbound abuse classification
- outbound spam prevention
- outbound abuse prevention
- sender/committer reputation
- device/endpoint reputation
- rate-limit intelligence
- abuse evidence capture
- blocking/allow-listing integration
- policy enforcement
- incident detection
- telemetry/event ingestion (for future provider analytics)

A provider may declare only the subset it actually provides. Do not infer
capabilities from vendor names.

## 4. Provider classification

Trust-and-safety provider categories:

- spam_filter
- abuse_handler
- rate_control / anti_automation
- reputation_service
- incident_manager
- verifier / challenge (anti-automation)
- telemetry_sink (future, for provider-side analytics only)

No single category is assumed to cover everything.

## 5. Interfaces

Trust-and-safety providers may satisfy one or more of these Prompt-layer interfaces:

- `trust_and_safety` — general spam/abuse/automation signals and decisions
- `inbound_filter` — inbound message/communication classification and disposition
- `outbound_guard` — outbound safety checks before sending
- `rate_control` — smarter rate/behavior decisions beyond the basic Prompt 10 rate
  limiter
- `verification_challenge` — anti-automation challenge/proof (future, not CAPTCHA
  claims today)

The existing Prompt 10 rate limiter is the current basic protection. This layer is
the future richer trust-and-safety provider surface, not a replacement for the basic
abuse-resistant design.

## 6. Provider registry

Trust-and-safety providers are described in the same declarative registry style as
Prompt 15: `types/trust-and-safety.ts` + `lib/trust-and-safety-registry.ts`.

Each provider slot has:

- providerId
- displayName
- category
- environment
- availability (demo / sandbox / live / disabled)
- configState (not_configured / missing_credentials / invalid_credentials /
  sandbox_only / production_ready / disabled)
- interfaces
- capabilities
- regions
- configuration requirements (docs only, never credentials)
- note (customer-safe)

No secrets. No credentials. No provider tokens in the registry.

## 7. Provider configuration

Configuration requirements are documented, not implemented.

Example environment requirements (only as templates — not added as live secrets):

TRUST_AND_SAFETY_PROVIDER=
TRUST_AND_SAFETY_PROVIDER_API_KEY=
TRUST_AND_SAFETY_PROVIDER_API_SECRET=
TRUST_AND_SAFETY_PROVIDER_WEBHOOK_SECRET=

Only variables that are actually needed by the abstraction exist. Do not invent
provider-specific variables for providers that do not exist.

## 8. Provider selection

Server-side only.

Future calls ask for a requirement, for example:

- “I need an inbound spam filter for this communications surface”
- “I need outbound guard for this sender/committer”
- “I need rate/behavior intelligence for this account/endpoint/device”
- “I need an anti-automation challenge provider”

The server selects a provider based on:

- required interface
- required capability
- region
- provider health
- availability (demo/sandbox/live)
- policy

The client never says “use provider X” for privileged trust-and-safety decisions.

In this release, no real trust-and-safety provider exists, so the registry returns
honest disabled/empty results for live requirements.

## 9. Inbound pipeline (boundary + contract)

The inbound pipeline is defined as a contract, not as a live system.

Future inbound flow:

incoming communication
    ↓
verify source / delivery
    ↓
normalize provider event
    ↓
classify (spam / abuse / suspicious / clean)
    ↓
decide (allow / quarantine / block / flag / escalate)
    ↓
apply local controls if applicable
    ↓
notify / audit where appropriate

Rules:

- Inbound pipeline is disabled until a real provider and a real inbound channel exist.
- The webhook/ingest boundary must verify signature, timestamp, replay and idempotency
  (same foundation as Prompt 15 `lib/webhooks-server.ts`).
- Inbound data must pass through a verified adapter; it must never mutate arbitrary
  customer data directly.
- Message bodies and abuse evidence are customer/internal data; they must not leak to
  other customers or to client UI unnecessarily.

## 10. Outbound guard (boundary + contract)

Outbound guard is defined as a contract, not as a live system.

Future outbound flow:

outbound communication request
    ↓
entitlement + ownership check
    ↓
rate/behavior check
    ↓
content/sender reputation check (provider)
    ↓
allow / throttle / reject / flag
    ↓
audit + optional notification

Rules:

- Outbound guard never overrides OneNumbr ownership/entitlement logic.
- Outbound guard can only add restrictions, not invent new product rights.
- No live outbound spam filtering exists today.

## 11. Anti-automation / rate-control layer

Current protection is the Prompt 10 rate limiter. Prompt 16 adds the future richer
layer for when it is needed.

Future anti-automation concerns:

- suspicious repeated actions
- automated endpoint/session/device registration patterns
- automated checkout/purchase patterns
- automated support/ticket patterns
- automated identity/KYC patterns
- credential-guessing patterns

Future controls may include:

- behavior scoring/risk signals
- step-up verification/challenge
- temporary restrictions
- ticket/case creation for review
- provider-side telemetry (future)

No live anti-automation vendor, no live challenge provider, no live “verified
non-bot” claim exists today.

## 12. Block/allow/quarantine model

A future trust-and-safety layer may produce dispositions such as:

- allow
- flag
- quarantine
- block
- escalate

These are operational dispositions, not identity changes. A trust-and-safety decision
must not:

- change the OneNumbr ID
- change the OneNumbr Number
- change the Global Plan
- change communications history semantics
- create a new customer identity

Where a block affects a customer experience, the customer-facing message must be honest
and product-level, never expose provider internals or raw signals.

## 13. Evidence / audit / retention

Trust-and-safety decisions should be auditable.

Recommended record types (defined as contracts; implementations may vary):

- trust_and_safety_events / provider_event_log
- abuse_reports
- policy_actions
- account/endpoint/device risk notes (internal)

Retention principles (from Prompt 10):

- keep operational metadata separate from customer content
- keep provider credentials separate from both
- do not let provider logs become an uncontrolled PII store
- do not log message bodies unnecessarily
- do not log tokens/credentials

## 14. Provider health / reliability

Same honest model as Prompt 15.

Future provider health states:

- available
- degraded
- unavailable
- configuration_error
- not_measured

In this release, everything is `not_measured` where no real traffic exists. No
fabricated uptime/latency/error-rate numbers.

## 15. Failover / multiple-provider design

The architecture is designed for provider substitution, but:

- do not automatically move customers between trust-and-safety providers in a way that
  changes their identity/number/plan/communications
- do not silently change abuse decisions across providers
- define failover behavior; do not execute uncontrolled failover

A trust-and-safety provider may fail; the OneNumbr identity/number/plan must still be
intact.

## 16. Security

Reuse Prompt 10.

Requirements:

- authenticated access
- server-side ownership
- entitlement enforcement where relevant
- provider-mode guard (Prompt 10) for any real-provider flag
- rate limiting on trust-and-safety management actions
- audit logging
- safe errors
- no provider secrets client-side
- no client-controlled provider selection
- no client-controlled abuse decisions
- no client-controlled policy
- webhook signature/timestamp/replay/idempotency where inbound events exist

Standing rule: if it touches a customer-visible disposition, it is a security-relevant
control and must be server-authoritative.

## 17. Feature flags

Honest defaults, all off unless a real provider is configured.

Suggested flags:

- `trustAndSafetyEnabled` — overall layer readiness (always true as a surface)
- `inboundSpamFilterEnabled` — off
- `outboundGuardEnabled` — off
- `antiAutomationProviderEnabled` — off
- `senderReputationEnabled` — off
- `abuseReportingEnabled` — off
- `incidentManagementEnabled` — off
- `verificationChallengeEnabled` — off
- `trustAndSafetyTelemetryEnabled` — off

Provider readying happens only with the corresponding real-provider flag and the
Prompt 10 guard.

## 18. Do not build

Do not:

- implement a real spam filter
- implement a real abuse detection model
- implement a real sender reputation system
- implement a real CAPTCHA/verification vendor
- implement a real inbound channel
- implement a real outbound spam service
- claim OneNumbr currently filters spam or blocks abuse in any specific way that is
  not actually implemented
- claim real anti-automation protection that does not exist
- claim real compliance with any spam/abuse regulation
- bypass the Prompt 10 guard
- bypass KYC/account/entitlement logic
- break Prompts 1–15

## 19. Honest current-state statement

Today:

- OneNumbr has basic abuse-resistant design from Prompt 10 (rate limiting, safe errors,
  ownership checks, audit, request IDs, secret redaction).
- OneNumbr does **not** have a live spam filter, live reputation engine, live
  anti-automation challenge provider, or live inbound abuse pipeline.
- Any future trust-and-safety capability must be labeled according to its real state:
  demo / sandbox / live / future / disabled.

## 20. Recommended next steps (if/when real providers are considered)

1. Complete the relevant onboarding and regulatory items in the provider readiness
   docs (Prompt 15).
2. Enable only the specific trust-and-safety flag(s) for the provider(s) actually
   configured.
3. Start with inbound or outbound guard for one limited surface, not a platform-wide
   claim.
4. Keep all abuse decisions honest, auditable, reversible where appropriate, and never
   identity/number/plan changing.
