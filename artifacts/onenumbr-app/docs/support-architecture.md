# OneNumbr — Support Architecture (Prompt 7, v1.0)

The customer support model: cases, conversations, internal notes, assignment
and the customer Help Center. Built entirely on the existing auth, audit,
notification and admin infrastructure.

## Ticket model

`support_tickets/{ticketId}`:

| Field | Notes |
|---|---|
| `ticketNumber` | `SUP-YYYY-######` — allocated in a Firestore transaction on `support_counters/ticket-{year}` (billing_counters pattern). Never the doc id. |
| `uid` | owner, from the verified session — never from the body |
| `category` | identity / number / esim / billing / account / technical / other |
| `subject`, `description` | description duplicates the first message for queue previews |
| `status` | `open → in_progress → waiting_for_customer → waiting_for_provider → resolved → closed` |
| `priority` | `low / normal / high / urgent` |
| `source` | `customer / admin` |
| `relatedEntityType/Id` | optional link to an esim order, number, payment or invoice |
| `assignedTo/At/By` | staff assignment; admin identity from the verified claim |
| `createdAt / updatedAt / lastMessageAt / resolvedAt / closedAt` | lifecycle stamps |

Status transitions are deterministic and server-side:
- customer reply on `waiting_for_customer` → `in_progress`
- agent reply on `open` → `in_progress` (or `waiting_for_customer` when the agent flags it)
- customer may close only `resolved` cases and reopen only `closed` ones
- staff may set any status via the staff API (audited)

## Conversation model

`support_tickets/{ticketId}/messages/{messageId}`:
`senderType (customer|agent)`, `senderUid`, `senderName`, `message`,
`attachments[]` (metadata only), `createdAt`.

## Internal notes — isolation in depth

`support_tickets/{ticketId}/internal_notes/{noteId}` with author, authorName,
message, timestamp. A customer can never read them because:

1. The customer API (`/api/support/[ticketId]`) reads only the `messages`
   subcollection and projects nothing else.
2. Firestore rules deny **all** client access to every
   `support_tickets/{id}/{sub=**}` path — messages and notes alike.
3. Notes are only returned by `/api/admin/support/[ticketId]`, which requires
   the verified admin/support claim.

## Attachments

- Private Storage scope `support/{uid}/…`; storage rules allow owner-only
  writes with conservative validation (PNG/JPEG/PDF, 10 MB).
- Uploads go through `POST /api/support/attachments` (server-validated type +
  size, Admin SDK write, audit-logged). Executables and arbitrary types are
  impossible at both the route and the rules layer.
- Viewing resolves a **10-minute signed URL** via
  `GET /api/support/attachments/<path…>` — customers only for their own files,
  staff for any (verified claim). No permanent or public URLs exist.
- When a reply references attachments, the server re-validates each path
  (scope prefix + existence in Storage) before persisting the message.

## Permissions

| Actor | Can |
|---|---|
| Customer | create own tickets, read own tickets (messages only), reply, close resolved, reopen closed, upload own attachments |
| Staff (admin/support claims) | read all tickets incl. internal notes, reply, assign/reassign/unassign, set status/priority, resolve, add notes |
| Financial mutations | unchanged — refunds/payments still require the admin role through the billing engine; support actions never bypass business logic |

## Assignment

`assignedTo` is a staff identifier (email/uid string) set through
`POST /api/admin/support/[ticketId]/assign`. The performing admin identity
comes from the verified session and is recorded in `assignedBy` + audit.
Supports assign / reassign / unassign with distinct audit actions.

## Notifications & audit

Reuses the existing systems (no second architecture):
- Notification kinds: `support.ticket_created`, `support.agent_replied`,
  `support.status_changed`, `support.ticket_resolved`, `support.ticket_reopened`.
- Audit actions: `support.ticket_created`, `support.customer_replied`,
  `support.customer_closed`, `support.customer_reopened`,
  `support.attachment_uploaded`, `support.agent_replied`,
  `support.internal_note_added`, `support.ticket_assigned`,
  `support.ticket_reassigned`, `support.ticket_unassigned`,
  `support.ticket_status_changed`, `support.ticket_priority_changed`,
  `support.ticket_resolved`, `support.ticket_reopened`.

## Help Center

- `/app/help` + `/app/help/[slug]` render static content from
  `lib/help-content.ts` — only functionality that actually exists, with
  honest demo-environment notes.
- Search (`lib/help-search.ts`) is scored token matching over that module —
  no external service, no Firestore reads (free-tier friendly). The
  `/api/help` + `/api/help/search` routes exist so a future CMS can slot in
  behind the same contract.
- Service status (`components/app/ServiceStatus.tsx`) derives from
  `lib/service-status.ts`: real in-app engines report operational; demo-provider
  capabilities are labeled **Demo environment** with plain-language notes.
  Outages are never fabricated.

## Security rules

- `support_tickets`: customer read-own (view fields); **all client writes
  denied**; subcollections (`messages`, `internal_notes`) fully client-denied.
- `support_counters`, `operational_alerts`: server-only (alerts admin-readable).

## Firebase cost profile

- Customer list: single indexed query (`uid + lastMessageAt desc`, limit 50).
- Admin queue: indexed status/category/priority/assignment filters + bounded
  count (≤1000 ids) + page-size reads; customer emails resolved per page.
- Ops dashboard: bounded queries with status filters and a 14-day window.
- No realtime listeners, no polling loops anywhere in the support layer.

## Future provider integrations

- A real helpdesk/email bridge can subscribe to `support.*` audit events.
- `assignedTo` is ready for a proper staff directory once roles expand.
- Attachment handling can move to a virus-scanning pipeline without changing
  the API contract.
