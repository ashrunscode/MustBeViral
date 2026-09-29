# The Lightfield Standard — Canonical Teardown Reference for MustBeViral Studio

_The single source of truth for reproducing lightfield.app's brand, visual, workflow, and copy system. Every value is exact. Substitute "MustBeViral" for "Lightfield" and creator/content nouns for CRM/sales nouns, but preserve the grammar, tokens, and rhythm verbatim._

---

## 1. Identity psychology

**The core positioning bet.** 2026 SaaS design split into two camps. Lightfield committed 100% to the **EDITORIAL / warm-paper camp** (Notion, PostHog, Anthropic) and deliberately rejected the **TECHNO-FUTURIST camp** (Linear, Cursor, Attio, Stripe, Vercel, Ramp — dark-mode-by-default, one electric neon accent, shader gradients, bento grids, heavy motion). The research thesis is explicit: _"both are winning, but picking one is non-negotiable"_ and blended half-committed aesthetics are the ones that fail. Techno-futurist sites "look identical within six months" — warm paper is the differentiation move.

**The hybrid twist that makes it read as "thoughtful."** Unlike Anthropic (zero blue, pure editorial), Lightfield grafts ONE cool blue accent `lab(74.96 -7.76 -38.41)` (#80bfff) onto editorial warmth — borrowing the techno camp's "one electric accent" discipline. Net perception: institutional trust of paper + a single note of technical precision (reinforced by DM Mono metadata and agent-work-as-evidence steps). This is why reviewers call it _"the most thoughtfully designed CRM available in 2026"_ and _"the one most likely to actually get used rather than abandoned."_

**Psychological levers (from Attio/Anthropic analysis):**

- **Restraint as positioning signal** — vast negative space says "we are calm and in control," the opposite of cluttered legacy tools. Budget whitespace as an intentional feature.
- **Progressive disclosure** — land users on ONE clean, already-populated result, never an empty form; engineer against the legacy "wall of intimidation."
- **Product-as-brand** — hero/section visuals are honest real product surfaces (tilted paper cards, agent step lists), not idealized abstract art. Run live-on-real-data demos as primary marketing assets.
- **Desire replaces obligation** — micro-interaction craft ("satisfying arrow bends, perfect shadows and timing") makes users _want_ to open the app.
- **Founder-led credibility** — no agency byline; in-house/founder-driven (CEO ran a web-design business by age 15, built Tome to 25M users). Transparency (weekly changelog, SOC2/HIPAA/ISO badges, founder testimonials, founder-pedigree framing) is itself a differentiation lever.

---

## 2. Layout & rhythm

**Grid & spacing.** Base spacing unit `--spacing: .25rem` (4px). Build all gaps as `calc(var(--spacing)*N)` (e.g. ×2 = 8px, ×6 = 24px at ≥801px). 12-column grid `grid-template-columns: repeat(12, minmax(0,1fr))`. Containers `--container-sm: 24rem`, `--container-3xl: 48rem`.

**Breakpoints.** `--breakpoint-lg: 1025px`, `--breakpoint-2xl: 1681px`, md ≈ 801px (mobile nav `md:hidden`, desktop nav `md:flex`). Media queries observed at 390, 801, 961, 1025, 1140, 1200, 1441, 1681px. Header padding = 16px (`p-4`).

_*The fixed product-page skeleton (identical across all 4 /product/* pages — reuse verbatim):_*

1. Eyebrow kicker ("Product" / "Get started in minutes")
2. Short H1 (3–7 words)
3. One-line subhead
4. CTA pair (filled Try free + quiet Book demo)
5. One supporting sentence
6. Full-bleed hero product screenshot (Sanity CDN, ~2700×1662)
7. Logo wall ("Trusted by…" + Reeva, Intent HQ, CashQ, Covent, Voker, 14.ai, New Generation — marquee-repeated)
8. Problem section = 3 numbered pain points ("01/02/03")
9. Solution / "Why Lightfield" numbered cards with images (mirror the pain count)
10. "Features" = alternating eyebrow-kicker + benefit-H3 + paragraph + screenshot blocks
11. (Some) testimonials
12. FAQ accordion
13. Closing CTA band — big headline + dual buttons

**Consistency of rhythm IS the brand.** The closing conversion band ("Join thousands of companies using Lightfield." + Try free) repeats verbatim at the bottom of nearly every page so every scroll ends on the same action.

**z-index token scale:** −1, 0, 1, 2, 3, 4, 5, 10, 20, 50, 100, 200, 999. Header = z-50; nav pill = z-100 (floats above its own fixed header); nav inner wrapper = z-10.

---

## 3. Type

**Families.** `--font-sans: untitledSans` (400 roman+italic); `--font-serif: untitledSerif` (400 roman+italic); `--font-mono: DM Mono` (400+500). Inter loaded (100–900) for secondary/UI context. `font-display: swap` on all.

**Fixed-px type scale (each token carries its own line-height / letter-spacing / weight-400):**

| Token | Size | Line-height | Tracking | Weight |
| ----- | ---- | ----------- | -------- | ------ |
| d4    | 32px | 1.15em      | −.035em  | 400    |
| h1    | 28px | 1.2em       | −.03em   | 400    |
| h2    | 24px | 1.25em      | −.02em   | 400    |
| h3    | 21px | 1.25em      | −.015em  | 400    |
| h4    | 19px | 1.3em       | −.01em   | 400    |
| lg    | 17px | 1.5em       | —        | 400    |
| base  | 15px | 1.5em       | —        | 400    |
| sm    | 13px | 1.5em       | —        | 400    |
| xs    | 12px | 1.45em      | —        | 400    |
| xxs   | 11px | 1.45em      | —        | 400    |

**Headings are ALWAYS weight 400 — never bold.** Negative tracking ladder: −.035 → −.03 → −.02 → −.015 → −.01em.

**Monocaps (DM Mono uppercase labels/eyebrows):** `--text-monocaps-xs: 10px/1em`, letter-spacing 1px, weight 500; `--text-monocaps-xxs: 9px/1em`, letter-spacing 1px, weight 500. Use for ALL metadata, labels, timestamps, counts, code-like accents. Never body/headlines.

**Tracking/leading tokens:** `--tracking-tight: -.025em`, `--tracking-wider: .05em`, `--leading-tight: 1.25`, `--leading-normal: 1.5`, `--leading-relaxed: 1.625`.

**Responsive behavior — single md jump, NO fluid clamp():** body text-sm(13px) → md:text-base(15px); subheads md:text-lg(17px) / md:text-h3(21px). **Hero H1 stays 28px at ALL breakpoints** — only alignment + color change (`text-center text-content-tertiary` → `lg:text-left lg:text-content-primary`).

**Font fallback metric overrides (kill CLS from swap):** untitledSans Fallback local(Arial) ascent 95.3% / descent 23.49% / line-gap 0% / size-adjust 105.15%. untitledSerif 102.25%/26.2%/95.79%. DM Mono 73.71%/23.03%/134.59%. Inter 90.44%/22.52%/107.12%.

---

## 4. Color / ink

**Paper/ink neutrals (exact lab + hex):** `--color-neutral-z0: lab(98.2716% 0 0)` = #fafafa (bg-primary); z1: `lab(96.5432% -.0000596 0)` = #f5f5f5 (bg-secondary, the 96.5 paper); z10: `lab(27.094%)` = #404040; z12: `lab(3.63782%)` = #0d0d0d (obsidian dark bg). bg-tertiary = white.

**Ink-alpha ladder (black transparencies — the master token):** t0 .02, t1 .04, t2 .06, t3 .08, t4 .12, t5 .16, t6 .25, t7 .35, t8 .5, t9 .6, t10 .75, t11 .85.

**Semantic ink mapping:** content-primary = t11 (.85); secondary = t9 (.6); tertiary = t10 (.75); quaternary = t8 (.5); subtle = t6 (.25); faint = t4 (.12); border-moderate = t4 (.12); border-subtle = t2 (.06).

**The single blue accent + ladder:** content-brand = blue-z5 = #80bfff = `lab(~74.96 -7.76 -38.41)`; brand-strong = blue-z8 = #3182d4. Ramp: z1 #e8f1fa, z4 #9fcefc, z5 #80bfff, z6 #5da8f5, z7 #4394e5, z8 #3182d4; blue-t2 #80bfff1f, blue-t3 #45a2ff3d. Full accent hues (red/orange/copper/yellow/lime/green/indigo/purple/magenta z-scales) exist but **blue is the sole UI accent.** Ration it: one primary action or one data highlight per view, never a section fill.

**Muted earth accents (Anthropic-style, DATA/EVIDENCE surfaces only):** model clay/fig/cactus/sky/heather/olive/manilla/kraft — categorical chips, agent-step tags, dashboards. Never on marketing chrome.

**Status:** content-success = green-z7 #49bf4c; content-error = red-z7 #f55434; input-error #e85959; grey-700 #747474; content-inverse = white; content-inverse-subtle #fff9. Author all colors in `lab()` with hex fallbacks (two declarations per token).

**Dark inverse washes:** inverse-subtle #ffffff0a → hover #ffffff0f.

---

## 5. Components

### Global nav (identical every marketing page)

Fixed, centered, frosted **pill**. Header: `fixed top-0 left-0 z-50 w-full flex justify-center p-4 transition-colors duration-300`. Nav: `navbar surface-before relative z-100 w-max rounded-[10px] py-1 overflow-visible hidden md:flex`, with `::before` carrying `before:inset-0 before:rounded-[10px] before:backdrop-blur-[17px] dark:before:backdrop-blur-[23px]`; `::before` background = `--color-surface-primary` = `lab(0% 0 0/.04)` (4% black wash), dark = #ffffff0a.

- **Structure:** Left: wordmark → Product (dropdown: 4 items) → Pricing → Docs → Resources (dropdown). Right: quiet "Log in" text link + filled "Try free" button. **Two-tier CTA everywhere.**
- **Nav list:** `ul: flex gap-3 pr-1 pl-4`. **Nav item:** `h-[25px] w-max rounded-[4px] bg-transparent text-xs(12px) px-[6px] text-content-secondary duration-100 ease-in-out hover:bg-transparent hover:text-content-primary` (60%→85% ink). Logo: `transition-colors duration-50 hover:text-content-secondary`.
- **Mobile nav pill:** `h-8.5(34px) w-full rounded-xl pr-1.5 pl-4 overflow-clip`, same backdrop-blur, `md:hidden`.

### Buttons (quiet gray-washes — NEVER colored fills)

- **Primary quiet ("Book a demo →"):** `duration-50 ease-out inline-flex items-center justify-center rounded-[6px] bg-interactive-secondary text-content-primary hover:bg-interactive-secondary-hover h-8(32px) gap-[6px] text-sm(13px) pr-[8px] pl-[10px] transition-colors`.
- **Secondary ("Try for free"):** same geometry, `bg-interactive-tertiary text-content-secondary hover:bg-interactive-tertiary-hover hover:text-content-primary`.
- **Asymmetric padding pl-10 / pr-8** leaves room for the trailing → glyph.
- **Interactive states shift ONLY background wash + text ink, never hue:** secondary neutral-t1 (4%) → hover t2 (6%); tertiary t1 → hover t2, selected t2; primary white → hover neutral-t0 (2%). Dark inverse-subtle #ffffff0a → #ffffff0f.

### Cards

6–8° tilted "paper" product cards; radius 8–12px; sub-pixel parallax on scroll. Shadows featherlight (see §6). Depth comes from backdrop-blur + translucency, not dark drop-shadows.

### Badges (trust)

Terse standalone labels near the fold under a 3-word header **"Built for trust."**: "SOC II, Type II", "HIPAA", "ISO 27001" (marked "Coming soon"). Product pages also state "SOC 2 Type II audited, HIPAA compliant." Link to trust.lightfield.app + status.lightfield.app.

### Radii scale

`--radius-sm: 4px`, `-md: 6px`, `-lg: 8px`, `-xl: 10px`, `-2xl: 12px` + rounded-full (9999px). Nav items 4px, buttons 6px, nav container 10px, cards 8–12px.

---

## 6. Motion & micro-interactions

**Signature reveal — fade + blur-in:** `@keyframes fade-blur-in { 0%{opacity:0; filter:blur(6px)} to{opacity:1; filter:blur(0)} }`. Applied `.fadeIn1 { animation: 1.5s cubic-bezier(.16,1,.3,1) .5s both fade-blur-in }` and `.fadeIn2 { ...1s both... }` (same 1.5s expo-out, staggered .5s vs 1.0s, fill-mode both).

**Signature easing:** `cubic-bezier(.16,1,.3,1)` (expo-out) — reuse everywhere for brand consistency.

**Two-tier easing/duration system:** global default `--default-transition-duration: .15s`, `--default-transition-timing-function: cubic-bezier(.4,0,.2,1)`. Named eases: `--ease-in: cubic-bezier(.4,0,1,1)`, `--ease-out: cubic-bezier(0,0,.2,1)`, `--ease-in-out: cubic-bezier(.4,0,.2,1)`. Duration scale: 50ms, .1s, .15s, .2s, .25s, .3s, .4s, .5s, .6s, .8s. **Rules:** buttons 50ms ease-out; nav/text hovers 100ms ease-in-out; header/section color shifts 300ms. Never exceed ~300ms for UI feedback; reserve 1.2–1.5s only for hero entrances.

**Other keyframes:** spinner `@keyframes spin { to{transform:rotate(360deg)} }` at `1.2s linear infinite`. AI streaming word reveal `word-fade-in` at .15s (and .3s variant) ease-out. Typing cursor `cursor-blink` at `1s steps(2,end) infinite`. Tailwind enter/exit primitives driven by `animation: enter var(--tw-duration,.15s) var(--tw-ease,ease)` (default 150ms).

**Scroll reveals:** animate from `transform: translateY(20px); opacity:0` to rest; optional sub-pixel parallax (~1–3px translate, e.g. `translate(0.7263px,-2.5938px)`) on stacked/tilted cards. Card tilt set via inline JS transform (keeps CSS classes clean). **Lightfield ships NO `prefers-reduced-motion` block — improve on it: add the guard.** scroll-behavior: auto (not smooth).

**Text-fill reveal (.text-bg-reveal):** transparent text over a 200%-tall two-stop gradient anchored bottom (`linear-gradient(lab(100% 0 0) 50%, lab(100% 0 0/.3) 50%) 0 100%/100% 200% no-repeat`), `background-clip: text`; slide background-position to wipe ink 30%→100% alpha on scroll.

**Shadow ladder (very light, warm-neutral, high-blur):** ambient/pill `0 0 24px 0 #00000005`; cards `0 1px 3px #0000000a`, `0 2px 8px #0000000a`, `0 6px 18px #0000000f`; lift `0 8px 32px 4px #00000014`. Tailwind md `0 4px 6px -1px + 0 2px 4px -2px #0000001a`; lg `0 10px 15px -3px + 0 4px 6px -4px #0000001a`. Max out around `0 8px 32px 4px rgba(0,0,0,.08)`.

**Backdrop-blur:** frosted surfaces `backdrop-blur-[17px]` (light) / `[23px]` (dark); also [24px]. Tokens `--blur-sm: 8px`, `-md: 12px`, `-lg: 16px`.

---

## 7. Workflow / agent-work grammar (CRITICAL)

_The operator demands workflow perfection. This is the system that makes multi-step agent work feel calm, legible, and trustworthy._

**The run thread — core unit of agent-work visualization.** Every AI action is an **append-only run thread**: a vertical stack of discrete step cards, each recording "each step's input, actions, and output." "One trigger starts one run." Never show a spinner-only "working…" state — show the **accreting evidence trail**.

**Step card structure:** name + prompt (the natural-language instruction, written in Markdown) + permission set. Steps are an ordered list; each runs as an AI turn in a shared run thread.

**Fixed 4-value step-state taxonomy (use everywhere, no other status words):** `started / completed / failed / skipped` — each recorded with **timestamp + duration + metadata**, giving "a complete timeline of every execution." Every run carries a **trace ID** correlating the full lifecycle. Render with paper/ink palette (ink-alpha for label, one-blue accent ONLY for in-progress).

**Step-verb grammar (past tense, concrete, quantified).** Each step = single past-tense verb + object + count. Live-demo examples: "ran code in a sandbox, compared this deal against every closed won and closed lost deal, and surfaced a pattern"; "ran about 20 enrichment tools, did a LinkedIn search, found the CIO, created the contact, and drafted an intro email." For MustBeViral: _"Analyzed 47 trending posts," "Drafted 3 hook variants," "Scored 12 audiences."_

**Quantified provenance is the #1 trust lever.** Attach a count and/or source to every step: "about 20 enrichment tools," "two or three sources," "10 companies," "revived 40+ stalled opportunities in a single two-hour session," "~3,000 customers," "unstuck in roughly three minutes." Work reads as **evidence, not magic** — "The diagnosis wasn't a generic best practice. It was proof pulled from the company's own history."

**Citations motif — every AI answer links to source.** "gives you answers with citations to the original conversations." Build a reusable **citation chip** anchoring any generated claim to its raw material.

**Human-in-the-loop happens AFTER the run, never mid-run.** "Runs execute to completion without interruption. You cannot follow up or approve actions mid-run." Build a dedicated **"For review" queue** (global-sidebar entry) of agent-produced drafts. **Exactly three controls: Approve / Edit / Dismiss.** Approve = the send/commit action; Dismiss = discarded silently, "nothing happens"; reviewers can inline-edit (body, recipients). "Only one person needs to act… once approved or dismissed it leaves the queue." Every item has ≥1 reviewer; "Routing respects run privacy."

**"Up next" surface:** pending agent work sits alongside the user's own meetings/tasks in one prioritized list — agent feels like a teammate handing you work, not a separate console.

**Agent-builds-automation = 5-phase progression:** **Describe → Research → Design → Validate → Draft**, then test/activate. Show as a calm progress ledger, NOT a percentage bar.

**Automation lifecycle = 3-state badge:** **Draft** (being built; triggers inactive) / **Active** (published, listening; edits create new versions) / **Deactivated** (paused; triggers stop). Gate going live behind explicit **Draft → Test run → Activate**. Never let an AI automation go live without a visible test step.

**Per-step permission disclosure:** each step declares an explicit human-readable list of exactly which tools/connectors/APIs/integrations it may use, **each with a one-line reason**. "Anything outside that list is blocked." Approvable in one glance before first run.

**Reliability language (makes autonomy feel safe):** steps are "durable: if a run is interrupted partway through, it resumes where it left off." Guarantees: events "are never lost," "No duplicate runs," "Automatic recovery," "resume from a durable checkpoint." "When a step fails terminally, the run fails and no later steps run"; the failed step "retains the error and any results up to the point of failure."

**Run details record layout (same 5 fields, same order, every time):** status, duration, trigger metadata, per-step transcript, any policy violations.

**Trigger vocabulary (4 types):** Webhooks / Object lifecycle triggers / Scheduled (daily/weekly/monthly/custom cron, timezone-aware) / Manual. **Step types:** Object operations / HTTP requests / Agent request (Claude-powered).

**Context passing is invisible (no manual wiring UI):** steps auto-inherit prior outputs via double-brace tokens — `{{trigger.email}}`, `{{step1.contact.id}}`, `{{trigger._diff.stage.after}}`. `_diff` provides before/after values. If ever shown, use quiet `{{step.field}}` tokens, never node-graph spaghetti.

**Immutability + rollback as trust primitive:** "Workflow definitions are immutable-versioned. Every edit creates a new version snapshot." "Every field, attribute, and object has version history. If an agent or a human overwrites something, you can see it and roll it back." RBAC on every piece of data. Message it explicitly near any place an agent writes.

**Only-two-actions calm principle:** design agent-work surfaces so no single click is scary — every action is previewed, editable, or undoable.

---

## 8. Copy rules & inventory highlights

**Capitalization — SENTENCE CASE UNIVERSAL.** Headlines, subheads, feature names, nav, CTAs, badges capitalize only first word + proper nouns. Preserve product-primitive proper nouns (Lightfield capitalizes Skills / Knowledge / Automations). "AI-native" keeps lowercase n. Title Case appears ONLY on deprecated legacy SEO pages ("Built for the Way Startups Sell") — treat as an anti-pattern.

**Punctuation habits:** (1) **Spaced em dash " — "** = signature reveal/pivot connector. (2) Terminal period on declarative-sentence headlines ("Built for trust.", "You sell, and agents do the rest.") but NONE on label/fragment headlines & CTAs ("Pipeline generation", "Get started in minutes"). (3) **Oxford comma always.** (4) **Rule-of-three triads** pervasive ("calls, emails, and meetings"). (5) Zero-padded list numbers "01." "02.". (6) Arrow glyph → in CTAs and "0→1". (7) En dash for ranges "4–6 weeks". (8) Single quotes wrap in-product example queries.

**Person discipline:** second person you/your = all benefit copy; first-person plural we/our = ONLY company/about/manifesto voice; first-person singular I/my = ONLY inside testimonials. Never mix registers within a section. Effectively zero passive voice in hero copy.

**Verb repertoire (brand-as-active-subject):** synthesizes, scores, surfaces, captures, listens, writes, drafts, tracks, reads, matches, extracts, joins, records, updates, flags, enriches. Imperatives: Try, Book, Ask, Send, Bring, Fill, Build, Tell, Search, Connect, Switch, Stop, Watch, Focus.

**Signature reflexive "does-it-itself" motif (most-repeated device):** "fills itself in," "updates itself," "write themselves," "runs in the background," "does the work for you." For MustBeViral: _"content that posts itself," "a feed that fills itself in."_

**Oppositional two-beat (every differentiator):** name the incumbent's flaw in one clause, then the inversion in the next, parallel and roughly equal length. "HubSpot only knows what somebody remembered to type. Lightfield captures what your customers actually said." "The world has evolved. Your CRM hasn't."

**Negation-stack objection killers (always threes):** "No forwarding, no BCCing, no manual logging." / "No hubs, no tiers, no add-on fees." / "no schema to design, no fields to configure, no workflows to build."

**"Built for \___." construction (3–6 words, audience/trust headers):** "Built for trust.", "Built for high growth companies.", "Built for people who'd rather sell than update their CRM." Plus footer "Built in San Francisco."

**Section eyebrows (2-word UPPERCASE / small-caps kickers):** Product, The problem, Why Lightfield, Solution, Process, Features, Customers, Testimonials, Foundations, Security, Recent, Vision, Blog, News. Numbered features 01–08.

**Sentence rhythm:** headlines 3–8 words (avg ~5); subheads 5–12 (avg ~8); body bimodal — 3–7-word staccato fragments interleaved with 12–24-word explanatory sentences. **Every hero paragraph ends on its shortest sentence** (e.g. hero word-counts 12→22→11→14→22→7).

**Meta/OG formula:** one sentence, ~18–20 words, "[Product] is an [category] for [audience] built to [verb, verb, and verb]." Keep description/og/twitter byte-identical. Title = "Brand — lowercase category tag" (spaced em dash).

**FAQ voice:** phrase the question exactly as the buyer asks ("Do I need a sales process before I start?"); open each answer with a one-word verdict — "Yes." / "No. That's the point." Reuse ONE boilerplate security answer verbatim: "We are SOC 2 Type II compliant. We never train models on customer data. You can export your data at any time via CSV or API."

**Social-proof escalation (tune per funnel stage):** product = "Trusted by the world's fastest growing startups"; migration = "Used by +2,000 companies"; comparison = "Trusted by thousands of companies"; book-demo = "Chosen by over 5,000 companies… the most widely adopted AI CRM"; closer = "Join thousands of companies using Lightfield." Never vague "many/lots."

**CTA inventory (two-tier, imperative, first-word-cap, 1–3 words):** Primary filled → signup: "Try free" / "Try for free" / "Start free trial." Secondary quiet → /book-demo: "Book a demo" / "Book demo" / "Request demo" / "Talk to us." Tertiary text: "Watch video," "Read more," "Explore changelog," "View all." Low-commitment link carries trailing →. **Never two loud buttons together.**

---

## 9. Pricing / docs / changelog patterns

**Pricing — ONE foregrounded plan, not a 3-column wall.** H1 "Pricing". Subhead: "Lightfield starts at $899 a month. Includes access for everyone at your company to a customer memory that's always up to date." **Pro** $899/month · Annual term · includes forward-deployed support + 1 Full seat · CTA "Request demo." **Starter** $89 per seat/month · No annual term · up to 3 seats, 30,000 records · CTA "Try free."

**Seat architecture (the psychological hook — reframe by ROLE not "user"):** Full $250/mo ("Builds agents, runs pipeline"); Capture $60/mo ("Records, syncs & edits"); **Access — Free, unlimited ("Read-only visibility").** Usage metered as **Credits** ("Meter agents, queries & automations," sized on a demo). Rationale copy: "Full seats are for people who work deals — agents act on their behalf. Everyone else at your company gets access to read, query, and build from the memory at no extra cost." Psychology: _everyone gets in free; you only pay for people who do the work._

**Comparison table — 9 grouped sections (Starter vs Pro):** Workspace, Core CRM, AI Agents & Automations, Agentic Pipeline Generation, Data Enrichment, Meetings & Call Intelligence, Reporting, Platform & Security, Support & Services. Support row: "Email support" vs "Forward-deployed team."

**"Replaces your whole stack" block:** "One system replaces your whole stack. Our team runs the migration off legacy CRM." Then 7 one-line modules (CRM / Call recorder / Sequencer / Enrichment / Workflow builder / Outbound / Agent platform). Plus **"See it on your data."**: "Evaluate Lightfield on your data, not a demo environment." Plus "YC-backed?" special-terms block.

**Migration page:** H1 "Switch to Lightfield in under an hour." "Our migration agent moves over all your data seamlessly and recreates all relationships." Proof "Used by +2,000 companies." Oppositional H2 "The world has evolved. Your CRM hasn't." 4-step accordion (Upload CSV / Define data model & import / Connect inbox / Import call transcripts). Concrete throughput: "The agent processes roughly 15,000 records per hour." Anchor the switch on a time promise + numbered how-it-works + a throughput metric.

**Book-demo = qualification/segmentation form:** "Chosen by over 5,000 companies…" + persistent single testimonial (Anna Yuan, Scale Agentic). Dropdowns: expected users (1 / 2-5 / 6-10 / 11-25 / 26-50 / 51-100 / 100+), role (Founder / CRO·VP Sales / AE·SDR / RevOps / CS / Marketing / Partnerships / Other), company type, total funding (0–$499K … $50M+), solution interest, evaluation stage. Button "Book my demo."

**Docs stack (separate from marketing app):** built on **Astro v6.1.8 + Starlight v0.38.3** on `docs.lightfield.app`. Concept-first "Introduction" landing; per-heading `[Section titled "…"]` anchors. Multi-SDK quickstart parity: **HTTP / Python / TypeScript / Go / CLI / MCP.** Auto-generated API reference (Stainless-style): per-language trees `/api/{lang}/resources/{resource}/methods/{create|retrieve|update|delete|list|definitions}`. Resource set: account, contact, opportunity, meeting, note, task, list, file, email, member, merge, object, workflowrun, auth. Ships in public beta with weekly cadence. **Do NOT hand-build docs in the marketing Next.js app.**

**Changelog:** filed under `/blog?category=changelog` (categories: All / Announcements / Changelog / Company / Guides / Perspectives). **Weekly (~every Thursday), founder-bylined** ("Keith Peiris & Henri Liriani"), grouped by month. Entry format: breadcrumb "News / Changelog" → H1 → 2000×1200 hero → byline+date → one-sentence intro → H2-per-feature-area with inline screenshots → terse "Smaller improvements" bullet list → "Related Articles." **Homepage digest variant:** ~10 entries, each date + title + 3 terse bullets + "Read more," ending "Explore changelog." Same changelog, two renderings (full article vs 3-bullet digest).

**Imagery/asset system:** all imagery via **Sanity CDN** (`cdn.sanity.io/images/3ccg9tet/production/…`) through **next/image at w=5120 q=90**. Standardize by role: hero ~2700×1662 (in-app step-card shots 2400×1800), feature 2676×2300, problem art 826×750, changelog heroes 2000×1200, portraits square 800×800 / 959×959. Prefer SVG logos.

**Support/trust pages minimal & specific:** H1 "Support" + "Last updated." Monitored inbox, "include URGENT for security," real street address ("600 Townsend St, Suite 125, San Francisco, CA 94103"), emails support@ / security@. Footer: 4 columns (Product / Company / Connect / Legal&Support), "© Lightfield 2026", "Built in San Francisco."

---

## 10. Perception levers & family sites

**Design authorship:** in-house / founder-led, no agency byline. Frame the brand as founder-driven (risk-reducer: "proven team").

**Perception quotes:** "the most thoughtfully designed CRM available in 2026"; "the one most likely to actually get used rather than abandoned three months after signup"; Chris Messina (Product Hunt): "Love the design and approach; proven team… it started offering value on Day 1." Catalogued as a design exemplar in the Saaspo gallery. (No Hacker News presence — perception lives on X, Product Hunt, SaaStr, design galleries.)

**Closest visual sibling — Anthropic/Claude "paper":** slate ink #141413 on ivory cream #faf9f5, no gradients/brand-purple/signature-blue, serif body "reads like a printed essay," 8 muted accents (clay/fig/cactus/sky/heather/olive/manilla/kraft) sparingly on data pages. Kyle Chayka named the "Claude aesthetic": off-white/beige backgrounds, rusty-orange accents, large italicized serif, tracked-out subheads, ticker-like bars. **Same family as MustBeViral's paper lab(96.5)≈#F4F4F2 + ink-alpha ladder.**

**Category comparable — Attio (design as moat):** progressive disclosure/restraint (clean enriched table first), one design system (identical "/" menu, "@" tagging everywhere — never "Frankenstein Software"), flow-state psychology ("satisfying arrow bends," "desire replaces obligation"), product-as-brand.

**The camp to AVOID (contrast reference):** "Linear-style" = dark bg + gradient chains (e.g. 08AEEA-2AF598-B5FFFC-FF5ACD) + blurs + micro-motion + Inter. Risk: "look identical within six months." Warm-paper is precisely the escape.

**Trust scaffolding perceived as credible:** "The weekly changelog shows a team that ships consistently rather than making promises." Founder pedigree (ex-Meta, Instagram Direct to 500M, Tome to 25M), $81M raised (Greylock/Reid Hoffman, Lightspeed), ~2,000 companies + 200+ YC startups in 3 months, ~35% word-of-mouth conversion.

**Family sites:** Anthropic/Claude (paper), Notion, PostHog (editorial camp, transparency lever). Distinguishing twist: Lightfield keeps ONE cool blue where Anthropic uses zero — editorial warmth + one note of technical precision.

---

## 11. Adoption rules for MustBeViral

1. **Commit 100% to editorial/warm-paper.** Never bolt on dark-mode-neon. Paper `#F4F4F2` / obsidian `#0d0d0d`; ink-alpha ladder for all text; no gradients, glassmorphism, or saturated CTA fills. Blended aesthetics fail.
2. **One blue accent, rationed.** `#80bfff` on a single primary action or one data highlight per view. Add muted earth accents ONLY on data/evidence surfaces.
3. **Reuse the fixed product-page skeleton verbatim** (§2) on every feature page. Consistency of rhythm is the brand.
4. **Short 1–2-word monocaps eyebrows** above every section H2 and feature H3 — DM Mono, 9–10px, weight 500, letter-spacing 1px. Primary wayfinding device.
5. **H1 = short product noun; value goes in the one-line subhead.** Never cram the pitch into the H1. Weight-400 headings only, never bold.
6. **Numbered 01/02/03 pain points** (blunt second-person declaratives), mirrored by an equal-count solution set.
7. **Two-tier CTA, never two loud buttons.** One filled "Try free" → signup beside one quiet "Book a demo →" → demo. Tertiary = text links. Repeat one closing band verbatim page-bottom.
8. **Model every AI action as an append-only run thread** (§7) with the fixed 4-state token (started/completed/failed/skipped), timestamps, durations, quantified provenance, and citation chips. No spinner-only states.
9. **Human-in-the-loop AFTER the run** via a "For review" queue with exactly Approve/Edit/Dismiss. 3-state automation lifecycle (Draft/Active/Deactivated) gated behind Draft → Test run → Activate. Per-step permissions with reasons. Version + rollback everything an agent writes.
10. **Pricing = one foregrounded plan** + headline price sentence; role-based seats with a FREE unlimited read-only tier; meter usage as "credits" sized on a demo; full detail in a categorized comparison table; add a "replaces your stack" block + "See it on your data."
11. **Weekly founder-bylined changelog** under `/blog?category=changelog`, month-grouped, hero + one-sentence intro + H2-per-area + terse "Smaller improvements"; surface a 3-bullet homepage digest.
12. **Sentence case everywhere; spaced em dash; Oxford comma; rule-of-three; reflexive "does-it-itself" motif; oppositional two-beats; negation-stacks in threes.** Brand-as-active-subject; person discipline (you/we/I by context). FAQ answers open with "Yes."/"No. That's the point."
13. **Motion:** one signature blur-in reveal at `1.5s cubic-bezier(.16,1,.3,1)` staggered .5s/1s; buttons 50ms, hovers 100ms, color shifts 300ms; featherlight warm shadows; **add the `prefers-reduced-motion` guard Lightfield omits.**
14. **Docs on a purpose-built framework (Astro Starlight) on a `docs.*` subdomain**, concept-first, multi-SDK parity, auto-generated Stainless-style API reference. Not hand-built in the marketing app.
15. **Trust scaffolding as first-class brand:** SOC2/HIPAA/ISO badges under "Built for trust.", trust.* + status.* subdomains, minimal specific support page (monitored inbox, URGENT instruction, real address), founder-voiced Vision essay, careers → real ATS.
16. **Serve imagery via CDN + framework optimizer at high res**, standardized by role; prefer SVG logos. Product-as-brand: use honest real product surfaces (6–8° tilted paper cards, agent step lists), not abstract art.
17. **Tune social-proof numbers per funnel stage;** never vague. Budget vast negative space as an intentional restraint signal.

### QA flags — do NOT copy blindly

- **Price drift:** /pricing says $899/$89 but /alternatives/hubspot still quotes "$59/user/month." Keep a **single source of truth for price** so stale numbers don't leak.
- **Duplicate testimonial:** the same quote is attributed to Alex Voronovich (CashQ) AND Tyler Postle (Voker). Never reuse one quote across two names.
- **Em-dash inconsistency:** manifesto uses unspaced "—"; marketing uses spaced " — ". Pick ONE (recommend spaced) and enforce it.
- **ISO 27001** is "Coming soon" — don't claim compliance you don't hold.
