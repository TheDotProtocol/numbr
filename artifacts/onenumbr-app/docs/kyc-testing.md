# OneNumbr — KYC Testing Guide (Manual Identity Verification v1.0)

Prerequisites: complete the Prompt 1 setup (`docs/firebase-setup.md`), then
deploy the updated rules:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## User workflow

1. **Start** — `/app/identity` → the verification card shows "Not started" →
   **Start Verification** → wizard at `/app/identity/verification/start`.
2. **Step 1 — Personal info** — confirms profile name/email/country (read-only,
   from the profile).
3. **Step 2 — Document** — pick Passport / National ID / Driving Licence.
   Back side uploads appear only for ID card and licence. Enter issuing
   country (independent from account country) + document number. Upload
   front/back/selfie — progress bar, preview, Replace/Remove/Retry all work.
   Files >5 MB or wrong types are rejected with friendly messages.
4. **Step 3 — Review** — shows personal info, document details and previews.
   **Submit verification** → loading state, double-submit protected.
5. **Status page** — `/app/identity/verification` shows the timeline
   (Information submitted → Documents received → Manual review → Verification
   complete) and the "under review" copy. The page live-updates via a single
   Firestore doc listener — no manual refresh needed.
6. **Dashboard** — the Identity card now shows the KYC state
   (Not verified / Under review / Verified / Rejected / Action required).
7. **Approved** — status page shows "Identity verified" with the verified
   date; dashboard shows "Identity verified"; a notification arrives in the
   topbar bell.
8. **Rejected / resubmission** — status page and Identity card show the
   user-facing reason with "Submit again" / "Resubmit". Resubmitting returns
   the case to SUBMITTED, increments the attempt counter, and preserves the
   previous round in the review history.

## Admin workflow

1. As admin, open `/admin/kyc` — the KYC nav item is now active.
2. Queue tabs: Pending, Under Review, Approved, Rejected, Resubmission.
   Search by email/OneNumbr ID; pagination via Load more.
3. **Review** opens the workstation: applicant panel (left), secure document
   viewer with zoom/fit/rotate + "Open larger" (center), decision panel and
   review history (right).
4. Opening a `submitted` case automatically moves it to `under_review`
   (audit + history written).
5. **Approve / Reject / Request resubmission** — each opens a confirmation
   modal. Rejection and resubmission require choosing a reason (the user sees
   the reason's friendly copy); the internal note stays private.
6. After a decision: the case moves tabs, the user's status page updates in
   realtime, a notification is created, and an audit log + history entry are
   written.
7. Verify audit entries in `/admin/logs`
   (`kyc.submitted`, `kyc.review_started`, `kyc.approved`, …).

## Security negative tests (all must fail)

- **Client status change** — from a signed-in browser console:

  ```js
  // must be rejected by rules (review fields are server-only)
  firebase.firestore().doc('kyc/MY_UID')
    .update({ status: 'approved', reviewedAt: new Date() })
  ```

- **Draft field allowlist** — updating `kyc/{uid}` after submission (e.g.
  swapping `documentFrontPath`) must fail (rules allow edits only while
  `status == 'draft'`).
- **Cross-user KYC read** — `doc('kyc/OTHER_UID').get()` → permission-denied.
- **Cross-user document read** — loading another user's Storage file via the
  download URL from a different account → 403 from Storage.
- **Client admin escalation** — `setCustomUserClaims` cannot be called from a
  client; `/api/kyc/admin/*` returns 403 without the admin claim (try with
  curl while logged in as a normal user).
- **Duplicate submission** — submitting while `status == submitted` returns
  409 `conflict`.

## Free-tier notes

- Status uses exactly **one** Firestore doc listener on the verification and
  identity pages; the dashboard uses one-shot reads.
- Admin queue is a paged query (25/page), documents are downloaded only when
  the detail page opens, and signed URLs expire in 10 minutes.
- No polling anywhere.
