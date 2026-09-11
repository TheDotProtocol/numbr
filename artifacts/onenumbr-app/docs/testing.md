# OneNumbr — Testing Guide (Foundation v1.0)

## Prerequisites

Real Firebase features require credentials — see `docs/firebase-setup.md`
steps 1–7. Quick checklist:

```bash
cp .env.example .env.local   # then fill in the NEXT_PUBLIC_FIREBASE_* values
pnpm install                 # from the repo root (pnpm workspace)
```

## Run the app

```bash
pnpm --filter @workspace/onenumbr-app dev
# → http://localhost:3100
```

## Full acceptance walkthrough (Prompt 1)

1. **Sign up** — `/signup` → name + email + password + confirm. You land on
   `/verify-email`; Firebase sends a verification mail.
2. **Verify** — click the email link, then press "I've verified — continue"
   on the gate page.
3. **Onboard** — `/onboarding`: fill profile (country selector, auto
   timezone) → submit. The server allocates your OneNumbr ID
   (`ON-XXXXXX`) and the welcome screen shows it prominently.
4. **Dashboard** — `/app` shows the ID hero, account/verification/number/
   eSIM/device status cards and next-step actions.
5. **Section pages** — visit Identity, Number, eSIM, Devices, Billing,
   Security, Settings. Devices shows your current browser as "This device".
6. **Settings** — change name/country/phone/timezone → save → toast.
7. **Security** — change password; resend verification (if unverified).
8. **Log out** (user menu) → **log in** again → session persists across
   refreshes (browserLocalPersistence).
9. **Password reset** — `/reset-password` → email arrives → follow link.
10. **Admin** — run the set-admin script (setup guide step 7), sign out/in,
    then visit `/admin`: overview stats, users table, user detail,
    suspend/reactivate, role change, audit logs. All admin API calls are
    claim-protected; a normal user hitting `/admin` sees "Access denied".

## Negative tests (security)

- Two accounts: each sees only its own `users`, `profiles`, `onenumbr_ids`,
  `devices` documents (enforced by rules — cross-account reads fail with
  `permission-denied`).
- Attempting to write `role` or `status` from a client SDK console fails
  (rules `hasOnly` field checks).
- Attempting to write `onenumbr_ids/{uid}` from the client fails (rules
  deny all client writes).
- Non-admin calling any `/api/admin/*` route receives 403.
- Suspended account: after suspension, the app shows the suspended screen
  on next visit (guard) and Firestore reads still require valid auth.

## Firebase Emulator Suite (optional, no production data)

```bash
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true pnpm --filter @workspace/onenumbr-app dev
firebase emulators:start   # from artifacts/onenumbr-app
```

Auth (9099), Firestore (8080) and Storage (9199) then run locally with
seeded/ephemeral data.

## Typecheck & build

```bash
pnpm --filter @workspace/onenumbr-app typecheck
pnpm --filter @workspace/onenumbr-app build
```

## eSIM flow (Prompt 3)

1. Seed the demo catalog:
   `npx tsx scripts/seed-esim-plans.ts` (service account key via
   `FIREBASE_SERVICE_ACCOUNT_KEY`).
2. Sign in → `/app/esim` → search "Japan" → open a plan → Buy eSIM →
   Complete Purchase (demo payment).
3. Expect: activation page with QR ("DEMO eSIM" marker), notification,
   dashboard eSIM card populated, order in `/app/esim/orders`, eSIM in
   `/app/esim/active`.
4. Duplicate test: click Complete Purchase twice quickly — only one order
   is created (idempotency key); the second response returns the same order.
5. Failure test: in the admin console activate the "Provisioning Failure
   Test" sandbox plan, purchase it — the order must show failed honestly,
   then use Admin → eSIM → Orders → Retry; the retry succeeds (mock recovers
   unless the plan id contains "fail").
6. Admin: `/admin/esim` → create/edit/deactivate a plan; customer marketplace
   reflects the change within the 60s catalog cache (or force-reload).

## Number flow (Prompt 4)

1. Seed inventory: `npx tsx scripts/seed-numbers.ts` (service account key via
   `FIREBASE_SERVICE_ACCOUNT_KEY`).
2. **KYC gate:** as an unverified user open `/app/number` — the lock state
   with "Complete verification" must appear; a Choose-number attempt must
   fail with `kyc_required` (verify via devtools or an unverified account).
   Complete KYC (Prompt 2 flow) to unlock.
3. **Happy path:** verified user → `/app/number` → search "284" → Choose
   number → checkout shows the reserved number → Complete Purchase →
   redirected to the number detail with ACTIVE status, dashboard Number
   card shows the number, notification received.
4. **Reservation:** while a number is reserved by user A, user B must not
   see/choose it; abandoning checkout releases the hold after 15 min.
5. **Idempotency:** double-click Complete Purchase — one order only.
6. **Failure:** admin activates nothing special — choose the
   `+1739 000FAIL` sandbox number; the order must show failed honestly
   (payment recorded), then Admin → Numbers → Orders → Retry succeeds.
7. **Release:** number detail → Release number → confirm → status released,
   assignment history preserved in Admin → Assignments, dashboard reverts
   to "Not activated", OneNumbr ID unchanged.
8. **Security:** cross-user number detail fetch → 403; client-side status/
   price/ownership writes impossible (rules deny all client writes).

## Billing flow (Prompt 5)

1. **Integrated purchases:** buy an eSIM (Prompt 3 flow) and a number
   (Prompt 4 flow, KYC-verified account) — each must produce a payment + a
   paid invoice (INV-YYYY-######) visible in `/app/billing` → Transactions
   and Invoices, plus billing notifications.
2. **Idempotency:** double-click Complete Purchase in either checkout —
   exactly one payment/invoice exists; retries resolve to the original.
3. **Payment failure trigger:** the MockPaymentProvider fails any intent
   whose id contains "FAIL". Deterministic test recipe: temporarily rename
   a plan's name in Admin → eSIM → Plans to include "Fail" is NOT the
   trigger — the checkout `description` flows into the intent only via the
   orderRef; instead use the seeded "Provisioning Failure Test" plan path
   or add a dev-only route override. Payment-failure UX: order shows failed,
   nothing is provisioned, no invoice is issued, user sees "Payment
   unsuccessful — try again".
4. **Refund:** Admin → Billing → Payments → Refund on a paid payment →
   confirm (full) or partial with amount + reason → payment becomes
   refunded/partially_refunded, invoice updates, `payment.refunded` event,
   user notification. Refund amount validation: attempt an amount larger
   than the refundable balance → server rejects (400).
5. **Invoice view:** open an invoice → print-friendly document (browser
   print → Save as PDF) with line item, subtotal/tax/total, invoice number.
6. **Subscriptions:** pause/cancel/resume from user Billing and
   Admin → Billing → Subscriptions (mock model; no real recurring charge).
7. **Security:** cross-user payment/invoice fetch → 403/404; client-side
   financial writes impossible (rules deny all client writes).

## Account & security flow (Prompt 6)

1. **Session registration:** sign in → `POST /api/account/register` stores a
   session + device row; /app/account → Sessions lists it marked **This
   device**. Open the app in a second browser → two sessions, current one
   flagged. Location shows "Location unavailable" (honest, no IP geolocation).
2. **Revoke:** revoke the other session → its page dies on next navigation,
   notification `security.session_revoked` fires, activity timeline records
   it. "Sign out other sessions" revokes all non-current ones at once.
3. **Devices:** /app/devices lists this device; rename persists; revoke
   sessions removes its sessions; devices with active sessions cannot be
   deleted.
4. **Password change:** /app/security → change password (Firebase
   reauthentication enforced) → success toast, `lastPasswordChangeAt`
   stamped, "Password changed" activity + notification. Wrong current
   password → Firebase error surfaced safely.
5. **2FA:** Security Center shows "Two-factor authentication isn't available
   yet" — never an enabled toggle.
6. **Preferences:** /app/account/notifications → toggles persist; the
   Security category cannot be switched off (server rejects). /app/account/privacy
   → product/marketing/analytics toggles persist and map to real stored flags.
7. **Lifecycle:** /app/account → deactivate (confirm modal) → dashboard shows
   deactivated state; reactivate works. Deletion request → state
   `deletion_requested`, confirmation copy states financial/KYC records are
   retained for compliance — no hard delete.
8. **Activity:** /app/account/activity shows the security timeline
   (signed in, session revoked, password changed, settings updated) newest
   first, with device context when available.
9. **Admin support view:** Admin → Users → detail page shows Account support
   card (KYC state, active numbers/eSIMs, account state, 2FA state, active
   sessions) — no credentials or payment data exposed. Non-admin calls to
   `/api/admin/users/[uid]` → 403.
10. **Security negative tests:** post to `/api/account/sessions/revoke` with
    another user's sessionId → 404/403; patch another user's device → 404;
    client-side write to `sessions`/`account_security` docs → rules deny;
    forged uid in any body → ignored (identity comes from the verified
    session cookie).
11. **Prompt 1–5 regression:** dashboard cards still render live data,
    eSIM/number/billing flows unchanged, KYC gate still locks number
    activation, admin console intact.

## Support & operations flow (Prompt 7)

1. **Customer case:** /app/support → New case → pick category, subject,
   description → submit → redirected to the case page with the opening
   message and `SUP-YYYY-######` number. Notification "Support case received"
   appears.
2. **Conversation:** reply as the customer; upload a PNG/PDF attachment
   (≤10 MB) and re-open it via the signed URL. Exceeding the size limit or an
   unsupported type is rejected client- and server-side.
3. **Internal-note isolation:** as staff, open the same case from
   /admin/support → add an internal note. Sign back in as the customer — the
   note is absent from every customer payload (API returns messages only;
   rules deny the subcollection outright).
4. **Ownership:** customer B requesting customer A's ticket via
   `/api/support/[ticketId]` → 403/404. Forged uid in any body → ignored.
5. **Staff workflow:** assign/reassign/unassign, change status and priority,
   reply with "waiting for customer" — each shows a toast, fires the matching
   notification to the customer and writes an audit entry.
6. **Close/reopen:** staff resolves → customer sees notification and can
   close; customer reopens a closed case → status `open` + notification.
7. **Admin authorization:** a plain `user` (or `support`) calling an
   admin-only financial route is still rejected; `support` role passes
   `requireStaff` on support/operations routes only.
8. **Help Center:** /app/help sections render; search "invoice", "eSIM",
   "sessions" returns the matching articles; the demo-environment notes appear
   where capabilities are mock. Service status shows demo-provider labels
   honestly (no fabricated outages).
9. **Operations:** /admin/operations lists alert cards derived from live
   state (open cases, KYC backlog, failures). Create a failed eSIM order via
   the seeded failure-test plan → it appears in the failure worklist and the
   alert count; Retry from the eSIM console clears it. KYC submissions raise
   the backlog alert.
10. **Customer 360:** /admin/users/[uid] shows number/eSIM/billing/security/
    support sections plus the unified activity timeline (KYC approved, number
    assigned, payment succeeded, case opened, …). No credentials or card data
    anywhere.
11. **Regression:** dashboard, identity/KYC, number, eSIM, billing, account,
    security and sessions flows all still function (see sections above).

## Product experience flow (Prompt 9)

1. **New user:** sign up → verify email → onboarding (profile → ID issued →
   3-panel walkthrough with Skip) → dashboard shows the Next Best Action
   "Verify your identity".
2. **Journey states:** as account state changes (verify email → submit KYC →
   approved → buy number → buy eSIM) the dashboard NBA updates in order:
   verification → review (informational) → choose number → explore eSIMs →
   "Your OneNumbr is ready". Exactly one dominant CTA is shown.
3. **State explanations:** KYC under review shows "being reviewed / no action
   needed"; provisioning eSIM shows "being prepared"; failed payment shows
   "You have not been charged"; paid-but-failed provisioning keeps the
   "payment recorded, retry won't re-charge" promise (backend-verified).
4. **Empty states:** billing transactions/invoices, eSIM active list, support
   cases, devices — each explains what will appear and offers the next step.
5. **HelpLinks:** number page, eSIM hero and KYC wizard links open the
   matching Help Center articles (no dead slugs).
6. **Onboarding walkthrough:** Skip works; Back/Continue navigate 3 panels;
   final panel lists the three next steps; "Get started" lands on /app.

## Console-error check

Open devtools on every page — the suite is expected to be clean. When
Firebase env vars are placeholders, the app intentionally logs a single
configuration warning instead of crashing.

## Production readiness (Prompt 10)

1. **Health:** `GET /api/health` returns `{status:"ok"}`, the environment
   name, maintenance flag and provider classes; `/api/health/firebase`
   returns firestore+auth ok; `/api/health/providers` lists providers with
   `(demo)` markers and no internal identifiers.
2. **Rate limiting:** with a test user, fire 6 rapid support-ticket creations
   → 5 succeed, the 6th returns the calm cooldown error (`too many attempts`).
   Same pattern on checkout (10/h), KYC submit (5/h), number reserve (20/h),
   support replies (30/h), session registration (60/h). Admin mutations
   (120/min) stay comfortably under normal operator use.
3. **Security headers:** every response carries CSP, `X-Content-Type-Options`,
   `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP;
   production builds add HSTS. Firebase auth flows confirmed permitted by the
   CSP (login/verification flows exercised in staging).
4. **Maintenance mode:** with `FEATURE_MAINTENANCE_MODE=true`, customer
   routes 307 to `/maintenance`; `/admin`, `/api/health*` and staff sessions
   bypass; the screen renders with no console errors.
5. **Body-size guard:** an oversized JSON POST (>1 MB) to any API returns 413
   with no server error logged.
6. **Unified errors:** any forced server error returns
   `{error:{message,code,requestId,timestamp}}`; the `requestId` matches the
   id in the JSON server log line; stack traces never appear client-side.
7. **Logger redaction:** a deliberate `logger.info("t", {password, token,
   signedUrl, kycPath})` in a scratch route logs `[redacted]` for the secret
   keys and collection-root-only for KYC paths. (Scratch route removed after
   verification.)
8. **Provider guard:** `ONENUMBR_ENV=development` + a real-provider flag →
   boot refusal; `ONENUMBR_ENV=production` + mock flags without the explicit
   acknowledgement env → boot refusal. Verified in isolation (node script).
9. **Ownership regression (spot):** cross-user payment/invoice/ticket reads
   still 403; cross-user session/device mutations still 403; internal notes
   still absent from every customer response.
10. **Middleware auth guard:** session-cookie check unchanged — protected
    routes redirect unauthenticated users; note `__session` was removed from
    the matcher (nothing writes it) and login still works end-to-end.


## Cloud telephony / communications (Prompt 11)

1. **Identity permanence:** `getOneNumbrId` reads `onenumbr_ids/{uid}` directly —
   releasing/replacing a number never touches the OneNumbr ID
   (`getOwnedNumberView` projects assignment state separately).
2. **Primary number ownership:** `getOwnedNumberView` resolves only the
   caller's active assignments; a numberId belonging to another user returns
   `permission-denied`. No active assignment → honest `not-found` (page shows
   the "Choose your OneNumbr Number first" empty state).
3. **Mock call lifecycle:** initiate → `MOCK-CALL-XXXX`, status machine
   initiated → answered → ended with duration computed server-side; ending a
   second time is rejected; cross-user call update → `permission-denied`.
4. **Mock message lifecycle:** send → delivered instantly with `MOCK-MSG-XXXX`;
   `mark_read` sets readAt; `Fail…` targets deterministically fail (provider
   test path). Inbound simulation is clearly labeled "(simulation)" in the
   notification.
5. **Voicemail lifecycle:** simulate → new + notification; mark_read → read +
   provider ack. Transcripts only — no audio.
6. **Endpoint ownership:** add/list/update endpoints is uid-scoped;
   `sip`/`pstn` kinds are rejected while the PSTN boundary is disabled.
7. **Routing ownership:** PUT validates steps, forces voicemail as terminal
   fallback, requires an endpoint for `forward`, persists per-uid.
8. **Feature flags:** `pstnEnabled`/`tauCoreIntegrationEnabled` default false;
   disabled communications domains return 503 with a calm message; UI never
   shows them as active.
9. **Provider-mode guard:** mock communications provider is unmistakably demo
   (`MOCK-*` refs, "demo" labels); no real PSTN/carrier/SMS paths exist.
10. **Rate limiting:** comm_call 30/h, comm_message 60/h, comm_routing and
    comm_endpoint 20/h — cooldown errors render the standard calm message.
11. **Audit:** communications.* actions appear in audit_logs with no message
    bodies; notifications use the new communications.* kinds.
12. **Regression:** number engine, billing, eSIM, KYC, auth/session flows
    untouched — existing routes/pages operate exactly as before (nav label
    only changed for the eSIM marketplace → "Connectivity").

## Endpoint layer (Prompt 12)

All endpoint API tests are run authenticated; unauthenticated requests receive
401; cross-user requests receive 403/404.

1. **Number immutability (core promise):** register Web → TauPhone → TauTalk
   endpoints, revoke TauPhone, re-register TauPhone. Assert `onenumbr_ids` and
   the active `number_assignments` record are byte-identical before/after every
   step. The endpoint engine has no code path that writes those collections.
2. **Multi-endpoint demo:** all three endpoints resolve to the same uid,
   OneNumbr ID and primary number; the Communications page shows them as one
   identity reached from three places.
3. **Isolation:** user B's GET detail, revoke, activate and set-primary against
   user A's endpoint all fail (403/404); no information leaks in errors.
4. **Lifecycle:** register → active; suspend → activate → active; revoke →
   terminal (reactivation rejected with a calm message); the record is
   preserved for history; revoked endpoints are excluded from routing.
5. **Primary endpoint:** setting a new primary atomically unsets the previous
   one; a single-user transaction; audit `communications.endpoint_primary_changed`.
6. **Routing simulation:** deterministic primary → other active → voicemail
   trace; suspended/revoked endpoints skipped; identical inputs → identical
   decisions.
7. **TauPhone/TauTalk mocks:** both register successfully with `MOCK-*`
   provider references and `availability: "demo"`; zero network operations; UI
   labels them "Demo endpoint".
8. **Future types rejected:** `sip`/`pstn`/`sim` registration → 400 with calm
   message; never shown as available in UI or health.
9. **Rate limiting:** endpoint-register 20/h, revoke/activate 30/h,
   routing-update 60/h — cooldown errors render the standard calm message.
10. **Audit & notifications:** `communications.endpoint_*` audit actions
    (no secrets/tokens in payloads); registration and revocation create the
    new `communications.*` notification kinds; presence changes create none.
11. **Customer 360:** endpoints + communications metadata sections render for
    staff; message bodies and call participants are not projected.
12. **Regression:** communications (Prompt 11), number, billing, eSIM, KYC,
    support and session flows unchanged; health reports endpoints/tauPhone/
    tauTalk honestly (`demo`), pstn `disabled`.

## Global Plan & entitlements (Prompt 13)

All plan API tests run authenticated; unauthenticated requests receive 401;
cross-user access receives 403/404.

1. **Plan resolution:** a user with an active number-sourced subscription
   resolves `plan.status = "active"` with all v1 entitlements; voice/messaging
   show `demo` availability, PSTN/SIM/TauCore `coming_soon` and never entitled.
2. **Plan version preservation:** the subscription retains `planVersion`
   (`ONE_GLOBAL_V1`) and its `planSnapshot` economics; released catalog
   versions are immutable by convention.
3. **Legacy bridge:** a pre-catalog user with an active number but no
   subscription resolves the plan as active with null price/period — no lost
   access, no invented economics.
4. **Subscription linkage:** `provisionNumberOrder` creates exactly one plan
   subscription via `createSubscription` (duplicate-guarded); failure is
   non-fatal and audited (`billing.plan_assigned` with warning).
5. **Entitlement gates:** voice/message initiation and endpoint registration
   require their entitlements; a plan-less user (no number, no subscription)
   receives the clean product error, never provider internals.
6. **Client authority:** the plan API accepts no price/plan/entitlement
   fields; POST is status-only reactivation (paused/cancelled → active),
   404 without a plan, 400 when active/expired/failed, rate-limited
   `plan_reactivate` 10/h.
7. **Number retention:** pausing/cancelling the plan leaves
   `number_assignments` and `onenumbr_ids` byte-identical; reactivation
   creates neither a new ID nor a number.
8. **Account gate:** deactivated / deletion-requested accounts resolve zero
   entitled entitlements.
9. **Audit & notifications:** `billing.plan_assigned`,
   `billing.subscription_suspended` audited; suspended/reactivation
   notifications include the "your number and identity are unchanged" promise;
   no credentials in any payload.
10. **Flags:** `globalPlanEnabled`/`entitlementsEnabled` respected; PSTN,
    physical SIM and TauCore remain disabled everywhere.
11. **Customer 360 / admin billing:** plan section (status, version, snapshot
    price, demo provider) and the subscriptions Version column render.
12. **Regression:** billing (Prompt 5), number engine (Prompt 4),
    communications/endpoints (11–12), KYC gate, sessions, support — all
    unchanged; health reports `globalPlan`/`entitlements` honestly.

## Connectivity service layer (Prompt 14)

All connectivity API tests run authenticated; unauthenticated requests receive
401; cross-user access receives 403/404.

1. **Resolution:** `resolveConnectivity` returns the honest overview —
   entitlement state, current connection, mechanism availability
   (cloud available, esim demo, mno/mvno/physical_sim/pstn/sip coming_soon),
   provider label with demo marker, identity labels.
2. **Entitlement gate:** connection request/activate/suspend/terminate require
   `connectivity.global`; plan-less users receive the clean product error.
3. **Server-side provider selection:** the API accepts a mechanism at most
   (`cloud|esim`) and never a provider id; unknown mechanisms are rejected.
4. **Lifecycle:** requested → provisioning → active (demo cloud); suspend →
   resume → terminate; invalid transitions rejected with calm errors.
5. **Single live connection:** a second request while one is
   active/provisioning/suspended fails with `already-exists`.
6. **Number/identity immutability (the abstraction proof):** across
   mechanism changes (esim → cloud → future MNO → future SIM simulations),
   `onenumbr_ids`, `number_assignments` and the plan subscription remain
   byte-identical — the connectivity engine writes only
   `connectivity_connections`.
7. **eSIM regression:** catalog, checkout, activation, orders and admin eSIM
   tools unchanged; the eSIM adapter wraps — never replaces — the engine.
8. **Rules:** `connectivity_connections` allows owner-scoped reads and no
   client writes.
9. **Rate limits:** `connectivity_provision` 5/h, `connectivity_lifecycle`
   20/h — cooldown errors render the calm message.
10. **Audit & notifications:** `connectivity.*` audit actions with no secrets;
    setup/ready/suspended notifications only — no noisy state churn.
11. **Health/status honesty:** health reports cloud `demo`, esim `demo`,
    mno/mvno `disabled`, physicalSim/sip `future`, pstn `disabled`;
    service status lists Connectivity as demo.
12. **Regression:** Prompts 1–13 flows unchanged; nav "Connectivity" points to
    /app/connectivity; /app/esim remains fully functional with reframed copy.

## Provider readiness (Prompt 15)

All provider-readiness artifacts are architecture/contract/test-foundation only —
no real provider is integrated or claimed.

1. **Capability model & classification:** providers declare explicit capability
   sets and a category; the same capability is not inferred from the provider
   name; future MNO/MVNO/eSIM/physical_sim/SIP/PSTN boundaries are typed and
   documented but disabled.
2. **Registry read-only surface:** `listProviderMetadata()` returns provider
   descriptions; no secrets/credentials appear in the registry data, in health
   output, in Customer 360 or in the admin provider console.
3. **Server-side selection:** `selectProvider()` returns a provider based on
   interface/capability/region — never a client-chosen provider id.
4. **Webhook boundary:** `POST /api/webhooks/[provider]` returns 503 with an
   honest explanation; the webhook verification/normalization/idempotency
   helpers in `lib/webhooks-server.ts` are testable without a live provider.
5. **Error normalization:** the provider error mapper returns OneNumbr domain
   error codes + categories from provider error strings; raw provider messages
   are not surfaced.
6. **Provider-mode guard:** `describeProviderMode()` reproduces the Prompt 10
   behaviour (production + mock blocked unless acknowledged; real-provider flags
   refused in development) for admin/ops display.
7. **Provider-mode regression:** real-provider flags still refuse dev boots and
   mock providers still refuse production boots without the explicit
   acknowledgement env.
8. **Reference provider:** `providers/test/reference.ts` exposes a deterministic
   `createReferenceConnectivityProvider()` and contract helpers
   (`assertProviderContractSatisfied`, happy-path/failure/timeout/duplicate/
   invalid-input variants) so every future provider adapter can be run through
   the same contract checklist.
9. **Provider immutability invariants:** server-side provider changes never touch
   `onenumbr_ids`, `number_assignments`, `subscriptions` or any identity/number/
   plan collection — the provider-readiness registry is a read-only description
   layer.
10. **Regression:** Prompts 1–14 flows unchanged; health/reporting now includes
    the safe provider-readiness summary when `providerHealthReportingEnabled` is
    on; admin provider console and Customer 360 provider-readiness sections
    render; /app/esim, /app/connectivity, billing/plan, endpoints and
    communications remain intact.

## Trust & safety / spam-abuse-automation readiness (Prompt 16)

All trust-and-safety artifacts are architecture + readiness only — no live spam
filter, reputation engine, anti-automation challenge provider or inbound abuse
pipeline exists.

1. **Layer placement:** trust and safety is a replaceable infrastructure layer
   under OneNumbr identity/number/plan/communications/endpoints; the registry is
   read-only and contains no credentials or raw risk signals.
2. **Capability model:** trust-and-safety providers declare explicit capabilities
   and interfaces; capabilities are not inferred from provider names.
3. **Registry + health:** `listTrustAndSafetyProviders()` returns provider
   descriptions; health exposes the honest current-protection model and the
   per-capability on/off state — never live spam/abuse/automation claims.
4. **Server-side selection:** `selectTrustAndSafetyProviderFor()` returns a
   provider based on interface/capability/region — never a client-chosen provider.
5. **Inbound/outbound/anti-automation boundaries:** `classifyInboundItem`,
   `guardOutboundItem`, `evaluateAntiAutomation`, `ingestAbuseReport` are
   non-operational today and return explicit "not implemented"/fallback results.
6. **Abuse report ingestion:** `ingestAbuseReport` records an internal audit
   breadcrumb even without a provider, so the future abuse pipeline has a hook to
   grow into.
7. **Reference provider:** `providers/trust-and-safety/reference.ts` provides
   deterministic reference providers and contract-assertion helpers
   (`assertInboundClassifierContractSatisfied`,
   `assertOutboundGuardContractSatisfied`, `assertAntiAutomationContractSatisfied`)
   for future provider adapters.
8. **Immutability:** trust-and-safety operations never write
   `onenumbr_ids`, `number_assignments`, `subscriptions` or any identity/number/
   plan collection.
9. **Feature flags:** trust-and-safety real-provider flags are all off by default;
   the layer surface is present, but live spam/abuse/automation behavior requires
   explicit flags and the Prompt 10 guard.
10. **Regression:** Prompts 1–15 flows unchanged; health trusts-and-safety block
    renders; admin trust-and-safety console renders; no live spam/abuse/automation
    capability is claimed.
