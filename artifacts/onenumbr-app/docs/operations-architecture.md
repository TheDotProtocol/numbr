# OneNumbr — Operations Architecture (Prompt 7, v1.0)

The operational layer that makes OneNumbr supportable: a "what needs
attention?" dashboard, deterministic alerts, and the Customer 360 view.

## Principles

- **Answer "what needs attention?"** — not a vanity analytics dashboard.
- **Deterministic only** — thresholds on real records. No fake AI anomaly
  detection, no fabricated outages, no invented provider status.
- **Read, never duplicate** — every indicator queries the system of record
  (eSIM/number orders, payments, KYC, tickets). No event copying.
- **Free-tier aware** — bounded queries only: status filters, limits, and a
  14-day failure window. No full-collection scans.

## Alert model

`lib/operations-server.ts → evaluateAlerts()` derives seven indicators:

| Kind | Source query | Thresholds |
|---|---|---|
| `esim_provisioning_failures` | `esim_orders` where status=failed (≤100, 14d window) | 0 → info · ≥1 → warning · ≥5 → critical |
| `number_provisioning_failures` | `number_orders` where orderStatus=failed (same shape) | same |
| `payment_failures` | `payments` where status=failed (same shape) | same |
| `kyc_backlog` | `kyc` where status=submitted (≤200) | 0 → info · ≥5 → warning · ≥20 → critical |
| `support_backlog` | open ticket count (≤500) | 0 → info · >0 → warning · ≥10 → warning · ≥30 → critical |
| `urgent_tickets` | urgent + active statuses (≤100) | any → critical |
| `refund_activity` | reserved for the billing engine's refund records | (reported via payments view in V1) |

`refreshOpsSnapshot()` persists the latest evaluation to
`operational_alerts/current` (server-only collection, admin-readable) with an
audit entry `operations.snapshot_refreshed`. The dashboard reads live state;
the snapshot is a cached read-model for future scheduled evaluation.

## Dashboard

`/admin/operations` (StaffGuard: admin + support):

- Alert list with severity badges (OK / Needs attention / Critical).
- Failure worklists: recent failed eSIM orders, number orders, payments —
  each row links to the customer's 360; each card links to the console where
  the fix lives.
- Resolution workflows surface **existing** engine operations only: eSIM
  retry (admin → eSIM → Orders → Retry), number activation retry (admin →
  Numbers → Orders → Retry), payment status (admin → Billing). Support agents
  cannot mutate financial records — those consoles still require the admin
  role through their own routes.

## Customer 360

`getCustomer360(uid)` aggregates bounded reads from every existing system
into one staff-only payload:

- **Identity** — email, name, OneNumbr ID, KYC state, account status.
- **Number** — active assignments + recent orders.
- **Connectivity** — eSIMs + recent orders.
- **Billing** — recent payments, invoices, refunds, subscriptions (metadata
  only — never credentials or card data).
- **Security** — active session count, most recent device, recent
  `login_events` titles (no tokens, no hashes displayed).
- **Support** — open + recent tickets.
- **Unified timeline** — merged, newest-first view of KYC, number, eSIM,
  billing, security and support events (≤30 entries; 6 per source).

Rendered on `/admin/users/[uid]` below the existing cards, fed by
`GET /api/admin/users/[uid]/timeline` (requireStaff).

## Access control

- Staff = verified `admin` **or** `support` custom claim (`requireStaff`).
  The `support` role was already defined in the claims system (Prompt 1);
  Prompt 7 gives it a purpose without inventing new RBAC.
- Financial routes still enforce `admin` only — unchanged.
- `operational_alerts` is admin-readable, server-written; customers can never
  see internal operational state.

## Audit

`operations.snapshot_refreshed` joins the existing audit stream; every support
action on the dashboards is audited through the support engine (see
`docs/support-architecture.md`).

## Future extensions

- Scheduled (cron) snapshot evaluation with email/webhook escalation.
- SLO-style rollups from `billing_events` / audit history.
- Per-provider health once real telecom/payment providers exist — the alert
  kinds are already provider-neutral.
