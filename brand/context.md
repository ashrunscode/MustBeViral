---
brand: MustBeViral Studio
schema: brand-context/v1
version: 1
updated: 2026-09-15
owner: operator (the repository's term for the accountable human; no personal name in public copy)
languages: [en]
approval_required: true
status: draft
---

# MustBeViral Studio — GTM context

Single source of truth for marketing, copy, email, SEO and sales work in this repository.
Rules: cite a repo file or the owner for every fact; write `[OWNER-INPUT-NEEDED]` where neither exists and log it in section 13; never invent addresses, hours, prices, claims, ratings or consent states. The design brief is `brand/BRAND.md`.

**Deliberate deviation from the four-file `brand/` contract.** This repository already owns its design tokens (`packages/ui/src/tokens.ts`, emitted as CSS custom properties in `packages/ui/src/styles.css`) and its font loaders (`apps/web/app/layout.tsx`, `next/font/google`). Duplicating those values into `brand/tokens.css` and `brand/fonts.ts` would create a second source of truth, so those two files are deliberately absent; `brand/BRAND.md` points at the live files instead.

**This repository is public.** No customer records, no revenue figures, no internal account identifiers and no secrets belong in `brand/`.

# 1. Brand & positioning

- Legal entity / DBA: `[OWNER-INPUT-NEEDED]` — What legal entity and DBA sign contracts, the email footer and the legal pages? (`package.json` carries only `name: mustbeviral-studio` and `license: UNLICENSED`.)
- Product name in running copy: **MustBeViral Studio** (`PROJECT_STATE.yaml` product_name; `README.md`; `apps/web/app/layout.tsx` metadata title).
- Internal engine name: **ViralGraph** — an engine, not a customer-facing product (`PROJECT_STATE.yaml` internal_engine_name; `README.md`).
- Locked tagline / one-liner: **"You brief. Agents produce. You approve every dollar."** (`.superdesign/brand-id.md`). Exact wording and punctuation; never paraphrased.
- Accepted product promise, long form: "from a trustworthy campaign brief to a reviewable, versioned launch pack in one transparent visual workflow" (`docs/product/PRODUCT_CONTRACT.md`).
- Shipped landing headline, currently live and different from the tagline: "From a validated brief to reviewable ads in one transparent workflow" (`apps/web/src/components/landing-page.tsx`). See section 13; the owner decides which is canonical.
- Essence / promise: "Quiet authority that spends your money carefully." (`.superdesign/brand-id.md`).
- Category, how buyers describe the need: agentic creative operations for DTC growth teams; the concrete job is a Meta Campaign Launch Pack (`.superdesign/brand-id.md`; `docs/product/PRODUCT_CONTRACT.md`).
- Business model / revenue lines: P0 exercises the ledger with no automated customer charging; P1a pilot is a setup fee, a monthly subscription and a prepaid usage wallet, with usage at landed provider cost plus 25% (`docs/architecture/EXECUTION_PROVIDERS_AND_BILLING.md`).
- Enemy / alternative we replace: the black-box credit burner — "AI creative tools burn credits in a black box and hand you a gallery of guesses" (`.superdesign/brand-id.md`). Hero: the accountable operator.
- Differentiators (3), each traceable to described behaviour:
  1. **Quote before spend.** No run starts without explicit confirmation of an unexpired quote, and the confirm control names the amount (`docs/product/PRODUCT_CONTRACT.md` trust contract; `.superdesign/design-system.md` confirm bar).
  2. **Lineage and an immutable receipt.** Pinned revision, model route, provider, price basis and per-event cost stay inspectable (`docs/product/PRODUCT_CONTRACT.md`; `.superdesign/design-system.md` receipt drawer).
  3. **Review composed ads, not files.** The buyer unit is one Meta ad per placement, judged after production rather than as a gallery of unnamed artifacts (`docs/ux/EXPERIENCE_CONTRACT.md`, Live Review).
- Name styling: the repository writes the product as one word, "MustBeViral Studio", in code and docs (`README.md`, `PROJECT_STATE.yaml`, `apps/web/src/components/landing-page.tsx`). The 2026-09-15 workstation skills audit records the brand in the spaced form "Must Be Viral" (`memory.md` section 3 of that audit; the report is workstation-local and not part of this repository). Conflict logged in section 13; do not resolve it inside copy. Never invent a short form — "mbv" appears only as a CSS class prefix in `packages/ui/src/styles.css`, never as a public name.

# 2. ICP & personas

Launch market: US, English-language, Shopify-first DTC/e-commerce brands with a 1–5 person growth or creative team (`docs/decisions/ADR-0001-DTC-FIRST.md`; `docs/product/PRODUCT_CONTRACT.md`).

| Persona id                     | Cares about                                        | Challenge                                                    | Value we promise                                                                            | Channel                | Language |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ---------------------- | -------- |
| `p1-dtc-founder`               | Every dollar of creative spend and what it returns | Wears the growth hat part-time; cannot absorb an opaque bill | The maximum charge is named before any provider spend begins                                | `[OWNER-INPUT-NEEDED]` | en       |
| `p2-head-of-growth`            | Creative throughput against meaningful Meta spend  | Launch cadence is capped by production, not by ideas         | A validated brief becomes three reviewable concepts with placements in one workflow         | `[OWNER-INPUT-NEEDED]` | en       |
| `p3-performance-creative-lead` | Brand and claim discipline surviving volume        | Reviewing raw asset files instead of the ad a buyer will see | Composed Review shows Feed, Stories and Reels as buyers see them, with QA findings attached | `[OWNER-INPUT-NEEDED]` | en       |

- Anti-persona / never target: agencies and agency client-portal workflows, deliberately excluded until the DTC workflow earns repeat paid use (`docs/decisions/ADR-0001-DTC-FIRST.md`); self-service signups, because enrollment is closed and admission is manual and allowlist-based (`apps/web/app/signup/page.tsx`).
- Segment sizes (source + date): `[OWNER-INPUT-NEEDED]` — Is there a sized target list of US Shopify-first DTC brands, and where does it live?
- Outbound channel per persona: `[OWNER-INPUT-NEEDED]` — Which channels may we actually use for these personas, given that no CRM and no marketing-email system exist in this repository?

# 3. Voice & tone

- Personality, the five recorded axes (`.superdesign/brand-id.md`): quiet not loud · precise not playful · plain not decorated · proving not promising · respectful not friendly.
- Voice: declarative, present tense, zero hedging. Short sentences that carry one fact each. Capability stated plainly, never inflated. Money is always specific. Fear named honestly (admin drown, budget burn); relief delivered structurally through quote, cap and receipt (`.superdesign/brand-id.md`).
- Tone by channel: site and product — quiet and factual, sentence case, no exclamation marks (`.superdesign/brand-id.md`). Email — transactional register only today, because no marketing email system exists (`packages/email/src/index.ts`; section 9). Social, SMS, GBP, print — no approved tone, because no such channel exists in this repository; see section 9.
- Language scope: English only. The accepted launch market is US, English-language (`docs/decisions/ADR-0001-DTC-FIRST.md`), so no Spanish register is defined. `[OWNER-INPUT-NEEDED]` — If a Spanish surface is ever planned, which register and which market?
- Voice application formulas (`.superdesign/brand-detail.md`, section 4): feature line = capability + evidence; status line = state + consequence + exit; numbers always exact and set in the evidence face, never rounded or dressed up.

Do / Don't pairs. Each "Do" is either shipped repository copy or a direct application of a recorded rule; the "Why" names the rule.

| #   | Situation                     | Do (EN)                                                                                                                                                                                                                                                                            | Don't (EN)                                                      | Why                                                                                                                                                                                        |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Explain the product           | "MustBeViral Studio turns approved product truth, brand constraints, and offer metadata into three composed Meta ad concepts — stills, adaptations, copy, and motion — with a named price before any provider spend begins." (shipped, `apps/web/src/components/landing-page.tsx`) | "Unleash AI magic and supercharge your creative pipeline."      | capability plus evidence; "magic", "supercharge" and "unleash" are on the kill-list (`.superdesign/brand-detail.md`)                                                                       |
| 2   | Name the cost                 | "Confirm $4.20 run."                                                                                                                                                                                                                                                               | "Affordable AI creative, starting today."                       | the confirm control carries the amount and money is always specific (`.superdesign/brand-id.md`; `.superdesign/design-system.md`)                                                          |
| 3   | Report a partial failure      | "static-2 failed. Two verified statics retained. Retry is free."                                                                                                                                                                                                                   | "Oops! Something went wrong, please try again."                 | state plus consequence plus exit; recovery is local and names retained work (`.superdesign/brand-detail.md`; `docs/ux/EXPERIENCE_CONTRACT.md`)                                             |
| 4   | Describe review               | "Judge Feed, Stories, and Reels placements as buyers see them, not as unnamed files." (shipped, `apps/web/src/components/landing-page.tsx`)                                                                                                                                        | "Get a beautiful gallery of AI-generated options!"              | oppositional framing, and no exclamation marks (`.superdesign/brand-id.md`)                                                                                                                |
| 5   | Turn someone away             | "MustBeViral Studio is in closed evaluation for DTC marketing teams. Self-service signup is not enabled, and creating an account here will not succeed." (shipped, `apps/web/app/signup/page.tsx`)                                                                                 | "Join the waitlist, spots are filling fast!"                    | honest state, no fake urgency (`.superdesign/brand-detail.md`)                                                                                                                             |
| 6   | Talk about progress           | Name the state: "generating 2/3".                                                                                                                                                                                                                                                  | Show a percentage the system does not actually know.            | progress is real; no fake percentages (`.superdesign/brand-id.md`; `docs/ux/EXPERIENCE_CONTRACT.md`)                                                                                       |
| 7   | Mention privacy or compliance | State the mechanism: media is private by default and is copied into private storage after verification.                                                                                                                                                                            | "Bank-grade security. Your data is never used for AI training." | trust markers are furniture, not trophies, and per-route training and retention posture is still privacy-gated (`.superdesign/brand-detail.md`; `docs/research/MODEL_CATALOG_EVIDENCE.md`) |

- Kill-list, never in any surface. Repository-sourced (`.superdesign/brand-id.md`, `.superdesign/brand-detail.md`): exclamation marks · "magic" · "supercharge" · "unleash" · "revolutionary" · discount language of any kind · fake urgency · rounded or vague money · hedging. Added from the `brand-context` skill defaults, none of which conflict with the above: elevate · seamless · one-stop · solutions · leverage · cutting-edge · state-of-the-art · all-caps shouting · "in today's fast-paced world" and similar filler.
- Rewrite test: if the sentence does not carry one verifiable fact, cut it.

# 4. Claims

- Approved claims, each tracing to a repository file:
  - "No run starts without explicit confirmation of an unexpired quote." (`docs/product/PRODUCT_CONTRACT.md`, trust contract)
  - "Nothing presented as generated is a hidden mock or silent fallback." (`docs/product/PRODUCT_CONTRACT.md`)
  - Media is private by default and is copied from temporary provider storage into private storage immediately after verification (`docs/product/PRODUCT_CONTRACT.md`; `docs/architecture/SYSTEM_OVERVIEW.md`).
  - "A changed input invalidates only affected descendants; approved unaffected artifacts remain inspectable." (`docs/product/PRODUCT_CONTRACT.md`)
  - The output bundle: three master static concepts; adaptations at 1080×1350, 1080×1080 and 1080×1920; three copy sets; one 6–10 second 9:16 motion variant; a QA report; and an export with deterministic names, manifest and immutable receipt (`docs/product/PRODUCT_CONTRACT.md`).
  - The three landing proof points, verbatim (`apps/web/src/components/landing-page.tsx`).
- Conditional claims and the condition each depends on:
  - Pilot pricing may be presented only as written in section 7, and only while `docs/architecture/EXECUTION_PROVIDERS_AND_BILLING.md` still states it.
  - Page-experience numbers (p75 LCP, INP, CLS) are budgets, not results: they are measured only after an authorized P1a production deploy (`docs/delivery/QUALITY_GATES.md`). Never publish them as achieved.
  - Speed figures such as a first reviewable static pack in under ten minutes are internal engineering gates, not proven customer outcomes (`docs/delivery/QUALITY_GATES.md`). Do not publish until the owner confirms the gate is met and evidenced.
- Banned claims and topics: any promise that content will go viral or hit a performance number; "best", "fastest" or "cheapest" superlatives; comparative claims naming a competitor; discount or coupon language; any statement that self-service signup exists while enrollment is closed (`apps/web/app/signup/page.tsx`); any claim that customer data is never used for model training, because routing posture is per-model and privacy-gated (`docs/research/MODEL_CATALOG_EVIDENCE.md`); availability or uptime promises; customer names, logos or testimonials without written permission on file; any money figure inconsistent with the per-run cost story (`.superdesign/design-system.md`).
- Pricing disclosure rule: only the exact figures in section 7 may appear in public copy. Usage is described as landed provider cost plus a stated margin, never as "credits". Money is exact and set in the evidence face (`.superdesign/brand-detail.md`).
- Proof points and testimonials, attributed, dated, permission on file: none exist in the repository. `[OWNER-INPUT-NEEDED]` — Are there pilot users whose name, quote or logo we have written permission to publish?
- Owner and staff anonymity rule: the repository refers only to "the operator" and never to a person (`governance/evidence/WP-D0-001/brand-pivot-record.md`; `AGENTS.md`). `[OWNER-INPUT-NEEDED]` — May a named founder appear in public copy and outbound email, or should everything be signed by role?

# 5. Visual

- Tokens, live and single source: `packages/ui/src/tokens.ts` — the `lightfield` token object — emitted as CSS custom properties in `packages/ui/src/styles.css` and loaded through `@mustbeviral/ui/styles.css` in `apps/web/app/layout.tsx`. **No `brand/tokens.css` exists and none should be created**; adding one would duplicate these values.
- Design brief: `brand/BRAND.md`. Executable design system: `.superdesign/design-system.md`. Identity and psychology: `.superdesign/brand-id.md` and `.superdesign/brand-detail.md`. Accepted UX authority: `docs/ux/EXPERIENCE_CONTRACT.md`.
- Fonts, live and single source: `apps/web/app/layout.tsx` loads Geist and Geist Mono through `next/font/google` and exposes them as `--font-sans` and `--font-mono`. **No `brand/fonts.ts` exists and none should be created.** The identity documents name Untitled Sans and DM Mono as the licensed target faces with Geist as the interim implementation face (`.superdesign/brand-detail.md`; `docs/ux/EXPERIENCE_CONTRACT.md`); Geist is what actually ships today.
- Logo assets path: none found. There is no `apps/web/public/` directory and no `brand/logo/`. The only wordmark is the text string "MustBeViral Studio" set in the UI (`apps/web/src/components/landing-page.tsx`; the `.studio-wordmark` rule in `apps/web/app/globals.css`). `[OWNER-INPUT-NEEDED]` — Is there a logo mark, and where are its SVG, mono and reverse variants?
- Photo rules: the only imagery is the real product UI, presented as evidence; no stock art and no abstract 3D (`.superdesign/brand-detail.md`, section 1). Reference captures of the visual north star live in `.superdesign/reference/` and are study material, never shipped assets.
- Token sets: one. There is no separate print set.

# 6. Locations, contact, availability

MustBeViral Studio is a software product with no physical customer location, so the usual address-and-hours table does not apply. What the repository does pin:

| Surface             | Value                                                     | Source                                 |
| ------------------- | --------------------------------------------------------- | -------------------------------------- |
| Production web      | `mustbeviral.com` and `/studio`                           | `docs/architecture/SYSTEM_OVERVIEW.md` |
| Production API      | `api.mustbeviral.com`                                     | `docs/architecture/SYSTEM_OVERVIEW.md` |
| Staging web and API | `staging.mustbeviral.com` · `api-staging.mustbeviral.com` | `docs/architecture/SYSTEM_OVERVIEW.md` |

- Production traffic state: the live production environment is still the previous generation; the current foundation is deployed only on SSO-protected provider URLs and an unrouted worker URL, with signup, generation, provider, queue and charge behaviour off (`PROJECT_STATE.yaml`, `environments.production`). Do not describe the current product as generally available.
- Legal postal address for an email footer: `[OWNER-INPUT-NEEDED]` — What postal address may appear in an email footer and on legal pages?
- Support or sales phone: `[OWNER-INPUT-NEEDED]` — Is there a customer phone number, or is email the only contact channel?
- Support hours and their scope: `[OWNER-INPUT-NEEDED]` — What response-time commitment, if any, may be stated to pilot customers?
- Timezone: `[OWNER-INPUT-NEEDED]` — Which timezone should customer-facing times use? Repository evidence timestamps are UTC (`PROJECT_STATE.yaml`).
- Service-area rule: not applicable. One market, US English (`docs/decisions/ADR-0001-DTC-FIRST.md`). Never generate per-city or per-ZIP pages.

# 7. Offers, pricing, CTAs

- Live offer: invitation-only closed evaluation. "Enrollment is invitation-only while the launch pack is in closed evaluation." (`apps/web/src/components/landing-page.tsx`); admission is manual and allowlist-based (`apps/web/app/signup/page.tsx`).
- Pilot pricing, P1a (`docs/architecture/EXECUTION_PROVIDERS_AND_BILLING.md`, echoed on the landing page and in `packages/billing/src/stripe-settlement.ts`): **$500 setup · $149 per month · prepaid usage wallet.** Usage begins at landed provider cost plus 25% with model-specific minimums.
- P0 charges nothing automatically (`docs/architecture/EXECUTION_PROVIDERS_AND_BILLING.md`). Never imply that a card is charged during evaluation.
- Public dollar figures allowed, exact, no others: `$500` and `$149/mo`. Per-run figures may appear only inside the product, as real quoted or receipted amounts.
- Expired or proposed offers never to present as live: none recorded. Any figure not in this section is proposed, not live.
- Primary CTA (EN): "Sign in to Studio". Secondary CTA (EN): "Request access". Both shipped (`apps/web/src/components/landing-page.tsx`).
- Known CTA inconsistency: "Request access" links to `/signup`, which states that enrollment is closed and that no request is collected there (`apps/web/app/signup/page.tsx`). Logged in section 13; do not write copy promising that a request will be received until it is.
- Offer language rules: no discount language ever, no coupon-speak, no fake urgency, no "guaranteed" (`.superdesign/brand-detail.md`). Every spend is named before it happens (`.superdesign/brand-id.md`).

# 8. Legal & consent

- Privacy URL · Terms URL: `[OWNER-INPUT-NEEDED]` — What are the live privacy policy and terms URLs? The landing information architecture already requires policy links (`docs/ux/CANVAS_AND_SCREEN_STATES.md`) but none exist in the code.
- Email footer postal address: `[OWNER-INPUT-NEEDED]` — see section 6.
- Unsubscribe mechanism: none exists. The only email path is a fail-closed transactional adapter (`packages/email/src/index.ts`) plus Resend as Supabase Auth SMTP (`docs/architecture/SYSTEM_OVERVIEW.md`). Any marketing send needs a working `List-Unsubscribe`, a one-click link and a footer address **before** the first send.
- SMS: not a channel. No SMS provider, number or registration exists in the repository. `[OWNER-INPUT-NEEDED]` if SMS is ever wanted.
- Consent contract reference: none in the repository. `[OWNER-INPUT-NEEDED]` — Where is consent recorded per contact point, channel and purpose? Until that exists, every contact point is treated as blocked for marketing purposes and only exact-scope transactional mail is eligible.
- Suppression sources, all of which override any grant: unsubscribe, complaint, hard bounce, do-not-contact, invalid contact point. `[OWNER-INPUT-NEEDED]` — Which system will hold the suppression list?
- Review-request rule: no incentive of any kind and no gating; ask everyone or no one.
- Sensitive data and rights: the product "does not infer permission to use unlicensed assets, unsupported claims, sensitive likenesses, or prohibited advertising content" (`docs/product/PRODUCT_CONTRACT.md`), and a brief cannot execute until asset-rights attestations pass validation. Customer media, signed URLs, raw environment values and account tokens never appear in docs, logs, evidence, fixtures or messages (`AGENTS.md`).
- Disclosures required by channel: `[OWNER-INPUT-NEEDED]` — Does any planned surface need an AI-generated-content disclosure or an advertising label beyond the ad platform's own requirements?

# 9. Channels & tools

- CRM: none in the repository. `[OWNER-INPUT-NEEDED]` — Is there a CRM for this brand, and which portal, agent user and write policy apply? Until that is answered, no CRM write may be proposed.
- Post-sale system of record: Supabase Postgres owns identity-linked relational truth, revisions, runs, quotes, ledger entries and audit events; private R2 owns media bytes (`docs/architecture/SYSTEM_OVERVIEW.md`). Marketing tooling never becomes a second authority.
- Email sender: Resend, used both for Supabase Auth SMTP and for transactional delivery (`docs/architecture/SYSTEM_OVERVIEW.md`); the adapter fails closed without an API key (`packages/email/src/index.ts`). The from-address appearing in tests is `studio@mustbeviral.com` (`packages/email/src/index.test.ts`), which is a fixture and not a confirmed production sender. `[OWNER-INPUT-NEEDED]` — What is the production from-address, and what DMARC policy is published for its domain?
- SMS sender: none.
- Social publisher: none in the repository; no scheduling tool is configured.
- Analytics and attribution: a Web Vitals reporter in the app (`apps/web/src/components/web-vitals-reporter.tsx`) plus Sentry and OpenTelemetry for errors, traces and alerts (`docs/architecture/SYSTEM_OVERVIEW.md`). There is no product analytics and no marketing attribution. Paid acquisition stays off until attribution is verified.
- Deploy targets, as context for anything that links to the product: `apps/web` on Vercel; `apps/core` and `apps/collaboration` on Cloudflare Workers; Supabase Postgres; private R2 (`README.md`; `docs/architecture/SYSTEM_OVERVIEW.md`; corroborated by the 2026-09-15 workstation skills audit, `stack.md` section 3).
- Design tooling: SuperDesign artifacts in `.superdesign/` (`hifi/` frames, `reference/` study captures) with `@superdesign/cli` as a dev dependency (`package.json`). The CLI is optional tooling, not an authority (`docs/ux/EXPERIENCE_CONTRACT.md`).

# 10. CRM object mapping

No CRM exists for this brand in the repository, so there is no mapping to record yet.

| Concept               | CRM object             | Key properties         | Pipeline / stage       | Owner    | Notes                                                                               |
| --------------------- | ---------------------- | ---------------------- | ---------------------- | -------- | ----------------------------------------------------------------------------------- |
| Invited pilot account | `[OWNER-INPUT-NEEDED]` | `[OWNER-INPUT-NEEDED]` | `[OWNER-INPUT-NEEDED]` | operator | Accounts are provisioned manually in Supabase Auth (`apps/web/app/signup/page.tsx`) |

- `[OWNER-INPUT-NEEDED]` — If a CRM is adopted, which objects, properties and pipeline stages represent an invited pilot account?
- Never mapped to a CRM under any circumstances: customer media, signed URLs, provider request or artifact identifiers, ledger rows, workspace secrets, or any row copied out of Supabase. Consent states are never copied in from another system.

# 11. Approved examples

- Landing page copy: `apps/web/src/components/landing-page.tsx` (shipped).
- Refusal and status copy: `apps/web/app/signup/page.tsx`, `apps/web/app/maintenance/page.tsx`, `apps/web/src/components/status-screen.tsx` (shipped).
- Operator-approved high-fidelity frames, approved 2026-08-17: `.superdesign/hifi/composed-review-desktop.html` and `.superdesign/hifi/composed-review-mobile.html` (`docs/ux/EXPERIENCE_CONTRACT.md`, visual approval gate). The other frames in `.superdesign/hifi/` are preview fixtures, not approved marketing surfaces.
- Email: none approved. `[OWNER-INPUT-NEEDED]` — Is there an approved invitation or onboarding email to reuse as the reference example?
- Social, GBP, print, ads: none exist.

# 12. KPIs and objectives

Priority order and targets as recorded in `docs/delivery/QUALITY_GATES.md` (P0 validation gates) and `docs/product/PRODUCT_CONTRACT.md`. These are product-validation gates, not marketing vanity metrics, and none may be published as an achieved result until the owner confirms the evidence.

| Objective (priority order)                 | KPI                                                                             | Source                             | Target                                    | Cadence              |
| ------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------- | -------------------- |
| 1. Prove the workflow completes unassisted | Qualified users completing brief, quote, run and review without help            | `docs/delivery/QUALITY_GATES.md`   | at least 80%                              | per evaluation round |
| 2. Prove the output is usable              | Jobs producing one or more usable concepts under the registered rubric          | `docs/delivery/QUALITY_GATES.md`   | at least 70%                              | per evaluation round |
| 3. Prove the economics                     | Landed cost per usable launch pack                                              | `docs/delivery/QUALITY_GATES.md`   | at most $5                                | per pack             |
| 4. Prove the speed                         | Time to first reviewable static pack                                            | `docs/delivery/QUALITY_GATES.md`   | median at most 10 min, p90 at most 15 min | per run              |
| 5. Prove paid demand                       | Qualified DTC customer or design partner with durable evidence of intent to pay | `docs/product/PRODUCT_CONTRACT.md` | at least one                              | per evaluation round |
| 6. Marketing objective                     | `[OWNER-INPUT-NEEDED]`                                                          | —                                  | —                                         | —                    |

`[OWNER-INPUT-NEEDED]` — What marketing objective and KPI should GTM artifacts declare in their front-matter, given that no acquisition channel is live?

# 13. Open items (needs-owner-input)

- 2026-09-15 Legal entity and DBA for contracts, footers and legal pages (section 1) — open
- 2026-09-15 Canonical public headline: the locked tagline versus the shipped landing h1 (section 1) — open
- 2026-09-15 Brand name form: the repository writes "MustBeViral", the workstation memory audit records "Must Be Viral" (section 1) — open
- 2026-09-15 Outbound channel and sized target list per persona (section 2) — open
- 2026-09-15 Whether a Spanish surface is needed at all, and in which register (section 3) — open
- 2026-09-15 Publishable pilot users, quotes or logos with written permission (section 4) — open
- 2026-09-15 Named founder in public copy versus role-only signature (section 4) — open
- 2026-09-15 Logo mark and its SVG, mono and reverse variants (section 5) — open
- 2026-09-15 Postal address, support phone, support hours and their scope, and the customer-facing timezone (section 6) — open
- 2026-09-15 The "Request access" CTA links to a page that collects nothing (section 7) — open
- 2026-09-15 Privacy and terms URLs; the landing information architecture already requires policy links (section 8) — open
- 2026-09-15 Consent record location and suppression-list system; until then every contact point is treated as blocked for marketing (section 8) — open
- 2026-09-15 AI-generated-content or advertising disclosure requirements per surface (section 8) — open
- 2026-09-15 Production email from-address and its published DMARC policy (section 9) — open
- 2026-09-15 CRM existence, portal, agent user and object mapping (sections 9 and 10) — open
- 2026-09-15 Approved reference email (section 11) — open
- 2026-09-15 Marketing objective and KPI for GTM front-matter (section 12) — open
- 2026-09-15 Palette, status-colour and type divergence between the identity documents and the shipped tokens; both values are recorded in `brand/BRAND.md` and are deliberately not reconciled here — open
- 2026-09-15 The commit that adds `brand/`, `.agents/skills/` and `.claude/skills/` and edits `AGENTS.md` and `.prettierignore` touches paths outside the `allowed_paths` of `docs/delivery/ACTIVE_WORK_PACKET.yaml`, so the pull-request step `pnpm diff-scope:check` will fail until a scope amendment is committed and pushed separately, ahead of this change — open

# Changelog

- v1 (2026-09-15) — initial, from the `brand-context` skill templates (schema `brand-context/v1`). Sections 1 to 13 all present and filled from repository files plus the 2026-09-15 workstation skills audit. `brand/tokens.css` and `brand/fonts.ts` deliberately not created because the repository already owns both sources. Open items: 19.
