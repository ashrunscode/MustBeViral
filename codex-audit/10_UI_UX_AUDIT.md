# 10 — UI / UX Audit

## What ships in `app/`

```
app/
  app.css                  Tailwind base styles
  entry.server.tsx         (template default)
  root.tsx                 HTML scaffold + Layout + ErrorBoundary
  routes.ts                2 routes: index → home.tsx, "*" → shell.tsx
  routes/
    home.tsx               255 lines — STATIC info dashboard with hardcoded pageMap
    shell.tsx              re-exports home.tsx (catch-all)
  welcome/                 logos from Cloudflare template
```

`shell.tsx`:

```ts
export { default, loader, meta } from "./home";
```

So **every URL renders the same page**. The "approvals" path renders the same component with `pageMap.approvals` selected; same for `/intelligence`, `/calendar`, etc.

## What `home.tsx` actually does

It renders a static cockpit with:

* A left sidebar of 13 hardcoded section links (`/signup`, `/workspace`, `/brands`, `/onboarding`, `/intelligence`, `/calendar`, `/approvals`, `/media`, `/dm-automation`, `/reports`, `/growth`, `/billing`, `/admin`).
* A header showing the active section's title and a primary action button (e.g. "Create Brand", "Open API", "Brands", "Command Center", "Start Onboarding").
* 4 baseStats cards (`Brands: Multi`, `Publishing: 0`, `Scheduler: Manual`, `AI Mode: Mock`) — identical for every section.
* A list of 3 "rows" per section, each with `title`, `evidence`, `owner`, `status`. The defaults (used by 9 of 13 sections via the `page()` helper) are:
  * "API route — API — Implemented"
  * "Workflow record — Agent — Mock-safe"
  * "Guardrail — Security — Enforced"
* A right-hand "Guardrails" panel with 4 hardcoded entries: "Approval first", "Untrusted scans", "No DM bots", "Manual export".

The component **never calls `/api/*`.** No `useEffect`, no `useState`, no fetch call, no React Router action. Every page state is computed at SSR time from the URL path with a `pageMap` lookup.

## What is NOT in the UI

| Spec UX | Code UI |
|---|---|
| Signup form | None |
| Login form | None |
| Workspace creation form | None |
| Brand creation form (with website URL, social handles, industry) | None |
| Onboarding progress indicator | None |
| Brand intelligence visualisation (scores, evidence) | None |
| Brand profile editor (with locked fields) | None |
| Target market report viewer | None |
| Content calendar (30-day grid with platform filters) | None |
| Approval queue with approve/reject/edit/regenerate actions | None |
| Media library (view, upload, generate) | None |
| DM rules drafting form | None |
| Weekly report viewer | None |
| Growth opportunities cards | None |
| Billing / plan selector / portal link | None |
| Admin dashboard | None |
| Auth state indicator | None |

**The product cannot be used through a browser.** It can only be used via direct API calls (curl/Postman) by a developer who knows about `/api/auth/signup`, `/api/workspaces`, etc.

## E2E test reality check

`tests/e2e/command-center.spec.ts` (Playwright):

```ts
test("renders the command-center shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Brands" })).toBeVisible();
  await expect(page.getByText("Approval first")).toBeVisible();
});

test("renders the approval-first mobile route", async ({ page }) => {
  await page.goto("/approvals");
  await expect(page.getByRole("heading", { name: "Approvals" })).toBeVisible();
  await expect(page.getByText("No direct publishing or unsafe DM automation")).toBeVisible();
});
```

Both tests verify static text. They prove the cockpit renders. They do **not** prove a user can sign up, log in, see their data, or take any action. Per BUILD_LOG Milestone 7, e2e is only ever run as `--list` (lists tests without executing them).

## UI verdict

| Dimension | Status |
|---|---|
| Visual design | ⭐⭐⭐ Looks acceptable for a marketing splash page (Tailwind-based, restrained palette) |
| Information architecture | ⭐⭐ Sidebar covers the right sections, but every page is a stub |
| Functional completeness | ⭐ None of the MVP user actions has a UI |
| API integration | ⭐ Zero calls to backend |
| Accessibility | Untested |
| Mobile responsiveness | Tailwind breakpoints used, but content is purely informational |
| State management | Not applicable — no state |

**UI VERDICT: shell only — rebuild needed before launch.**

## Spec gap matrix

| Page / UX | Exists | Data-backed | Mock Only | Missing | Fix |
|---|---|---|---|---|---|
| Login | — | — | — | ✅ | Build /login |
| Signup | — | — | — | ✅ | Build /signup |
| Workspace setup | sidebar entry | — | — | ✅ functional | Build /workspace creation |
| Brand list / create | sidebar entry | — | — | ✅ functional | Build /brands form |
| Onboarding flow | sidebar entry | — | — | ✅ functional | Build progress UI |
| Intelligence | sidebar entry | — | — | ✅ functional | Build scores + evidence |
| Profile editor | sidebar entry | — | — | ✅ functional | Build editor with locks |
| Target market | sidebar entry | — | — | ✅ functional | Build report viewer |
| Calendar | sidebar entry | — | — | ✅ functional | Build 30-day grid |
| Approvals | sidebar entry | — | — | ✅ functional | Build queue |
| Media | sidebar entry | — | — | ✅ functional | Build library |
| DM automation | sidebar entry | — | — | ✅ functional | Build rule form |
| Reports | sidebar entry | — | — | ✅ functional | Build viewer |
| Growth | sidebar entry | — | — | ✅ functional | Build cards |
| Billing | sidebar entry | — | — | ✅ functional | Build plan selector |
| Admin | sidebar entry | — | — | ✅ functional | Build admin overview |
| Loading states | — | — | — | ✅ | — |
| Empty states | — | — | — | ✅ | — |
| Error states | basic | — | — | ✅ | Build per-route errors |
| Auth state | — | — | — | ✅ | Add session indicator |

## Required fixes

The frontend essentially needs to be built. Given the complexity:

1. **Sprint A (auth):** Build `/login`, `/signup`, `/logout` with React Router actions hitting `/api/auth/*`.
2. **Sprint B (workspace + brand):** `/workspaces` (list/create), `/brands/new`, `/brands/:id` (overview).
3. **Sprint C (core flow):** Onboarding → intelligence → profile → calendar → approvals.
4. **Sprint D (advanced):** Media, DM rules, reports, growth, billing, admin.

Each route needs `loader`+`action` (React Router 7 pattern), TanStack Query / SWR for client refresh, plus components.

**Estimate (Architect/Implementer rough):** 3-5 weeks of disciplined frontend work for a usable beta UI.
