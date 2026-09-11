# OneNumbr — Cloud Communications Provider Evaluation (Prompt 17)

> **Status: NO VENDOR SELECTED.** No commercial provider is integrated, no
> vendor relationship is claimed, and no capability below has been verified
> against any real vendor. This checklist exists so the eventual vendor choice
> is deliberate, comparable and honest — never based on convenience.

## 1. Evaluation criteria (verify per vendor — do not assume)

### Communications capabilities
- [ ] Voice: outbound / inbound verified in vendor documentation AND sandbox
- [ ] SMS: outbound / inbound (delivery receipts?) verified
- [ ] MMS: supported markets and media constraints verified
- [ ] Webhooks: event catalog, signing scheme, replay behavior documented
- [ ] Numbering: number inventory, provisioning, release, portability support
- [ ] PSTN reach: which destinations/countries actually work

### API quality & integration
- [ ] API quality: consistency, error semantics, docs, SDK maturity
- [ ] Idempotency: native idempotency keys for sends/provisioning?
- [ ] Webhooks → normalized event coverage (call/message/number lifecycles)
- [ ] Rate limits documented; 429 semantics and headers
- [ ] Sandbox/test mode with FREE test traffic (critical for cost safety)
- [ ] Developer experience: onboarding time, test credentials, tooling

### Reach & regulatory
- [ ] International reach relevant to target markets
- [ ] Number portability support (in/out) where relevant
- [ ] Regulatory requirements per market (number registration, KYC pass-through)
- [ ] Data residency and cross-border processing constraints
- [ ] Regional restrictions (sanctioned/unsupported destinations)

### Trust & safety
- [ ] KYC requirements imposed by the vendor (what data must be sent)
- [ ] Fraud controls (toll fraud, SMS pumping, spoofing protections)
- [ ] Abuse handling and traffic filtering options
- [ ] A2P/registration requirements for SMS (e.g. campaign registration)

### Commercial
- [ ] Pricing clarity: per-minute / per-message / per-number, billing granularity
- [ ] Wholesale economics understood (internal only — never customer-facing)
- [ ] SLA: availability commitment, latency, support response, escalation
- [ ] Support quality: channels, hours, technical depth
- [ ] Contract terms: commitment, termination, data return/deletion
- [ ] Vendor stability: ownership, funding, market position (diligence only)

## 2. Verification protocol (before any flag is enabled)

1. Complete `docs/provider-onboarding-checklist.md` sections 1–7.
2. Obtain **sandbox** credentials only; configure via `CLOUD_COMMS_*` env vars.
3. Set `CLOUD_COMMS_SANDBOX_MODE=true` — live paid operations stay blocked.
4. Fill in the vendor mapping points in
   `providers/communications/real/adapter.ts` (health probe, SMS, voice,
   webhook normalization) — nothing else in the app changes.
5. Run `npx tsx tests/prompt17-provider.test.ts` — all contract tests must pass.
6. Verify webhook signature verification + replay rejection against real
   vendor payloads (still sandbox, still no cost).
7. Only after sandbox verification: consider staging enablement with an
   explicit `FEATURE_CLOUD_COMMUNICATIONS_PROVIDER_ENABLED=true`, reviewed
   against the provider-mode guard.
8. Production enablement is a separate, explicit, logged decision.

## 3. Capability declaration discipline

After verification, set:

```
CLOUD_COMMS_CAPABILITIES=sms,voice        # example — ONLY verified capabilities
```

The adapter refuses any operation whose capability is not declared. Never
"temporarily" declare an unverified capability to make a demo work.

## 4. Cost safety rules (restated)

- Development tests NEVER send real SMS, place real calls or provision paid
  numbers.
- Sandbox/test mode first; live operations only when explicitly enabled.
- Never make a real paid provider call merely to prove the integration
  compiles — the contract tests prove that without any vendor call.

## 5. Outcome record (to be completed when a vendor IS chosen)

- Vendor: ________________
- Evaluation date: ________________
- Verified capabilities: ________________
- Sandbox verified by: ________________
- Staging enabled on: ________________ (flag value, environment, who approved)
- Production enabled on: ________________ (flag value, environment, who approved)
