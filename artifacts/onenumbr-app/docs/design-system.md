# OneNumbr — Design System (v1.0)

The single visual language for OneNumbr: premium, global, minimal,
infrastructure-grade, calm. Aligned with the OneNumbr brand (dark surface,
gold primary, restrained motion). Backend contracts and functional truth are
never altered for visuals.

## Tokens (`app/globals.css` — single source of truth)

### Surfaces (4-level hierarchy)
| Token | Value | Use |
|---|---|---|
| `background` | hsl(240 23% 3%) | page canvas + subtle gold radial accent |
| `surface` / `surface-2` | 8% / 10% | sidebar, inputs, raised rows |
| `card` | 6% + blur | cards |
| `muted` | 12% | hover fills, skeletons |

### Brand & status
`primary` gold hsl(44 55% 54%) · `accent` lighter gold · `destructive` red.
Status colors: `success` green, `warning` amber, `info` blue — consumed only
through `lib/status.ts` (below). `gold` tone = brand emphasis / demo markers.

### Typography (Outfit + JetBrains Mono)
| Token | Size | Use |
|---|---|---|
| `text-display` | 36px | OneNumbr ID hero, marketing numerals |
| `text-h1` | 24px | PageHeader titles |
| `text-h2` | 18px | section headings |
| `text-body` | 14px | default copy |
| `text-small` | 12px | secondary text, table meta |
| `text-caption` | 11px + tracking | labels, badges, eyebrows |
| `font-mono` | JetBrains Mono | OneNumbr ID, numbers, refs, order codes |

### Radius, shadow, motion
Radius `sm 6 / md 8 / lg 10 / xl 12` (pill via `rounded-full`).
Shadows: `shadow-card` (rest), `shadow-pop` (overlays). Motion: two easings
(`ease-out-quart`), four animations (`fade-in`, `fade-up`, `scale-in`,
`slide-up`); all disabled under `prefers-reduced-motion`.

## Status system (`lib/status.ts`)

One map from every domain status → `{ label, tone }`, resolved by
`<StatusBadge status="…" />`. Never keep private label/tone maps in pages —
the same state (e.g. `waiting_for_customer` → "Waiting for you" + warning)
must look identical on every page, customer and admin. Unmapped statuses get
deterministic fallback tones via regex buckets.

## Component library (`components/ui/`)

| Component | Notes |
|---|---|
| `Button` (primary/secondary/ghost/danger; sm/md/lg; loading) | the one button |
| `IconButton`, `Select`, `SearchInput`, `Pagination` (`Controls.tsx`) | form + navigation controls |
| `Input`, `Label`, `Field` | labeled fields with error/hint states |
| `Tabs` | the one tab bar (aria tablist) — replaces 5 ad-hoc implementations |
| `Table`, `THead`, `TH`, `TBody`, `TR`, `TD`, `TableSkeleton` | consistent density; `min-w` + horizontal scroll on mobile |
| `Badge`, `StatusBadge` | status language |
| `Card`, `CardHeader`, `CardTitle`, `CardContent`, `DataRow` | surfaces |
| `MetricCard` | admin/operations stat tiles |
| `Modal`, `ConfirmDialog` | dialogs; ConfirmDialog is the one destructive-confirmation pattern |
| `Alert` | page-level info/success/warning/danger banners |
| `Toast` (`toast.tsx`) | action feedback |
| `EmptyState`, `LoadingState`, `Skeleton`, `ErrorState` | every async surface uses these |
| `Timeline` (`Feedback.tsx`) | one activity-timeline pattern (account activity, Customer 360) |
| `Breadcrumbs`, `Tooltip`, `Dropdown`, `Avatar` | wayfinding |

## Navigation structure

- **App sidebar** (`AppShell`): grouped — *Platform* (Dashboard, Identity,
  Number, eSIM, Billing) and *Account* (Account, Security, Devices, Support,
  Help). Admin console link appears for admin/support claims.
- **Mobile**: drawer with focus containment + Escape, skip-to-content link,
  sticky topbar with notifications, OneNumbr ID chip, account menu.
- **Admin** (`AdminShell`): denser flat nav (Users, Support, Operations, KYC,
  Numbers, eSIM, Billing, Logs) with honest `soon` markers for unbuilt
  modules.

## Page composition rules

- `PageHeader` on every page (title ≤ 24px, one-line description, actions
  right). Breadcrumbs on nested detail pages.
- Content max-width `max-w-5xl` (dashboards) / `max-w-3xl` (forms, details).
- Cards stack in `grid gap-3 sm:grid-cols-2 lg:grid-cols-3` state grids.
- Destructive actions always go through `ConfirmDialog`.
- Loading: skeletons for structure, `LoadingState` for whole-surface waits.
- Empty states include a next action, never a blank screen.

## Honest-capability markers

Demo providers, mock payments, and unbuilt features are labeled in plain
language ("Demo environment", "Two-factor authentication isn't available
yet"). UI polish never implies live telecom/payment/2FA capability.

## Accessibility contract

Global `:focus-visible` outline, skip link, semantic headings, `aria-current`
on nav, `role="tablist"` Tabs, `aria-modal` dialogs with Escape, labeled
inputs (`Field`), `role="alert"` on errors, state never communicated by color
alone (badges always carry text).
