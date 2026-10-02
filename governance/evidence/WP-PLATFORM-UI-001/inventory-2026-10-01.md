# V2 surface inventory, 2026-10-01

Packet `WP-PLATFORM-UI-001`, step `ui-001-preflight`. Base `31f75deffaa450851f64a8c92ab541ccce5658ed`
(origin `main`). Author checkout: fresh single-worktree clone `C:\dev\mbv-ui-20261001` on local `main`,
Node 24.18.0, pnpm 11.12.0, frozen dependencies. The canonical workstation checkout carries 38
linked worktrees and untracked files from other sessions, which fail the packet gate; it was
fast-forwarded to origin and left otherwise untouched.

Classification: **wired** reads and writes the registered handlers; **partial** is wired but fails
the finish line; **fake** renders fixtures or dead controls as if real; **missing** has no route.

## Public

| Surface            | Route               | Status  | Backend                                                | Finish-line gaps found                                                                                                                                                              |
| ------------------ | ------------------- | ------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio landing, EN | `/`                 | partial | none (static, session redirect)                        | no hero frame or poster slot; objection answer rendered without its question; add-on ranges on EN only; header inside `main`; shared title with `/es`; no hreflang; page is dynamic |
| Studio landing, ES | `/es`               | partial | none                                                   | `html lang="en"` in server HTML (client patch); first-contact greeting used as web copy; not a layout peer of EN; same title as `/`                                                 |
| Software landing   | `/software`         | partial | none                                                   | "Specified path" jargon; asset names carry `p0`; invisible but focusable video control; reduced-motion play button inserted after hydration; header inside `main`                   |
| Software pricing   | `/software/pricing` | wired   | none (provisional catalog)                             | author-facing disambiguation sentence; header inside `main`                                                                                                                         |
| Sign in            | `/login`            | wired   | Supabase password sign-in                              | failure notices styled as success; loading state through opacity; no hover or pressed states; errors not linked to fields; dead `verified` notice; no page title                    |
| Sign up            | `/signup`           | wired   | none, collects nothing                                 | no page title; status actions lack hover and pressed                                                                                                                                |
| Forgot password    | `/forgot-password`  | wired   | Supabase recovery email                                | success message styled as failure (`auth-message--sent` undefined); no page title                                                                                                   |
| Reset password     | `/reset-password`   | wired   | Supabase update + global sign-out                      | undefined message classes; policy text not described to inputs; no page title                                                                                                       |
| Verify email       | `/verify-email`     | wired   | Supabase resend                                        | redirect origin read with a loopback fallback instead of the validated environment; pending label mismatch; no page title                                                           |
| Maintenance        | `/maintenance`      | partial | none                                                   | no producer routes here; product vocabulary on a page that returns to the studio surface                                                                                            |
| Unauthorized       | `/unauthorized`     | partial | none                                                   | no producer routes here; wrong-tenant failures render inline recovery instead                                                                                                       |
| Not found          | `not-found.tsx`     | wired   | none                                                   | no page title                                                                                                                                                                       |
| Shared shell       | layout, proxy, css  | partial | proxy runs strict env parse + getClaims on every route | hex `#fff` and literal radii in `globals.css`; no title template; no icon, so every page requests a missing favicon; marketing routes 500 when a public variable is absent          |

## Studio workspace

| Section               | Route today                         | Status  | Backend                                                                            | Plan                                                                                                                         |
| --------------------- | ----------------------------------- | ------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Overview              | `/studio?studio=<id>`               | partial | `get_studio_access`, `list_studio_brands`, `start_brand_draft`                     | attention list from real data (open questions, unapproved drafts, invitations); same heading as the chooser; arrows; `+ Add` |
| Brands                | inside Overview                     | partial | `list_studio_brands`                                                               | own section with search and archive filter; cards carry status, not a static sentence                                        |
| Calendar              | none                                | missing | no schedule or publication contract exists                                         | honest empty calendar (week strip, list below 768) naming the missing contract and the one legal action                      |
| Approvals             | none                                | missing | per-brand `get_knowledge_review` (draft awaiting approval)                         | list brands whose knowledge draft is approvable; link to the brand's findings approval                                       |
| Tasks                 | none                                | missing | per-brand open `brand_knowledge_questions`, pending invitations                    | real open questions and invitations; empty state names the action                                                            |
| Creators and partners | none                                | missing | no creator, partnership or outreach contract exists                                | honest empty state naming the missing contract                                                                               |
| Reports               | none                                | missing | no metrics contract; receipts are per run only                                     | honest empty state: receipts are the only measured record; link to a brand's results                                         |
| Team                  | `/studio?studio=<id>&view=team`     | wired   | team, invitation, member operations                                                | revoke actions need confirmation naming the person; raw enums; no `aria-current`                                             |
| Settings              | `/studio?studio=<id>&view=settings` | partial | `update_studio`                                                                    | no saved state; conflict keeps stale field; no `aria-current`                                                                |
| Chooser               | `/studio`                           | wired   | `list_studios`, `list_my_invitations`, `create_studio`, `accept_studio_invitation` | duplicate links; arrows; raw role enum; second `h1` on error                                                                 |
| Shell                 | `PlatformFrame` and `.studio-app`   | partial | `get_workspace` (header name)                                                      | two shells; one-word wordmark; fake status row and budget; sidebar never current; session recovery drops the return path     |

## Brand

| Section      | Route today                 | Status  | Backend                                                            | Plan                                                                                                                                            |
| ------------ | --------------------------- | ------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview     | none (default is the draft) | missing | `get_brand_access`, `get_knowledge_review`, `list_brand_locations` | brand home: identity from the approved version, draft state, locations, next action                                                             |
| Intelligence | `?view=findings`            | wired   | 7 knowledge queries, 15 knowledge mutations                        | live-region flicker during polling; whole surface blanks on refresh; raw ids, hashes and ISO times; approval impact unstated; several primaries |
| Assets       | none                        | missing | only P0 run artifacts; no asset library or rights contract         | honest empty state naming the missing contract; packshots stay in the campaign brief                                                            |
| Channels     | none                        | missing | no connection contract                                             | honest empty state naming the missing contract                                                                                                  |
| Campaigns    | none                        | missing | P0 project/canvas exist but no list operation                      | one legal action: start a campaign brief with brand context carried in the URL                                                                  |
| Content      | none                        | missing | content lives in run artifacts; no content item contract           | honest empty state; the campaign's content review is the only content surface                                                                   |
| Calendar     | none                        | missing | no schedule contract                                               | honest empty calendar scoped to the brand                                                                                                       |
| Inbox        | none                        | missing | no conversation contract                                           | honest empty state naming the missing contract                                                                                                  |
| Results      | none                        | missing | per-run receipts only                                              | honest empty state; receipts are reachable from a campaign                                                                                      |
| Draft        | `?view=draft`               | wired   | `get_brand_draft`, `initialize_brand_draft`, `save_brand_draft`    | uncertain-failure lock without an edit path; conflict does not show the current version; promise copy                                           |
| Locations    | `?view=locations`           | wired   | location operations                                                | archive without confirmation; saved state unmounts; conflict keeps stale values                                                                 |
| Settings     | `?view=settings`            | wired   | brand, workspace settings and grant operations                     | archive shown for archived brands; grant and revoke without confirmation; raw action identifiers                                                |
| Billing      | `/studio/<ws>/billing`      | wired   | `get_workspace_billing`                                            | raw subscription enum; chrome lost when the directory query fails                                                                               |

## Campaign and content (the P0 workflow)

| Section           | Route today                   | Status  | Backend                                                               | Plan                                                                                                                                  |
| ----------------- | ----------------------------- | ------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Brief             | `/studio/<ws>/brief`          | partial | workspace, project, canvas, patch, artifact upload                    | synthetic packshots pre-filled in authenticated mode; fake revision, region and version strings; model id in copy; conflict path      |
| Plan (canvas)     | `/studio/<ws>/canvas`         | partial | `get_canvas_context`, `validate_graph`, `apply_canvas_patch`, tickets | default selection is a fixture id so live nodes render dimmed; fake arrival animation and footer telemetry; no 768 or 1280 layout     |
| Budget (quote)    | `/studio/<ws>/quote`          | partial | `quote_run`, `start_run`                                              | kill switch indistinguishable from an outage; run id never written to the URL; static QA pre-checks and impact graph; no phone layout |
| Run               | `/studio/<ws>/quote?run=`     | partial | `get_run`, `cancel_run`                                               | raw state enums; cancel without confirmation or pending state; settlement hidden below 800px                                          |
| Content (review)  | `/studio/<ws>/review`         | partial | receipt, run, artifacts, project, `approve_artifacts`                 | no durable reject exists; approve has no pending state; desktop link missing on phone; autoplay ignores reduced motion; raw hex       |
| Compare           | `/studio/<ws>/review/compare` | fake    | same reads                                                            | prior pane never loads a prior artifact                                                                                               |
| Results (receipt) | `/studio/<ws>/receipt`        | partial | receipt, run, `create_export`, download                               | verified seal on every state; dead preview button; internal names (`GB-04`, `Core`, ledger authority)                                 |
| Collaborators     | none                          | missing | collaboration Worker not configured in production                     | honest state from the ticket refusal                                                                                                  |
| Calendar          | none                          | missing | no schedule contract                                                  | honest empty calendar scoped to the campaign                                                                                          |
| Approvals         | inside review                 | partial | `approve_artifacts`                                                   | approval summary per concept; reject stays visible with its reason                                                                    |
| Access            | `/studio/<ws>/access`         | wired   | P1b API keys                                                          | session expiry has no sign-in action; revoke without confirmation; bold headings                                                      |
| Skills            | `/studio/<ws>/skills`         | wired   | P1b skills                                                            | wrong session message; publish dialog pre-filled with placeholder content                                                             |
| Internal          | `/studio/<ws>/internal`       | partial | `get_workspace`, kill-switch RPC                                      | no operator gate; defaults rendered as truth; phase codenames                                                                         |
| Continue          | `/studio/continue`            | fake    | browser session storage only                                          | preview-only with a fixture workspace                                                                                                 |
| Projects          | `/studio/<ws>/projects/<id>`  | wired   | `resolve_project_brand`, `list_brand_studios`                         | arrows; context missing in header                                                                                                     |
| Billing fixture   | preview billing               | fake    | none                                                                  | kill-list words (`P1a`, `fully-landed margin cap`); mock rows                                                                         |

## Backend facts that bound the plan

- 65 platform operations, 20 P0 operations and 10 programmatic-access operations are registered;
  every platform operation has a matching Postgres dispatch branch and pgTAP coverage.
- No contract, route, table or migration exists for channels, platform campaigns, publications,
  schedule, creators, partners, conversations, aggregate metrics or tasks. No list operation exists
  for projects, canvases, runs or artifacts. These routes ship honest empty states that name the
  missing contract; no migration is added in this packet.
- Core maps every `billing_blocked` and `provider_unavailable` outcome to `503 MODEL_UNAVAILABLE`,
  so a kill switch, an unpaid subscription and an outage are indistinguishable to the interface
  (`apps/core/src/transport/semantics.ts`). The quote and run screens cannot render the handler's
  blocked state until the transport carries it.
- Production Core runs with `PROVIDER_RUNS_ENABLED=false`, no cron and no queue: brief, plan and
  quote execute; `start_run` refuses with 503; no run dispatches. The interface must say so.
- Workspace membership is owner-only for P0 operations; studio editors and viewers reach platform
  operations only.

## Buyer portraits (section 4 of the directive)

Each surface: buyer, moment, fear, believable proof, single next action. Sources:
`brand/context.md` section 2 and `docs/ux/EXPERIENCE_CONTRACT.md`.

**Studio landing, `/` and `/es`.** Houston owner or marketing lead, 3 to 100 employees, med spa,
restaurant or bar, gym, auto, home services or real estate team. Arrives on a phone between other
jobs after a referral or a search for "someone to film my business". Fears paying for content that
never gets posted and a vendor who disappears after one shoot. Believes delivered work shown
plainly, an exact price with what it includes, and a cadence stated as a commitment. Next action:
book a test shoot by calling 713-899-9346.

**Software landing and pricing, `/software`, `/software/pricing`.** DTC founder or head of growth
with a one to five person team. Arrives on desktop from a product page or an invitation. Fears a
black-box credit burner that spends before showing anything. Believes the exact path from a file to
a receipt, a provisional price table with no buy button, and a sign-in that starts no subscription.
Next action: sign in to Studio, or request access by email.

**Auth and status screens.** The same software buyer or an invited studio client. Arrives from a
link, an expired session or a typo. Fears losing work and not knowing why the door is closed.
Believes a message that names the state, what was kept and the exit. Next action: sign in, or return
to the page they came from.

**Studio overview, brands, team, settings.** An operator who runs social for one business or a
portfolio. Arrives after sign-in, often returning mid-task. Fears acting in the wrong brand and not
seeing what needs a decision. Believes a list of real open items with the brand named on each, and
a brand grid that shows saved state. Next action: open the brand that needs a decision.

**Studio calendar, approvals, tasks, creators and partners, reports.** The same operator checking
what is scheduled, what waits on them and what performed. Fears an interface that invents numbers
or hides a blocker. Believes real open questions and approvable drafts, and an empty state that says
exactly which capability is not in this release. Next action: answer the open question, approve the
draft, or go back to the brand.

**Brand overview, intelligence, assets, channels, campaigns, content, calendar, inbox, results.** The
operator inside one brand. Arrives from the grid or a deep link. Fears mixing two brands and
approving a fact that expired. Believes sourced findings with correction controls, an identity drawn
from the approved version, and brand name and workspace visible on every screen. Next action:
correct or approve the draft, or start a campaign brief.

**Campaign brief, plan, budget, run, content, approvals, results.** The operator producing one
campaign. Arrives from the brand's campaigns section. Fears unapproved spend, a pretty failure and
a stale revision. Believes a quote that names the maximum amount on the confirm control, a run view
that says what succeeded and what spend was kept, a review that shows composed ads, and a receipt
that lists exactly what was exported. Next action: validate the brief, confirm the named quote,
approve the concept, or create the export.

## Decisions recorded where the files are silent

- Add-on ranges are removed from both studio pages so English and Spanish are layout and content
  peers; the add-on point inside each range is an open owner item in `brand/context.md` section 13.
- The "Book a test shoot." control stays a telephone link, the only booking path the brand allows
  without collecting data; the number is also shown as the secondary text link.
- Auth screens offer "Request access" as a mailto link to the approved public address
  `studio@mustbeviral.com`; nothing is collected on the site, so the recorded "Request access"
  defect in `brand/context.md` section 7c closes through its option (a) without a form.
- No favicon mark ships: the logo system is owner-gated at draft. The document icon is set to an
  empty data URL so pages stop requesting a missing file.
- Studio sections with no backing contract render honest empty states over real brand data; the
  calendar is a real week strip with no items rather than a mock grid.
- The campaign workflow keeps its routes under `/studio/<workspace>/...` and carries `studio` and
  `brand` query context forward so the single shell can show brand and workspace on every screen.

## Blockers recorded, not crossed

- No rights-cleared studio footage or poster exists; the hero frame is built so the asset drops in
  through one configuration record, and the frame reserves its geometry without it.
- The brand registry still names no fluent Spanish reviewer; only the locked lines and the approved
  Spanish pairs ship, and no new Spanish is written.
- Staging `mustbeviral-web-staging` lacks the four public variable names; the release records the
  one sentence that clears it if staging returns 500.
