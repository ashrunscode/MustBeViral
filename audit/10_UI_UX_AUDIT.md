# 10_UI_UX_AUDIT.md

## UX Verdict

The UX intent in `PRODUCT_DNA.md` and `UI_WIREFRAMES.md` is strong and product-led: brand-first command center, evidence-led recommendations, approval queue, mobile approval-first, multi-brand from day one. **No frontend code exists**, so the audit grades the design intent rather than execution.

The biggest UX decisions still to make:
- React Router data-loader pattern vs TanStack Query for server state.
- ShadCN component scope (which to install, which to write fresh).
- Real-time channel design for `MarketingAgent` updates.
- Empty/loading/error component primitives.

UI VERDICT: **build fresh from `react-router-hono-fullstack-template`.** No design system to preserve.

## Current Pages

None. `setup.py` writes a single `<div>MustBeViral command center scaffold</div>` placeholder.

## Missing Pages

Every route in `UI_WIREFRAMES.md` is missing in code. Required Phase 1 routes:

```
/login
/signup
/forgot-password         (if custom auth)
/reset-password          (if custom auth)

/app                     redirect to current brand or create flow
/app/create-workspace    (only if user has 0 workspaces)
/app/workspaces/:id/settings

/app/create-brand
/app/brands/:brandId             (Command Center)
/app/brands/:brandId/scan        (live onboarding timeline)
/app/brands/:brandId/intelligence
/app/brands/:brandId/profile
/app/brands/:brandId/target-market
/app/brands/:brandId/calendar
/app/brands/:brandId/approvals
/app/brands/:brandId/media
/app/brands/:brandId/creative
/app/brands/:brandId/dm
/app/brands/:brandId/analytics
/app/brands/:brandId/reports
/app/brands/:brandId/reports/:reportId
/app/brands/:brandId/growth
/app/brands/:brandId/settings

/app/admin
/app/admin/workflows
/app/admin/agent-runs
/app/admin/usage
/app/admin/audit
/app/admin/billing

/billing/success
/billing/cancel
```

## Bad UX Patterns to Avoid

`PRODUCT_DNA.md` codifies eight UX rules. Add these specific implementation guards:

1. **No spinner-only loading.** Every loading state must show the *step it's executing*, not a generic spinner. The agentic scan timeline should auto-render even while empty (with skeleton steps), so the user always sees structure.
2. **No "0 results" empty states.** Every list page must offer the next action: empty calendar → "Generate calendar" CTA; empty media → upload + generate CTAs; empty growth → "Run growth scan" CTA.
3. **No silent errors.** Every API failure must show the error message + a `Try again` button + a `Copy traceId` action.
4. **No chat-first UI.** Spec is explicit. The command bar is `cmd+k` for navigation/actions, not a generic chat.
5. **No fake progress.** Progress bars must be backed by real workflow step counts, not interpolated.
6. **No popups for fatal flows.** Approval queue must use full-page or drawer, not modals (interrupts mobile UX).
7. **No multi-tab brand confusion.** When a brand is paused, every page must show a banner; the agent activity drawer must reflect this.
8. **No mixed unit displays.** `metrics_json` is free-form; lock to canonical metric names per platform via a shared mapping.

## Required Page Map (Trimmed)

For Phase 1 ship, the absolute minimum is:

| Route | Why must-ship |
|---|---|
| `/signup`, `/login` | Required to enter the product |
| `/app/create-brand` | First magic moment input |
| `/app/brands/:brandId/scan` | Visible agentic activity (key wow factor) |
| `/app/brands/:brandId/intelligence` | The first "real value" page |
| `/app/brands/:brandId/profile` | Editable brand memory |
| `/app/brands/:brandId/calendar` | Core deliverable view |
| `/app/brands/:brandId/approvals` | Trust layer (most-used page after MVP) |
| `/app/brands/:brandId` | Command center recap |
| `/app/admin` | Operate managed service |

Everything else (target-market, creative studio, DM automation UI, growth list, reports list) is essential but can ship in week 2–3. **Don't gate launch on the long tail.**

## Required Component Map

`COMPONENT_MAP.md` lists ~35 components. They are appropriately granular. Add these primitives missing from the spec:

| Primitive | Purpose |
|---|---|
| `EmptyState` | Standard empty-state with icon, copy, CTA |
| `ErrorBoundary` | Per-route error boundary with `Try again` and `Copy traceId` |
| `Skeleton` | Loading skeleton primitive |
| `EvidenceLink` | Clickable evidence reference (post id, scan id, metric snapshot) |
| `RiskBadge` | Color-coded risk level chip |
| `PlatformIcon` | Single icon component mapping platform → svg |
| `ApprovalKeyboardLayer` | Keyboard handler for batch approve (`a`/`r`/`e`/`g`) |
| `WorkflowProgressTimeline` | Generic timeline used by scan + future workflows |
| `BrandSwitcherCommand` | Cmd+K integration for brand switching |
| `AgentActivityDrawer` | Right-side drawer subscribing to agent WebSocket |
| `CostBudgetMeter` | Inline meter showing remaining tokens/images per plan |
| `CopyableId` | Inline UUID with copy button (admin/debug pages) |

## Mobile Issues

`PRODUCT_DNA.md` declares "Mobile is approval-first". Implementation rules:

1. Approval queue must be the only feature that is *fully* tuned for mobile in Phase 1. Other pages should be responsive but not optimized.
2. Use system swipe gestures: swipe right → approve, swipe left → reject (with shake-to-undo).
3. Single-handed reach: place batch toolbar at the bottom, not the top.
4. No horizontal scrolling. Calendar mobile view should default to "list-by-day" not "month grid".
5. Generated images need fast-tap zoom; don't open a new page.

## Empty/Loading/Error State Issues

Mandatory patterns (codify in shared components):

- **Empty.** Render `<EmptyState icon copy primaryCta secondaryCta />`. Never render a blank panel.
- **Loading.** Skeletons for cards/lists, **never** a generic centered spinner taking the whole page.
- **Error.** `<ErrorState message traceId onRetry />`. Always show traceId for support.
- **Stale.** When data is older than X minutes (analytics, scans), show a "Refreshed N min ago" timestamp + manual refresh button.

## Design System Fixes

`PRODUCT_DNA.md` rejects "generic neon viral UX". Define a tighter system:

1. **Color palette** — neutral monochrome base, one accent (e.g., emerald-500), risk colors (amber/red).
2. **Type scale** — Inter, two weights (regular/semibold), four sizes (12/14/16/24).
3. **Spacing** — 4px grid.
4. **Iconography** — Lucide single-source (already in `setup.py` deps).
5. **Tone** — short, declarative copy. Never marketing-y inside the product. "Your calendar is ready" beats "Boom! Your viral content awaits 🚀".
6. **Motion** — micro-only (200ms tap feedback, 150ms drawer slide). No celebratory confetti.
7. **Density** — premium-tool dense (more like Linear / Stripe Dashboard, less like Canva).

UI VERDICT: **build fresh, lock the design system in week 1, never chase shadcn/ui upgrades blindly.**
