# OneNumbr — Product Experience (Prompt 9, v1.0)

How OneNumbr turns a technically complete platform into a product a
non-technical person understands. The engine answers "what is true"; this
layer answers "what does it mean for me".

## Philosophy

- Do not just display state — explain the state.
- Do not just show options — help the user choose.
- Do not just show empty screens — explain what can be done next.
- Do not add complexity — remove it.
- Conversion comes from clarity and trust — never dark patterns (no fake
  urgency, scarcity, countdowns, or hidden costs).

## The three questions (answered in seconds on the dashboard)

1. **Who am I?** — OneNumbr ID hero + identity status.
2. **What do I have?** — State grid: Identity / Number / eSIM / Billing /
   Security, each with a human-language value and hint.
3. **What should I do next?** — the Next Best Action card: one dominant
   recommendation, not ten competing CTAs.

## Onboarding (`/onboarding`)

The existing profile → OneNumbr ID flow is preserved. After the ID is issued,
a 3-panel walkthrough (skippable, progress dots):

1. **Welcome** — "One identity. One number. Anywhere." explained in one line.
2. **Your identity** — the OneNumbr ID, and the key concept that it is
   permanent even if the number changes.
3. **Verification** — why it matters and what it unlocks.

The final panel offers three next steps (identity / number / eSIM) — none are
forced; every path is a real available workflow. Emits
`onboarding_started` / `onboarding_completed` product events (see analytics
extension point below).

## Progressive disclosure

The product unfolds with account state — new users never see advanced
surfaces first: verify → number → eSIM → "ready". Returning users see what
changed via notifications and the dashboard state grid.

# OneNumbr — UX State Model (`docs/ux-state-model.md` content)

## Journey states (`lib/product-state.ts → getAccountJourneyState`)

Derived **presentation-only** from `AccountSummary` (the authoritative source
stays the backend):

| State | Trigger | Meaning |
|---|---|---|
| `attention_required` | accountState ≠ active | account limited / deletion in progress |
| `verification_pending` | email unverified | verify email first |
| `verification_required` | KYC not verified, not submitted | start verification |
| `verification_in_progress` | KYC pending / resubmission / rejected | wait or fix |
| `number_required` | KYC verified, no number | choose a number |
| `connectivity_required` | number active, no eSIM | get an eSIM |
| `account_ready` | all set | informational |

## Next-best-action (`getNextBestAction`)

Deterministic if/else on the journey state — no AI, no scoring. Guarantees:

- every recommended action maps to a real route;
- informational states (review-in-progress, ready) render without pushing
  the user to act;
- billing issues are intentionally NOT surfaced as actions because the
  summary doesn't carry outstanding-invoice data — no fake "resolve billing"
  CTA.

## Human state explanations (`explainState`)

Every meaningful state answers: what happened / what it means / what happens
next. Mappings exist for `kyc`, `esim`, `number`, `payment`. No invented
processing times. Examples:

- KYC pending → "Your identity verification is being reviewed. Your documents
  have been submitted and are with our review team. You don't need to do
  anything right now — we'll notify you when it's complete."
- eSIM provisioning → "Your eSIM is being prepared. We're generating your
  activation details. Keep this page open or come back later."
- payment failed → "Your payment wasn't completed. You have not been charged.
  You can try again from checkout."

# OneNumbr — Product Copy Guide (`docs/product-copy.md` content)

## Voice

Clear · Confident · Human · Minimal · Trustworthy.

## Rules

1. Replace database language with human language:
   - ✗ "KYC status: under_review" → ✓ "Your identity verification is being
     reviewed."
   - ✗ "eSIM status: provisioning" → ✓ "Your eSIM is being prepared."
   - ✗ "Order status: payment_pending" → ✓ "Your payment is waiting to be
     completed."
   - ✗ "Number status: reserved" → ✓ "Your number is reserved for you."
2. Errors name the user's outcome, not the system's:
   - ✗ "HTTP 500 provisioning subsystem error" → ✓ "We couldn't activate your
     eSIM yet. Our team can help resolve this."
3. Money errors state the charge status explicitly:
   - payment failure → "You have not been charged."
   - paid-but-provisioning-failed → "Your payment has been recorded and you
     won't be charged again if you retry activation." (only when backend
     state supports it)
4. Terminology is fixed: **OneNumbr ID** (identity, permanent) vs
   **OneNumbr Number** (communications identity, replaceable) vs **eSIM**
   (connectivity). Never "phone ID", "account number", "SIM number".
5. CTA hierarchy: one primary per page ("Continue verification", "Choose a
   Number", "Explore eSIMs", "Contact support"), secondary quiet, destructive
   separated + confirmed.
6. Demo honesty: demo providers stay labeled ("Development catalog", "Demo
   environment", "Demo payment") — premium but honest. Never claim live
   telecom/PSTN/SMS/voice/2FA.

## Empty-state pattern

Empty states explain what will appear here and offer the next action:
"No transactions yet — after you buy an eSIM or a number, your payments and
receipts appear here, including refunds. [Explore eSIMs]".

## Contextual help (`HelpLink`)

Quiet "Learn more"-style links connect pages to existing Help Center
articles: number marketplace → "What is a OneNumbr Number?", eSIM
marketplace → "How do I activate an eSIM?", KYC wizard → "Why do I need
verification?". No duplicate articles are created.

## Analytics extension point (future — NOT built)

`lib/product-state.ts` exports `trackProductEvent` +
`registerProductEventSink`. Events (`onboarding_started`,
`kyc_submitted`, `number_purchased`, `esim_activated`, …) carry no personal
data. No third-party provider is integrated; a future sink registers in one
line and nothing else changes. Documented intentionally instead of building
unused infrastructure.

## Regression & testing additions (docs/testing.md content)

Added to the testing checklist: new-user journey (onboarding walkthrough →
guided next step), journey-state correctness for all seven states, NBA
correctness per state, empty-state copy on billing/eSIM/support/devices,
checkout error copy (no-charge reassurance), HelpLink targets resolve.
