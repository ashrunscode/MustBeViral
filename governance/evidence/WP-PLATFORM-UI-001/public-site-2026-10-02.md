# Public site, 2026-10-02

Owner directive of 2026-10-02, third of the day ("You finish the public site"), recorded verbatim
in `owner-directive-2026-10-02c.md`. Worktree: the clean clone `C:\dev\mbv-ui-20261001` on `main`
at `origin/main` `e058983f43ef4c67163616914f3a6d82bcfc1fc8`, `pnpm agent:preflight` run first. The
canonical checkout at `31f75de` with its untracked `briefs/` and `.playwright-mcp/` was not used
and nothing under either is committed.

## The legal pages and the fact source for each

Anthropic's Legal plugin is listed in the plugin catalog but not installed in this session, so the
pages are written only from `brand/context.md` and from what the code does, in
`apps/web/src/components/legal-copy.ts`, where every section carries its source in a comment.
They are English only, send no email and carry no form. Each page names the entity
`ERLV INC, DBA Must Be Viral`, Houston, Texas, the contact `studio@mustbeviral.com` and
`713-899-9346`, and states that the street address is not yet published.

| Page           | What it states                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/privacy`     | The sales and legal pages set no cookie, run no analytics and load no tag; the typefaces are served from the site; booking is a phone call and access is an email; no contact or sign-up form on the sales and legal pages; the request-access page collects nothing; the browser's three page-speed numbers go nowhere in production. People sign in through Supabase Auth and accounts are not created on the site; the sign-in, recovery and verification screens pass an email to Supabase Auth and nowhere else, which sends its messages through Resend; session cookies come only from signing in or opening a recovery or verification link; studio sign-out ends the session on every device. What a signed-in studio keeps (members and grants, brands, locations, briefs, packshots, plans and revisions, quotes, reservations, ledger entries, runs, receipts, exports, API keys, invitations, plan comments and drafts, the audit log), private media behind short-lived signed operations, invitations accepted for seven days and kept on the list, session storage never sent to a server, no delete today (archive and revoke only; revisions and receipts immutable). Vercel, Supabase, Cloudflare (Core, the collaboration service when it runs, the media store, Workers Logs, Sentry and OpenTelemetry when configured); on mustbeviral.com generation, provider calls, queues and charging are off; nothing posts anywhere; no Drive connection; the mail adapter is never called and performs no send | `apps/web/src/lib/document-lang.ts` and `src/lib/supabase/proxy.ts` (public paths skip session work; cookies only through Supabase Auth), `apps/web/package.json` (no analytics dependency), `apps/web/app/layout.tsx` (`next/font`), `apps/web/src/lib/telemetry/web-vitals.ts` (no reporter registered in production), the four auth `actions.ts` files and `app/auth/callback`, `apps/web/app/signup/page.tsx`, `src/features/platform/platform-frame.tsx` (sign-out scope), `packages/contracts/src/**`, `supabase/migrations/20260910150000_platform_saved_setup.sql` (invitations), `docs/architecture/SYSTEM_OVERVIEW.md`, `apps/core/wrangler.jsonc` (observability, production provider runs off), `apps/core/src/bindings.ts` (Sentry and OpenTelemetry off without settings), `studio-team.tsx`, `brief-schema.ts`, `campaign-progress.ts`, `brand-settings.tsx`, `brand-workspace.tsx`, `packages/email/src/index.ts`, `brand/context.md` sections 4d, 6 and 9; the production pages answer with no `Set-Cookie` |
| `/terms`       | The two offers at their exact prices with the full section 7 lists in order, then the add-on ranges with the range rule and the turnaround sentence, no other tier and no discounts, booking by phone with the date, the location and any add-on figure confirmed on the call; releases and permissions (client-owned footage, releases, no minors, unsubstantiated claims refused, dated permission naming the client, the assets and the surfaces); no claim about reach or results; the software: a studio invites owners, editors and viewers and may invite reviewers to a brand, no account is created on the site, sign-in starts no subscription, the provisional catalog with charging not on and the reviewer-seat rule named as a catalog rule, quote before any run, a receipt that does not change and shows each provider job's route, provider and cost, a refused run when generation is off                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `brand/context.md` sections 7a, 7b, 7c, 10b, 3d (pair 7), 8e, 4c, 4b, 4d, 8d row 5; `apps/web/app/signup/page.tsx`; `packages/contracts/src/platform-setup.ts` (roles); `apps/web/src/components/public-copy.ts` (pricing copy); the quote screen's copy when generation is off                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/advertising` | What is disclosed, not what is practised: AI tools may be used in editing and post-production, which tools and at which step is not yet published, a person directs every shoot and approves every delivered asset; synthetic imagery, voice or likeness is disclosed on the asset or in its caption plus the platform label; a paid placement in our or a client's ad account names the advertiser of record and carries the platform's ad and paid-partnership labels, and none runs today; testimonials carry attribution and date with permission on file and today none appears; the software film is an animation of designed frames with no generated person, place or product and the studio pages carry no photograph or film; software outputs are agent-produced with the model route, provider and cost on the receipt, a generated image needs a user-editable description, on mustbeviral.com no generation run can start; no promise of reach or results                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `brand/context.md` section 8d (all five rows), 4b, 4c, 6, 9 and 13; `docs/ux/EXPERIENCE_CONTRACT.md`; `apps/core/wrangler.jsonc` (production provider runs off); `films-program-2026-10-02.md` (the software film is rendered from HTML keyframes); `public-copy.ts` (`studioHeroMedia` is null)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Not stated anywhere, because nothing in the repository supports it: a street address, hours, a
cookie banner or consent tool, a tracking pixel or analytics service, a sale of personal data, a
model-training stance (section 4d forbids claiming one), a governing law, an arbitration clause, a
warranty, a retention period, a children's clause, a right of access or deletion the code does not
implement, or a promise that a page will be kept up to date. Each page carries the date it
describes instead.

Two checks ran over the pages before the review. A cited fact pack (three readers, each fact
re-verified against its file and line: 426 facts, 40 rejected as overstated and not used, 47
recorded absences) and an adversarial pass (six refuters trying to break every sentence against
the registry and the code, then a judge) produced sixty-eight overlapping findings; each was
applied by rewriting or removing the sentence, except two answered in this record (the terms page
describes both offers on one page because the directive asks for one terms route, and the
production response headers are recorded under Release): the promissory "changes when the site
does" lines, an invented booking
clause, "invited operators only" where the code enforces no invitation at sign-in, a seat rule the
code does not implement (now named as a catalog rule), "generation is off in this environment"
(now "on mustbeviral.com"), a seven-day retention that was an acceptance window, a sign-out scope,
the processors the architecture names (Resend, the collaboration service, Workers Logs, Sentry and
OpenTelemetry when configured), the record types the schema holds, the missing "where" of the AI
tools disclosure, the add-on grammar and the section 7 order. `brand/context.md` section 8b and its
section 13 item still record the legal pages as blocked; the owner directive of 2026-10-02
supersedes them for these three pages, and `brand/` is outside this packet's paths, so the
registry entry is left for the owner to close.

## The footer

`apps/web/src/components/public-footer.tsx`, on every public page: the home pages in both
languages, the studio pricing page, the software and plans pages, the three legal pages, and the
signed-out sign-in, request-access, password, verification, maintenance, unauthorized and not-found
screens. It carries the entity, the phone as a `tel:` link, the mail as a `mailto:` link, Houston,
Texas, and the three legal links; the studio footer adds its pricing page; one quiet last line
names the other surface ("Must Be Viral also makes software." on the studio, "Must Be Viral is also
a Houston content studio." on the software). On `/es` the legal block is marked `lang="en"`, links
the English pages in English and says "These pages are in English." The studio header now carries
Español alone (English on `/es`), the software header carries Plans alone and the plans page
Software alone, so neither pitch names the other outside the footer.

## The Full Package and the Spanish offer

The English Full Package carries the fourteen lines of `brand/context.md` section 7a in order, on
the home page and on `/pricing`. The Spanish Full Package carries the one approved Spanish sentence
that states its deliverables (section 3e, pair 3), which until now stood under the frame as the
cadence line; it moved into the offer, so the Spanish page adds no sentence and repeats none. The
six kinds of work stay off `/es`.

## The studio pricing page

`/pricing`: the two offers with their full lists, the add-ons at `+$200–$400 per shoot` and
`+$300–$600 per shoot` (drone included in the Full Package where applicable), the section 7b rule
that the exact figure inside each range is confirmed at booking, the turnaround sentence from
section 3d, and the same one action. It is in the sitemap and in `llms.txt` beside
`/software/pricing`, which stays the provisional catalog with charging named as off and no buy
button. No page per trade, ZIP or neighbourhood exists.

## The design as one system

The first screen on the home pages is the decision: the locked line, the two prices as titles in
the frame, one action in the one action colour with the phone as the only secondary. Under the
frame: the two offers in full, the pricing link, the cadence, six composed rows (the trade, the
situation the owner recognises, what we do, a hairline between rows, no cards), the objection with
its answer, the close, the footer. Nothing animates; the only motion on the site is the software
film while it plays. Reduced motion keeps every word (the studio page's visible text is the same
length with and without the preference).

## The film

No film shipped. No Higgsfield tool is connected to this session, the vault lists no
`mustbeviral-higgsfield` bundle and no `HF_*` name, and the inbox holds no credential, so the
runner in the owner's `briefs/hero/films/` was not run and nothing was spent. The studio hero keeps
the composed frame. The one remaining sentence: save `HF_API_KEY_ID` and `HF_API_KEY_SECRET` into
`%USERPROFILE%\.agent-secrets\inbox\`, one secret per file, and ingest them.

## Not done, and why

- The founder read-only smoke: the vault lists no founder credential by name, so no sign-in on
  staging or production was attempted.
- The Workers: nothing to deploy. `cutover-2026-10-02.md` (pull request 60, merged before this
  run) records the Core Workers deployed from `20b6e1e` with `global_fetch_strictly_public`
  (staging version `8c90ddc3-d5da-49ef-9d96-31e5ceda04c6`, production
  `d69e987c-90a6-43f5-ae45-a397c206ddf3`), and `git diff --stat 20b6e1e..HEAD` over
  `apps/core`, `apps/collaboration`, `packages/contracts`, `packages/domain` and
  `packages/provider` is empty, so the deployed Core is the current source. Both health routes
  answered `status` ok on 2026-10-02. Collaboration stays on its 2026-09-18 version, as that
  record says. Erratum: `films-program-2026-10-02.md`, `release-films-2026-10-02.md` and the
  packet's next action written the same day still said the Core config differed from the deployed
  sources by that flag; that was true of the shas they compared against (`7d740ae`, `fe36f20`), not
  of the live Workers after the cutover. The next action is corrected in this change.

## Gates

Code head `79134f9fd78510f0dcc6db71a9559592a4cb6c18` on branch `codex/public-site-finish` (pull request
ashrunscode/MustBeViral#63, base `e058983`). The review repair `043c133` changes one privacy sentence after it; every other later commit
changes only evidence. The root `llms.txt` and `docs/STATUS.md` in the first commit are the
generator's output (`pnpm docs:generate`); `llms.txt` is listed in the packet's allowed paths, and
`origin/main` at `e058983` failed `generated:check` on both files because the previous merge
updated the next action without regenerating them.

| Gate                                                                                                                                                 | Environment                                                                                                    | Exit                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm agent:verify` (format, governance, governance tests, security, task graph, lint, typecheck, unit, integration, build, design, `supabase:test`) | author clone `C:\dev\mbv-ui-20261001` at `79134f9`, local database holding this session's canvases             | 1 from the Supabase CLI only: every suite and every turbo task passed and the database tests reported Result PASS before the CLI's telemetry shutdown timed out; a rerun of `pnpm supabase:test` alone exited 0; database tests 61 files, 1181 tests |
| Web unit tests, typecheck, lint; repository `format:check` and `governance:check` (generated documents regenerated and current)                      | author clone                                                                                                   | 356 passed (62 files); 0; 0; 0                                                                                                                                                                                                                       |
| Preview journeys, desktop and mobile projects                                                                                                        | author clone, `PLAYWRIGHT_PORT=3113`                                                                           | 112 passed, 40 skipped (connected specs skip there)                                                                                                                                                                                                  |
| Connected journeys                                                                                                                                   | author clone against the local harness                                                                         | 17 passed                                                                                                                                                                                                                                            |
| `corepack pnpm install --frozen-lockfile`, `pnpm verify`, `pnpm supabase:test`                                                                       | fresh single-worktree clone `C:\dev\mbv-verify-79134f9` at `79134f9`, branch `main`                            | 0, 0 and 0; database tests 61 files, 1181 tests, against the local database that holds canvases, not reset                                                                                                                                           |
| `corepack pnpm install --frozen-lockfile`, `pnpm verify`, `pnpm supabase:test` on the review repair                                                  | fresh single-worktree clone `C:\dev\mbv-verify-043c133` at `00e1991`, whose source is `043c133`, branch `main` | 0, 0 and 0; database tests 61 files, 1181 tests                                                                                                                                                                                                      |

## Browser proof

`browser-proof-2026-10-02d/README.md` and `public-probes.json`, on the local harness, signed out,
taken against code head `043c133` (the last source commit, with the footer line and the final
legal copy).
Ten routes (`/`, `/es`, `/pricing`, `/software`, `/software/pricing`, `/privacy`, `/terms`,
`/advertising`, `/login`, `/signup`) at 375, 768, 1280 and 1920: no horizontal scroll in any of
the forty cells, one `main`, h1 28px, the footer with the three legal links and the unpublished
street address on every route, every footer link at least 44 by 44px, no console error. Home at
375px: the action at 227px and both prices in the frame at 398px and 473px of 812, before any
included line; from 768px both prices beside the lead. Six composed rows on `/` and none on
`/es`; the offers packed to the top of their columns. The studio header carries Español alone,
the software header Plans alone, the legal pages the wordmark alone. Reduced motion runs no
animation and keeps every word (the studio page's visible text is the same length with and
without the preference). Forced colours keep the row and footer hairlines. Every keyboard stop on
`/`, `/pricing` and `/privacy` shows the 2px ring. `sitemap.xml` lists the eight public pages;
`llms.txt` carries the add-on ranges, the pricing page, the entity, the unpublished street address
and the three legal pages. Preview journeys 112 passed and 40 skipped; connected journeys 17
passed.

## Independent review

The read-only Codex review of the exact pull-request head, isolated as before (fresh shell with credential-like variables removed, every tool and network surface disabled, a detached clone of tracked files only), is recorded with its sha and verdict in `merge-review-site-2026-10-02.md` once it has run. Nothing merges before a PASS.

## Release

The staging and production deployments from a clean clone of the merge commit, the smoke of every public route including the three legal pages and both pricing pages, the production response headers for the eight public paths, the served `data-dpl-id` values and the rollback targets are recorded in `release-site-2026-10-02.md` after the merge. Until then production serves `95deda5` (`dpl_Bw8Txy9Atvk8yoBocUxv3AEZW5EN`) and staging `dpl_HK4J6VQAPKx8Hp8ymxjGUwsLfXbg`.

## Not crossed

No Higgsfield call, no spend, no key printed; no DNS, domain, traffic or cutover change; no Worker
deploy; no new variable and no environment value copied or printed; no production database write;
no signup collection, generation, charging, posting or provider spend; no email sent and no form
added; no new Spanish sentence; the locked lines and prices unchanged; no price, claim, address or
hour that `brand/context.md` sections 4 and 7 do not state; no deletion of data, branches, backups
or another session's work; nothing under `briefs/` or `.playwright-mcp/` committed.
