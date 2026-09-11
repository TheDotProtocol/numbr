# OneNumbr — Telecom Regulatory Readiness (Prompt 15)

> **This document is a readiness checklist, not a compliance claim.**
>
> It lists areas that OneNumbr must review with the appropriate professional and
> regulatory counsel **before** making any telecom, PSTN, carrier, MNO/MVNO, SIM,
> eSIM, roaming, or numbering claims in a given market. Completion of this document
> does **not** mean OneNumbr is compliant in any jurisdiction. It means the topics
> have been identified and require review.

---

## Current state (be honest)

OneNumbr currently:

- is **not** a licensed telecom operator
- is **not** claiming to operate a global mobile network
- is **not** claiming current PSTN access
- is **not** claiming current MNO/MVNO infrastructure
- is **not** claiming GSMA accreditation or SM-DP+ operation
- is **not** claiming carrier agreements exist
- is **not** claiming emergency calling availability
- is **not** claiming number portability
- is **not** claiming live roaming

The current **+1739** identifier is an **application-level OneNumbr numbering
abstraction**. It is **not** represented as an officially assigned international
telecom country code, and it is **not** claimed to be currently PSTN-routable.

Any future real telecom capability must be reviewed and enabled only when the
relevant arrangements actually exist.

---

## 1. Numbering authority

**REQUIRES PROFESSIONAL / REGULATORY REVIEW.**

Before OneNumbr makes any numbering claim or routes any number on a real network:

- [ ] Identify the numbering authority/ies for each market
- [ ] Determine whether OneNumbr (or its provider partner) needs a number allocation, range, or block
- [ ] Determine how numbers are obtained, reserved, assigned, ported, and released
- [ ] Document numbering formats, length rules, and validation rules per market
- [ ] Determine portability rules and whether portability is supported
- [ ] Determine whether vanity/non-geographic/special numbers are involved
- [ ] Confirm that **+1739 is not treated as an officially assigned country code**
- [ ] Confirm any future numbering arrangement is legitimate and documented

Do not claim numbering allocation unless it actually exists.

---

## 2. Telecom licensing / authorization

**REQUIRES PROFESSIONAL / REGULATORY REVIEW.**

- [ ] Determine whether OneNumbr needs any telecom license, authorization, or registration
- [ ] Determine whether the provider partner holds required authorizations
- [ ] Determine market-by-market licensing requirements
- [ ] Determine whether reselling, aggregation, or MVNO activity triggers additional obligations
- [ ] Determine reporting, filing, or registration obligations
- [ ] Determine taxation/regulatory fee obligations where applicable

Do not imply OneNumbr is licensed where it is not.

---

## 3. PSTN access

**REQUIRES PROFESSIONAL / REGULATORY REVIEW.**

If PSTN connectivity is ever enabled:

- [ ] Identify how PSTN interconnect/access is obtained
- [ ] Confirm the carrier/provider relationship is legitimate
- [ ] Confirm voice routing arrangements
- [ ] Confirm SMS routing arrangements
- [ ] Confirm caller ID behavior and obligations
- [ ] Confirm number validation and normalization behavior
- [ ] Confirm geographic/regulatory routing restrictions
- [ ] Confirm fraud and abuse controls
- [ ] Confirm spam controls
- [ ] Confirm lawful/regulatory requirements that apply
- [ ] Confirm portability and port-in/port-out behavior where relevant

Do not claim PSTN availability without a legitimate arrangement.

---

## 4. Emergency calling

**REQUIRES PROFESSIONAL / REGULATORY REVIEW.**

If voice services are ever offered in a market:

- [ ] Determine emergency calling obligations in each market
- [ ] Determine whether emergency services routing is required
- [ ] Determine whether location/routing obligations apply
- [ ] Determine whether any special handling is required for emergency numbers
- [ ] Determine whether any consumer-safety disclosures are required

Do not claim emergency calling availability unless it is actually implemented and
legally supported.

---

## 5. Lawful intercept / regulatory access

**REQUIRES PROFESSIONAL / REGULATORY REVIEW.**

- [ ] Determine whether lawful intercept or regulatory access obligations apply
- [ ] Determine whether those obligations fall on OneNumbr, the provider, or both
- [ ] Determine data retention and access obligations where applicable
- [ ] Determine whether any disclosures are required

Do not claim lawful intercept capability or non-capability without review.

---

## 6. KYC / identity requirements

**REQUIRES PROFESSIONAL / REGULATORY REVIEW.**

OneNumbr already implements KYC/identity verification. For telecom services:

- [ ] Confirm whether provider-side identity/KYC is also required
- [ ] Confirm whether SIM/eSIM registration obligations apply
- [ ] Confirm whether number registration or assignment obligations apply
- [ ] Confirm whether age, residency, or other eligibility rules apply
- [ ] Confirm whether any documentation obligations apply
- [ ] Confirm data minimization and retention obligations for identity data

Do not rely on client-side KYC state. KYC is authoritative only server-side.

---

## 7. SIM / eSIM regulations

**REQUIRES PROFESSIONAL / REGULATORY REVIEW.**

If SIM or eSIM connectivity is ever provided:

- [ ] Determine SIM registration/identification obligations
- [ ] Determine eSIM profile provisioning regulation
- [ ] Determine whether SM-DP+ operation or participation is involved
- [ ] Determine whether GSMA-related standards are relevant (do not claim GSMA accreditation unless it exists)
- [ ] Determine device compatibility and provisioning obligations
- [ ] Determine profile lifecycle, deletion, and replacement obligations
- [ ] Determine roaming regulation where applicable

Do not claim production eSIM provisioning or SM-DP+ operation unless it exists.

---

## 8. Data protection / privacy

**REQUIRES PROFESSIONAL / REGULATORY REVIEW.**

- [ ] Identify applicable data protection regimes
- [ ] Determine lawful bases for processing
- [ ] Determine special-category data handling (if any)
- [ ] Determine retention obligations for communications metadata
- [ ] Determine retention obligations for identity data
- [ ] Determine cross-border transfer obligations
- [ ] Determine provider data-processing terms
- [ ] Determine customer notice/consent obligations
- [ ] Determine security obligations
- [ ] Determine breach notification obligations

Do not treat provider logs as an uncontrolled PII store.

---

## 9. Cross-border communications

**REQUIRES PROFESSIONAL / REGULATORY REVIEW.**

- [ ] Identify obligations that apply when communications cross borders
- [ ] Determine data localization requirements where they exist
- [ ] Determine routing restrictions where they exist
- [ ] Determine taxation or regulatory fee implications
- [ ] Determine consumer-protection obligations in each market

Do not claim global coverage where it is not supported.

---

## 10. SMS regulation

**REQUIRES PROFESSIONAL / REGULATORY REVIEW.**

If SMS is ever offered:

- [ ] Determine SMS regulation per market
- [ ] Determine consent/authorization requirements
- [ ] Determine content/restriction rules where they exist
- [ ] Determine sender ID rules
- [ ] Determine spam/abuse obligations
- [ ] Determine emergency/official message handling where relevant

Do not claim live SMS without a real provider and proper controls.

---

## 11. Anti-fraud / abuse controls

**REQUIRES PROFESSIONAL / REGULATORY REVIEW.**

- [ ] Determine fraud obligations that apply to the service
- [ ] Determine abuse-reporting obligations
- [ ] Determine spam-control obligations
- [ ] Determine toll-fraud exposure and controls
- [ ] Determine number-abuse and spoofing obligations where relevant
- [ ] Determine whether any monitoring or reporting is required

---

## 12. Number portability

**REQUIRES PROFESSIONAL / REGULATORY REVIEW.**

If number portability is ever offered:

- [ ] Determine portability rules and process
- [ ] Determine port-in/port-out obligations
- [ ] Determine timing, validation, and failure handling
- [ ] Determine customer-facing porting disclosures
- [ ] Determine whether portability interacts with KYC or billing state
- [ ] Determine whether portability affects the OneNumbr identity/number model

Remember the architectural rule: **portability changes provider/routing, not the
OneNumbr identity or number itself** — but only if the underlying arrangements
actually support that.

---

## 13. Country-specific requirements

**REQUIRES PROFESSIONAL / REGULATORY REVIEW.**

OneNumbr must not assume a single global rule set. For each market OneNumbr
intends to operate in:

- [ ] Identify the applicable regulator(s)
- [ ] Identify licensing/authorization requirements
- [ ] Identify numbering requirements
- [ ] Identify consumer-protection requirements
- [ ] Identify data protection requirements
- [ ] Identify emergency-calling requirements
- [ ] Identify SIM/eSIM requirements
- [ ] Identify SMS/voice regulation
- [ ] Identify tax/regulatory fee obligations
- [ ] Identify any market-specific prohibitions or restrictions

Do not represent OneNumbr as operating in a country unless the relevant arrangements
actually exist there.

---

## 14. Provider-side obligations

**REQUIRES PROFESSIONAL / REGULATORY REVIEW.**

When OneNumbr integrates a real provider:

- [ ] Confirm which party holds which regulatory obligation
- [ ] Confirm provider authorization status
- [ ] Confirm provider number inventory/source legitimacy
- [ ] Confirm provider porting capability where relevant
- [ ] Confirm provider emergency-calling behavior where relevant
- [ ] Confirm provider lawful-intercept/data-retention obligations where relevant
- [ ] Confirm provider data-processing terms
- [ ] Confirm provider incident-response obligations
- [ ] Confirm provider termination/exit obligations

Do not assume the provider relieves OneNumbr of obligations that apply to OneNumbr
directly.

---

## 15. Claims control

OneNumbr must not make the following claims unless they are actually true and
verified:

- [ ] Carrier agreement exists
- [ ] Numbering allocation exists
- [ ] PSTN authorization exists
- [ ] MNO/MVNO agreement exists
- [ ] Global roaming exists
- [ ] Live cellular coverage exists
- [ ] Live eSIM provisioning exists
- [ ] Live voice exists
- [ ] Live SMS exists
- [ ] Live emergency calling exists
- [ ] Live number portability exists
- [ ] Regulatory approval exists
- [ ] GSMA accreditation exists
- [ ] +1739 is an officially assigned country code

If a claim cannot be verified, either do not make it, or label it clearly as future/
planned/in-development/concept where that is truthful.

---

## 16. Readiness statement

**Current OneNumbr regulatory posture:**

This platform includes the **architecture and readiness** to integrate with real
telecom/connectivity providers in the future. It does **not** currently implement or
claim live telecom, carrier, MNO, MVNO, PSTN, eSIM, SIM, roaming, or numbering
allocation capability.

Before any such capability is enabled in a market:

1. Complete the **Provider Onboarding Checklist**.
2. Complete the relevant items in **this** regulatory readiness checklist.
3. Obtain professional/regulatory review for the target market(s).
4. Enable the corresponding provider only through the appropriate feature flag and
   only after the provider-mode guard allows it in the target environment.
5. Update documentation to reflect only what actually exists.

---

*This document is for internal readiness and planning. It is not legal advice and
does not conclude any regulatory determination.*
