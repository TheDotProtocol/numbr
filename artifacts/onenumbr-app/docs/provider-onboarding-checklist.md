# OneNumbr — Provider Onboarding Checklist (Prompt 15, extended by Prompt 17)

> **Purpose.** This is a pre-integration checklist, not a statement that any provider
> agreement exists. Every item below must be completed **and confirmed** before a real
> provider is registered in `providers/index.ts` and enabled through the appropriate
> feature flag. Do not claim completion of any item here unless it has actually been
> done with the relevant partner.
>
> **Status convention (Prompt 17):** mark each section either **READY** (verified,
> evidenced) or **REQUIRES REVIEW** (incomplete/unverified). A provider may not be
> enabled while any mandatory section is REQUIRES REVIEW. Current overall status for
> the first cloud communications provider: **REQUIRES REVIEW — no vendor selected,
> no credentials configured** (see `docs/provider-evaluation-cloud-comms.md`).

---

## 1. Commercial relationship

- [ ] Signed commercial agreement with the provider
- [ ] Defined commercial terms (wholesale cost model, not customer-facing pricing)
- [ ] Defined SLA (availability, latency, support response, escalation path)
- [ ] Defined pricing (per operation, per minute, per message, per profile, etc.)
- [ ] Defined regions/countries the provider actually covers
- [ ] Defined capabilities the provider truly provides (do not infer from marketing)
- [ ] Defined rate limits and quotas
- [ ] Defined billing/ settlement process (how OneNumbr pays the provider)
- [ ] Defined contract term, renewal, and termination process

## 2. Technical access

- [ ] API access granted
- [ ] Sandbox / test environment available and reachable from OneNumbr servers
- [ ] Production environment access granted (separate from sandbox)
- [ ] API key(s) issued
- [ ] API secret(s) issued
- [ ] Account ID / tenant ID provided
- [ ] Webhook signing secret(s) issued (if webhooks required)
- [ ] SIP credentials issued (if SIP)
- [ ] Any required IP allowlisting completed
- [ ] Sandbox credentials rotated out of any repo/chat history

## 3. Provider profile in OneNumbr

- [ ] Provider category chosen correctly (cloud_telephony | pstn | sip | esim | mno | mvno | connectivity_aggregator | physical_sim)
- [ ] Provider interfaces declared honestly (numbering | connectivity | communications)
- [ ] Provider capabilities declared explicitly (not inferred)
- [ ] Provider regions documented
- [ ] Provider configuration requirements documented in the registry metadata
- [ ] Provider added to the readiness registry (`lib/provider-registry.ts`)
- [ ] Provider implementation registered in `providers/index.ts`
- [ ] Provider metadata and implementation added in the same change

## 4. Capabilities to validate per interface

### Numbering (if the provider supplies numbering)

- [ ] Number inventory/source confirmed
- [ ] Reservation behavior confirmed
- [ ] Assignment behavior confirmed
- [ ] Release behavior confirmed
- [ ] Portability support confirmed (if claimed)
- [ ] Number format/validation rules documented
- [ ] Numbering authority/allocation status understood
- [ ] Routing status understood

### Connectivity (if the provider supplies connectivity)

- [ ] Provision behavior confirmed
- [ ] Activate behavior confirmed
- [ ] Suspend behavior confirmed
- [ ] Resume behavior confirmed (or explicitly unsupported)
- [ ] Terminate behavior confirmed
- [ ] Status queries confirmed
- [ ] Capabilities confirmed (voice / sms / mms / data / esim / physical_sim / roaming / sip / pstn / webhooks / portability)
- [ ] eSIM: profile provisioning flow confirmed (if applicable)
- [ ] eSIM: SM-DP+ relationship understood (if applicable)
- [ ] eSIM: QR/LPA flow understood (if applicable)
- [ ] eSIM: profile lifecycle confirmed (if applicable)
- [ ] eSIM: device compatibility constraints documented (if applicable)
- [ ] eSIM: deletion/replacement flow confirmed (if applicable)
- [ ] eSIM: roaming constraints documented (if applicable)
- [ ] Physical SIM: SIM inventory process confirmed (if applicable)
- [ ] Physical SIM: ICCID/IMSI assignment confirmed (if applicable)
- [ ] Physical SIM: activation flow confirmed (if applicable)
- [ ] Physical SIM: shipping/replacement process confirmed (if applicable)
- [ ] MNO/MVNO: subscriber provisioning confirmed (if applicable)
- [ ] MNO/MVNO: SIM/eSIM lifecycle confirmed (if applicable)
- [ ] MNO/MVNO: network access/ APN confirmed (if applicable)
- [ ] MNO/MVNO: roaming confirmed (if applicable)

### Communications (if the provider supplies communications)

- [ ] Inbound voice confirmed (if applicable)
- [ ] Outbound voice confirmed (if applicable)
- [ ] SMS send/receive confirmed (if applicable)
- [ ] Call routing confirmed (if applicable)
- [ ] Voicemail confirmed (if applicable)
- [ ] Recording behavior/legality confirmed (if applicable)
- [ ] Caller ID behavior confirmed (if applicable)
- [ ] Webhook events documented (if applicable)

## 5. Webhooks (if the provider sends events)

- [ ] Webhook documentation reviewed
- [ ] Event types documented
- [ ] Signature scheme documented (HMAC/RSA/EdDSA/SDK verifier)
- [ ] Webhook secret stored server-side only (never in repo, never client-readable)
- [ ] Signature verification implemented per provider scheme
- [ ] Timestamp validation implemented
- [ ] Replay protection implemented
- [ ] Idempotency by provider event id implemented
- [ ] Event normalization implemented (provider event → OneNumbr domain event)
- [ ] Provider error mapping implemented (raw error → OneNumbr error code + category)
- [ ] Duplicate event handling confirmed safe
- [ ] Provider retries confirmed not to create duplicate numbers/charges/connections/communications
- [ ] Webhook endpoint deployed to production environment only when provider is production-ready

## 6. Error handling & resilience

- [ ] Provider error codes documented
- [ ] Transient vs permanent classification documented
- [ ] Retry behavior defined (what to retry, what not to retry)
- [ ] Rate limit handling defined
- [ ] Timeout handling defined
- [ ] Circuit-breaker / provider-health integration defined (if used)
- [ ] Fallback behavior defined (if any) — **no uncontrolled automatic customer migration**
- [ ] Provider outage runbook drafted

## 7. Security

- [ ] Secrets stored in secret manager / environment (not committed)
- [ ] Least-privilege provider account used
- [ ] Sandbox and production accounts separated
- [ ] Webhook signature verification enabled in production
- [ ] Key rotation process defined
- [ ] Audit events do not include secrets/tokens/signed URLs
- [ ] Provider logs do not become uncontrolled PII source
- [ ] Provider credentials not exposed in admin UI

## 8. Compliance / regulatory (professional review required)

- [ ] Numbering authority requirements reviewed
- [ ] Telecom licensing/authorization reviewed where applicable
- [ ] PSTN access requirements reviewed (if applicable)
- [ ] Caller ID requirements reviewed (if applicable)
- [ ] Emergency calling obligations reviewed (if applicable)
- [ ] Lawful intercept requirements reviewed where applicable
- [ ] KYC/identity requirements reviewed (OneNumbr already has KYC; confirm provider-side requirements too)
- [ ] SIM/eSIM regulations reviewed (if applicable)
- [ ] Data protection requirements reviewed
- [ ] Cross-border communications requirements reviewed
- [ ] SMS regulations reviewed (if applicable)
- [ ] Anti-fraud obligations reviewed
- [ ] Spam/abuse controls reviewed
- [ ] Number portability requirements reviewed (if applicable)
- [ ] Country-specific requirements reviewed for each operating market

> **No legal conclusions are implied by this checklist.** Each regulatory area must be
> reviewed by the appropriate professional/regulatory counsel before launch in a given
> market.

## 8a. KYC gating (Prompt 17)

> The provider integration must sit **behind** OneNumbr KYC, never in front of it.

- [ ] Flow confirmed: User → OneNumbr account → KYC state → OneNumbr authorization → Trust & Safety controls → Provider operation
- [ ] No provider operation can bypass the existing KYC gate
- [ ] Only data the provider actually requires is sent to the provider (minimum necessary)
- [ ] No KYC documents/PII forwarded to the provider unless contractually required and reviewed
- [ ] Provider-side KYC requirements (if any) documented and reconciled with OneNumbr KYC state

## 8b. Trust & Safety gating (Prompt 16 + 17)

- [ ] Outbound communications evaluated through the trust-and-safety pre-send boundary before hitting the provider
- [ ] Rate limits, automation controls and abuse controls applied server-side
- [ ] Quarantine/block state respected for both account and number
- [ ] No fabricated reputation scores — if no real reputation system exists, the readiness boundary is used honestly
- [ ] Abuse/trust-and-safety events audited (no secrets, minimum-necessary content)

## 8c. Billing / wholesale economics (Prompt 17)

- [ ] Wholesale provider costs held server/admin-only (`providerCost*` metadata never exposed to clients)
- [ ] Customer Global Plan economics unchanged by the provider integration
- [ ] No per-minute/per-message customer pricing invented from provider wholesale rates
- [ ] Provider settlement model documented (how OneNumbr pays; reconciliation cadence)
- [ ] Cost model interface exists internally even if amounts are unset
- [ ] No live billing enabled without an explicitly configured billing provider

## 8d. Testing before enablement (Prompt 17)

- [ ] Provider contract tests pass against the adapter (config, capabilities, lifecycle, errors)
- [ ] Webhook verification/replay/idempotency tests pass
- [ ] Provider-mode guard test passes for the target environment
- [ ] Identity immutability test passes (provider A → B changes only provider infrastructure)
- [ ] Sandbox/free test traffic used for all development testing — **no real paid operations from tests**
- [ ] Durable webhook idempotency in place (or explicitly time-boxed as pre-production-only)

## 9. Operational readiness

- [ ] Support escalation path documented
- [ ] Incident response process documented
- [ ] Provider status/health reporting integrated (safe status only, no credentials)
- [ ] Customer-facing status wording approved (demo/live/future distinction preserved)
- [ ] Admin console updated where relevant (readiness metadata only)
- [ ] Customer 360 updated where relevant (customer-relevant status only)
- [ ] Health endpoint updated where relevant (no secrets)
- [ ] Feature flag(s) added/confirmed for real-provider activation
- [ ] Provider-mode guard behavior confirmed for the new provider domain
- [ ] Rollback plan defined
- [ ] Termination/exit process documented

## 10. Go/no-go

- [ ] All relevant checklist items completed and confirmed
- [ ] Real-provider feature flag set explicitly (not inferred)
- [ ] Provider-mode guard allows the provider in the target environment
- [ ] Demo/live boundary clearly communicated in UI and docs
- [ ] Documentation updated to reflect the actual provider (not generic claims)
- [ ] No fabricated claims about coverage, licensing, agreements, or PSTN availability
- [ ] OneNumbr identity/number/plan independence still structurally preserved

---

## Do not onboard a provider if...

- [ ] There is no signed agreement
- [ ] There are no production credentials (sandbox-only is not production)
- [ ] The provider cannot meet the capability claims OneNumbr would need to make
- [ ] Regulatory review has not been completed for the target markets
- [ ] Secret management is not in place
- [ ] Webhook security is not implemented for the provider's scheme
- [ ] The provider would force OneNumbr to depend on a single provider for identity/number/plan semantics

The last point is the most important architectural rule in this checklist:

**OneNumbr owns identity, number, plan, communications, endpoints, and the customer relationship.**
**Providers are replaceable infrastructure.**
