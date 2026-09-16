---
brand: Must Be Viral
schema: brand-context/v1
version: 2
updated: 2026-09-15
owner: operator (role-only; never named in public copy). Named public face: Ashley Ansons.
languages: [en, es]
approval_required: true
status: draft
---

# Must Be Viral — GTM context

Single source of truth for marketing, copy, email, social, SEO and sales work in this repository.
Rules: cite a repo file or a dated owner decision for every fact; write `[OWNER-INPUT-NEEDED]` where neither exists and log it in section 13; never invent addresses, hours, prices, claims, ratings, reach figures or consent states. The design brief is `brand/BRAND.md`.

**Two surfaces, one company.** Must Be Viral sells done-for-you content production and social management to Houston businesses (the **studio** surface). The agentic software in this repository — the `apps/web` studio workflow of brief → quote → run → review → receipt — is the **operations backbone behind that service**, not the thing being sold to those customers (owner decision, 2026-09-15). Both are described accurately and are never blended into one pitch. Every rule below is tagged **[studio]**, **[product]** or **[both]**.

**Deliberate deviation from the four-file `brand/` contract.** This repository already owns its design tokens (`packages/ui/src/tokens.ts`, emitted as CSS custom properties in `packages/ui/src/styles.css`) and its font loaders (`apps/web/app/layout.tsx`, `next/font/google`). Duplicating those values into `brand/tokens.css` and `brand/fonts.ts` would create a second source of truth, so those two files are deliberately absent; `brand/BRAND.md` points at the live files instead.

**This repository is public.** No customer records, no supplier or contractor names, no production costs, no margins, no revenue actuals, no internal account identifiers and no secrets belong in `brand/`.

# 1. Brand & positioning

- Legal entity / DBA: **ERLV INC, DBA Must Be Viral** (owner decision, 2026-09-15). Use this form on contracts, email footers and legal pages.
- Name form rule **[both]**: the brand is written **"Must Be Viral"**, three words, in every piece of public copy, every UI string and every legal text. The repository, package names and code identifiers stay `MustBeViral` / `mustbeviral` — **do not rename code** (owner decision, 2026-09-15). This supersedes the one-word "MustBeViral Studio" form used in `README.md`, `PROJECT_STATE.yaml` and `apps/web/src/components/landing-page.tsx`; those shipped strings are now stale public copy and are tracked in section 13. Never invent a short form: "mbv" exists only as a CSS class prefix in `packages/ui/src/styles.css`.
- Public face **[both]**: **Ashley Ansons** is the named public face of the studio — founder-level voice, on camera and in bylines (owner decision, 2026-09-15). The repository owner is **never** named in public copy; anything not attributable to Ashley Ansons is signed role-only as **"Must Be Viral Studio"**.

## 1a. Studio surface (the revenue motion)

- What it is: done-for-you content production and social management for Houston businesses — a studio staffed by contracted videographers and photographers (owner decision, 2026-09-15).
- **Locked H1 (EN): "We film Houston."**
- **Locked sub-headline (EN): "Weekly content for Houston businesses — Reels, photos, and a posting schedule you actually keep."**
- **Locked H1 (ES): "Filmamos Houston."**
- **Locked sub-headline (ES): "Contenido semanal para negocios de Houston: Reels, fotos y un calendario de publicación que sí se cumple."**
- Enemy: **a business posting inconsistently from a phone** — shooting when someone remembers, going quiet for three weeks, and starting over. Hero: **a studio that shows up weekly**, with the shoot on the calendar and the posts already scheduled.
- Category, how buyers describe the need: "social media for my business", "someone to film my restaurant / med spa / gym", "content guy in Houston", "Reels for Instagram and TikTok".
- Differentiators (3), each provable by delivered work rather than by a results promise:
  1. **We show up on a schedule.** Shoots are booked in advance for the month; the cadence is the product.
  2. **Shot, edited and scheduled.** The deliverable is posts ready to publish with captions and a calendar, not raw footage.
  3. **Local and on site.** We come to the business in the Houston metro; direction happens on set.
- Business model: retail service packages, priced in section 7. One flagship monthly package plus a one-time test shoot; nothing below the flagship is published.

## 1b. Product surface (the software backbone)

- **Locked tagline, unchanged: "You brief. Agents produce. You approve every dollar."** (`.superdesign/brand-id.md`). Exact wording and punctuation, never paraphrased. This is the **software** tagline and belongs on the app UI, product docs and investor/product pages — never on the studio surface.
- Essence: "Quiet authority that spends your money carefully." (`.superdesign/brand-id.md`).
- What it is: an agentic creative-operations workflow — brief → quote → run → review → receipt — that produces composed Meta ad concepts with a named price before any provider spend begins (`docs/product/PRODUCT_CONTRACT.md`; `apps/web/src/components/landing-page.tsx`).
- Enemy: the black-box credit burner (`.superdesign/brand-id.md`). Hero: the accountable operator.
- Differentiators: quote before spend; lineage and an immutable receipt; review composed ads, not files (`docs/product/PRODUCT_CONTRACT.md`; `docs/ux/EXPERIENCE_CONTRACT.md`).
- Internal engine name: **ViralGraph** — an engine, not a customer-facing product (`PROJECT_STATE.yaml`).

## 1c. The never-mix rule (hard)

The two voices never appear on one surface (owner decision, 2026-09-15).

- A studio page, ad, email, DM, flyer or Spanish landing page uses the studio voice only: warm, local, concrete, priced. It does not mention agents, runs, receipts, quotes-as-artifacts or the software workflow.
- A product page, app screen, product doc or investor page uses the quiet-authority register from `.superdesign/brand-id.md`. It does not use the studio headline, studio pricing or "We film Houston."
- The software may be described to a studio client only as how we run the work internally, never as a product they are buying. If a surface needs both, it needs two surfaces.

# 2. ICP & personas

Market: Houston metro, B2B. The decision maker is the **owner or the marketing lead**. Firmographic shape for every persona: locally owned, single location or a few locations, employee band **3–100** (owner decision, 2026-09-15).

| Persona id                 | Segment (firmographic filter)                                              | Pain                                                                                          | Buying trigger                                                                                      | Opening-line angle                                                                       | Channel               | Language |
| -------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------- | -------- |
| `h1-med-spa-aesthetics`    | Med spas, aesthetics and cosmetic clinics; 3–100 employees; Houston metro  | Before/after content is their whole shop window and they have no consistent way to capture it | New injector, new device or new treatment menu launched; a competitor's page is visibly more active | Name the treatment menu; offer a shoot that covers the room, the staff and the results   | email, IG DM          | en, es   |
| `h2-restaurant-bar-coffee` | Restaurants, bars, coffee shops; 3–100 employees; single or few locations  | Menu changes weekly; phone photos in bad light; nobody owns posting                           | Menu change, new patio or location, slow season, a new GM                                           | Name a dish or the patio; weekly filming so the feed matches the menu                    | email, IG DM, walk-in | en, es   |
| `h3-gym-studio-coach`      | Gyms, studios, coaches, martial arts; 3–100 employees                      | Content depends on one member filming; classes look empty on camera                           | New class schedule, new location, January and post-summer intake pushes                             | Name the class format; film a full week of classes in one visit                          | email, IG DM          | en, es   |
| `h4-auto`                  | Dealers, detailing, custom and performance shops; 3–100 employees          | The work is visual and they know it, but the footage never gets edited                        | New inventory, a build finished, a shop expansion                                                   | Name the build or the inventory; cinematic walkarounds plus cut-downs for Reels          | email, IG DM          | en, es   |
| `h5-home-services`         | Home services and contractors — HVAC, roofing, remodel, landscaping; 3–100 | Before/after job sites are the proof and they are never documented                            | Busy season starting, a crew added, a showroom opened                                               | Name the job type; document a job start to finish and turn it into a month of posts      | email, phone          | en, es   |
| `h6-real-estate-teams`     | Real estate teams and brokerages; 3–100 agents                             | Listing media is per-listing and disposable; the team brand has no consistent content         | New listing volume, team expansion, a rebrand                                                       | Separate team-brand content from listing media; a weekly cadence that is not listing-led | email, phone          | en, es   |

- Anti-persona / never target: anyone shopping for **one-off cheap edits** or hourly editing work; **MLM, crypto, "make money online" and get-rich programmes**; any business whose pitch needs claims the studio cannot substantiate (medical outcomes, income promises, guaranteed reach); and any brief that requires content about identifiable minors, patients or clients without a signed release on file. Also excluded while enrollment is closed: self-service software signups (`apps/web/app/signup/page.tsx`).
- **Persona ids are one scheme, used everywhere.** The ids in the first column are the same strings as the `mbv_persona` dropdown values in section 10, the persona sections of `docs/gtm/outbound-target-lists.md` and the property definitions in `docs/gtm/hubspot-mapping.md`. A persona is never referred to by a second id.
- Segment sizes: **no list has been pulled.** The ZoomInfo connector is not authorised in this workstation, so there are no counts. **Planning target, set here and repeated in `docs/gtm/outbound-target-lists.md` section 3: 200 accounts per persona, 1,200 total.** Basis, stated plainly so it is not mistaken for research: no Houston firmographic counts exist in this workstation, so the sizes are equal across personas, and 200 is eight weekly waves of 25, 25 being the assumed volume one human sender can personalise and send in a week. That weekly figure is an assumption, not a measurement. Every number here is a planning target, never a measured market size, and is labelled as such wherever it appears. `[OWNER-INPUT-NEEDED]` — Confirm or replace the weekly send capacity and each per-persona size once ZoomInfo is connected and real counts exist.
- Target-list build rule: personas above are the only approved segments. A list is built from the firmographic filter plus Houston metro plus the decision-maker title; it is reviewed before use; it never becomes a send list until section 8's consent and suppression requirements are satisfied.

# 3. Voice & tone

Two registers. Pick one per surface (section 1c) and stay in it.

## 3a. Studio voice [studio]

- Personality: warm · local · concrete · priced · first person plural ("we film", "we come to you").
- Rules: say what we do, where, how often and what it costs. Short sentences. Sentence case. No hype, **no emoji in body copy** (an emoji may appear in a social caption only where the platform convention demands it and the owner has approved the caption). No exclamation pile-ups. Name Houston and name the thing being filmed.
- Tone by channel: website — plain and priced. Instagram/TikTok caption — conversational, still concrete. Cold email — three short sentences and one ask. Phone and on set — normal human speech. Spanish — see 3c.

## 3b. Product voice [product]

- Unchanged, from `.superdesign/brand-id.md`: quiet not loud · precise not playful · plain not decorated · proving not promising · respectful not friendly. Declarative, present tense, zero hedging; one fact per sentence; money always specific; no exclamation marks.
- Voice formulas (`.superdesign/brand-detail.md` section 4): feature line = capability + evidence; status line = state + consequence + exit; numbers exact and set in the evidence face.

## 3c. Spanish register [studio]

Owner decision, 2026-09-15. The site is **English-first with a Spanish variant of the studio landing page**, and **all Spanish outbound and sales collateral** is in scope. Product and app UI stay **English-only** for now.

- Register: **neutral Latin-American Spanish**, formal **usted** on first contact. No voseo. No Spain-specific vocabulary or _vosotros_.
- **No machine translation.** Spanish copy is written natively, not translated, and is reviewed by a fluent speaker before publishing.
- Rationale to record: Houston's market is roughly 45% Hispanic and a large share of the target businesses are Hispanic-owned; the studio sells locally, so Spanish is a sales surface, not a localisation exercise.
- Register may relax from _usted_ to _tú_ only after the client does so first, and never in a first contact, a legal line or a price line.
- `[OWNER-INPUT-NEEDED]` — Who is the named fluent reviewer who signs off Spanish copy before it publishes? Until that person is named, Spanish copy stays `status: draft`.

## 3d. Do / Don't pairs — English

| #   | Surface | Situation                    | Do (EN)                                                                                                                          | Don't (EN)                                                                  | Why                                                                       |
| --- | ------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | studio  | Headline                     | "We film Houston."                                                                                                               | "Houston's #1 viral content agency."                                        | locked H1; superlatives and "viral" as a promise are banned (section 4)   |
| 2   | studio  | Explain the service          | "On the Full Package we come to your business four to eight times a month, shoot, edit, and hand you the posts with a calendar." | "We'll take your brand to the next level with a full 360 digital strategy." | cadence exactly as section 7 defines it; no vague scope                   |
| 3   | studio  | Price                        | "Test Shoot is $700, one time. Full Package is $3,500 a month."                                                                  | "Affordable packages — contact us for a custom quote!"                      | retail prices are public and exact (section 7); no coupon-speak           |
| 4   | studio  | Results question             | "Here's what we delivered for a shoot like yours. Reach depends on your account and your market."                                | "Our clients see 10x engagement."                                           | only showable work may be claimed; no results or reach claims (section 4) |
| 5   | studio  | Objection: "we post already" | "You do. The gap is the weeks you don't. We keep the cadence so it doesn't depend on somebody remembering."                      | "Your current content is holding you back."                                 | name the enemy, never make the customer the villain                       |
| 6   | studio  | Close                        | "Book a test shoot. Two hours, two Reels, 15 to 25 photos, $700."                                                                | "Let's hop on a quick discovery call to explore synergies!"                 | one CTA, named outcome, named price                                       |
| 7   | studio  | Turnaround                   | "Standard edits come back on the schedule we agree at booking; 24-hour turnaround is an add-on."                                 | "Lightning-fast delivery, always."                                          | turnaround is claimable only as the agreed commitment                     |
| 8   | product | Explain the software         | "You brief. Agents produce. You approve every dollar."                                                                           | "AI-powered creative that supercharges your pipeline."                      | locked tagline; "AI-powered" as a benefit is on the kill-list             |
| 9   | product | Name the cost                | "Confirm $4.20 run."                                                                                                             | "Affordable AI creative, starting today."                                   | the confirm control carries the amount (`.superdesign/design-system.md`)  |
| 10  | product | Partial failure              | "static-2 failed. Two verified statics retained. Retry is free."                                                                 | "Oops! Something went wrong, please try again."                             | state + consequence + exit (`.superdesign/brand-detail.md`)               |

## 3e. Do / Don't pairs — Spanish [studio]

| #   | Situation           | Do (ES)                                                                                                                                         | Don't (ES)                                         | Why                                                                         |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | First contact       | "Buenos días. Somos Must Be Viral, un estudio en Houston. Grabamos contenido semanal para negocios como el suyo."                               | "¡Hola! ¿Querés que tu negocio explote en redes?"  | usted on first contact, no voseo, no hype                                   |
| 2   | Price               | "El Test Shoot cuesta $700, una sola vez: una sesión de hasta dos horas, 2 Reels editados y de 15 a 25 fotos."                                  | "Tenemos precios accesibles, pregúntenos."         | exact retail figure and concrete deliverables, never "accesible"            |
| 3   | Explain the cadence | "Con el Full Package vamos a su negocio de cuatro a ocho veces al mes, grabamos, editamos y le entregamos las publicaciones con su calendario." | "Nos encargamos de todo su marketing digital 360." | cadence exactly as section 7 defines it; concrete and bounded               |
| 4   | Results question    | "Le entregamos el material listo para publicar. El alcance depende de su cuenta y de su mercado."                                               | "Garantizamos que sus videos se vuelvan virales."  | no results, reach or ROI promises in any language (section 4)               |
| 5   | Close               | "Agende un test shoot. Dos horas, dos Reels y de 15 a 25 fotos, $700."                                                                          | "¡Aproveche nuestro descuento de lanzamiento!"     | one CTA with the named price; discount language is banned in every language |

## 3f. Kill-list — never, in any language, on any surface

Owner-set for the studio motion: **"viral guaranteed"** (and any promise that content will go viral) · **"blow up"** · **"explode"** · **"crush it"** · **"game-changer"** · **"revolutionary"** · **"AI-powered" used as a customer benefit** · **discount, coupon, "limited time", "special offer" and every other discount construction**.

Carried over from the repository's own rules (`.superdesign/brand-id.md`, `.superdesign/brand-detail.md`): exclamation marks in product copy · "magic" · "supercharge" · "unleash" · fake urgency · rounded or vague money · hedging.

Carried over from the `brand-context` skill defaults: elevate · seamless · one-stop · solutions · leverage · cutting-edge · state-of-the-art · all-caps shouting · "in today's fast-paced world" and similar AI filler.

- Rewrite test **[studio]**: if a person standing in the business would not say it out loud, rewrite it.
- Rewrite test **[product]**: if the sentence does not carry one verifiable fact, cut it.

# 4. Claims

## 4a. What the studio may claim

Only what it can show, on request, from delivered work:

- The **deliverables** in the package the customer is buying, exactly as written in section 7 (counts of Reels and photos, shoot length, what is included).
- The **shoot cadence** we commit to and keep — the Full Package band in section 7, "four to eight shoots a month", each shoot two to three hours — stated as a commitment, not as a past average, unless a dated internal record supports the average. Never state a cadence narrower or wider than the package sold; the hours are the shoot length, not the shoot count.
- The **turnaround** actually agreed at booking, and the 24-hour add-on when purchased.
- **Delivered work itself** — clips and stills we produced — shown as a portfolio, subject to 4c.
- Location and service area: Houston metro, section 6.

## 4b. What the studio may never claim

- **Results, reach, views, followers, engagement, leads, bookings, sales or ROI** — forbidden without documented client data that the owner has approved for publication and that names the measurement window. There is no such documented data today.
- Anything containing "viral", "blow up" or "guaranteed" as an outcome.
- Superlatives: "best", "cheapest", "fastest", "#1 in Houston", "Houston's top …".
- Comparative claims naming another studio, agency or freelancer.
- Claims about a client's own product (medical outcomes, income, safety, efficacy). The studio produces media; the client owns and substantiates the claim inside it, and a brief that requires an unsubstantiated claim is refused (`docs/product/PRODUCT_CONTRACT.md` already states the product "does not infer permission to use unlicensed assets, unsupported claims, sensitive likenesses, or prohibited advertising content").
- Team size, staff count or "our team of X" beyond what is true of contracted crew.
- Any availability, uptime or guaranteed-delivery promise.

## 4c. Testimonials, portfolio and permission

- Testimonials, client names, client logos, and client footage used as portfolio require **written permission on file**, naming the client, the assets and the surfaces they may appear on, dated.
- **Decision: none is on file today.** Until a permission record exists, no client name, logo, quote or delivered clip appears in public marketing. Logged in section 13.
- Identifiable people on camera need a release; identifiable minors are never used.

## 4d. Product claims (unchanged, each tracing to a repository file)

- "No run starts without explicit confirmation of an unexpired quote." (`docs/product/PRODUCT_CONTRACT.md`)
- "Nothing presented as generated is a hidden mock or silent fallback." (`docs/product/PRODUCT_CONTRACT.md`)
- Media is private by default and is copied from temporary provider storage into private storage immediately after verification (`docs/product/PRODUCT_CONTRACT.md`; `docs/architecture/SYSTEM_OVERVIEW.md`).
- "A changed input invalidates only affected descendants; approved unaffected artifacts remain inspectable." (`docs/product/PRODUCT_CONTRACT.md`)
- Conditional: page-experience budgets (p75 LCP, INP, CLS) and the "first reviewable static pack" speed gate are **engineering gates, not proven outcomes** (`docs/delivery/QUALITY_GATES.md`); never published as achieved. Never claim customer data is not used for model training — routing posture is per-model and privacy-gated (`docs/research/MODEL_CATALOG_EVIDENCE.md`). Never state that self-service signup exists while enrollment is closed (`apps/web/app/signup/page.tsx`).

## 4e. Pricing and anonymity discipline [both]

- Only the exact retail figures in section 7 may appear in public copy. **Production cost, contractor rates, margin, any cost-plus framing, and supplier or contractor names never appear anywhere in this repository or in any public or client-facing copy.** A price is stated as a price, never as a derivation.
- The repository owner is never named in public copy. Ashley Ansons is the approved public face; everything else is signed "Must Be Viral Studio" (owner decision, 2026-09-15).

# 5. Visual

- **Live token source:** `packages/ui/src/tokens.ts` — the `lightfield` token object — emitted as CSS custom properties in `packages/ui/src/styles.css` and loaded through `@mustbeviral/ui/styles.css` in `apps/web/app/layout.tsx`. **No `brand/tokens.css` exists and none should be created.**
- **Live design system:** `.superdesign/design-system.md`. Identity and psychology: `.superdesign/brand-id.md`, `.superdesign/brand-detail.md`. Accepted UX authority: `docs/ux/EXPERIENCE_CONTRACT.md`. Design brief: `brand/BRAND.md`.
- **Fonts, live source:** `apps/web/app/layout.tsx` loads Geist and Geist Mono through `next/font/google` as `--font-sans` and `--font-mono`. **No `brand/fonts.ts` exists and none should be created.**
- **Logo:** `brand/logo/` is the source of the mark. **The files are delivered in this change** — `mark.svg`, `mark-mono.svg`, `mark-reverse.svg`, `wordmark.svg`, `lockup-horizontal.svg`, `lockup-stacked.svg`, `favicon.svg`, the specimen sheet `preview.html`, and `brand/logo/README.md` for clear space, minimum sizes, the three approved colour pairs and the forbidden uses. They are `status: draft` and **await owner approval** (section 13). The shipped UI wordmark is still the text form (`apps/web/app/globals.css`, `.studio-wordmark`), which reads "MustBeViral Studio" and must be updated to the three-word name form (section 13). Never recolour, stretch or redraw the mark.
- **Photo and footage rules [studio]:** real Houston businesses, real people with releases on file, no identifiable minors, no stock clichés. Delivered client work may be shown only under section 4c.
- **Photo rules [product]:** the only imagery is the real product UI presented as evidence (`.superdesign/brand-detail.md`). Reference captures in `.superdesign/reference/` are study material, never shipped assets.
- **Token sets:** one. There is no separate print set.
- **Recorded divergence — open, deliberately unreconciled.** The identity documents and the shipped tokens disagree on palette and type: `.superdesign/brand-detail.md` gives paper `#F4F4F2` and `.superdesign/brand-id.md` gives the accent `#2E6BE6`, while `packages/ui/src/tokens.ts` ships paper `#FAFAFA` / `#F5F5F5`, card `#FFFFFF`, signal `#3182D4` with soft `#80BFFF`, ok `#1F9D63`, attention `#B87E14`, fail `#C4404D`; `docs/ux/EXPERIENCE_CONTRACT.md` gives different success and error values again. Type: the identity documents name Untitled Sans and DM Mono as the licensed target faces, Geist and Geist Mono are what ship. **Build against `packages/ui/src/tokens.ts`. Do not reconcile the documents.** Both values are recorded in `brand/BRAND.md`; the decision is the owner's and stays in section 13.

# 6. Locations, contact, service area

| Location id  | Address (exact, footer form)                          | Phone (display · tel:)            | Hours (scope)          | GBP id / URL           | Service area  |
| ------------ | ----------------------------------------------------- | --------------------------------- | ---------------------- | ---------------------- | ------------- |
| `studio-hou` | `[OWNER-INPUT-NEEDED]` street, suite, Houston, TX ZIP | 713-899-9346 · `tel:+17138999346` | `[OWNER-INPUT-NEEDED]` | `[OWNER-INPUT-NEEDED]` | Houston metro |

- City: **Houston, Texas** (owner decision, 2026-09-15).
- Email: **studio@mustbeviral.com** — the approved public contact address and the approved reference / reply-to address (owner decision, 2026-09-15).
- Service area: **Houston metro.** The studio travels to the customer; it is a service-area business, not a walk-in storefront. One page per real service area, under 30 total; **never** generate per-ZIP or per-street pages.
- Timezone: America/Chicago.
- `[OWNER-INPUT-NEEDED]` — **Street postal address.** "Houston" alone is not a valid postal address. CAN-SPAM requires a valid physical postal address in every commercial email footer, and the legal pages need one as well. Provide a street address, a suite, or a USPS or virtual mailbox. **No bulk or commercial email may be sent until this exists** (see section 8).
- `[OWNER-INPUT-NEEDED]` — Public business hours and their scope (phone-answered hours vs shoot availability), and any response-time commitment we may state.
- `[OWNER-INPUT-NEEDED]` — Is there a Google Business Profile for the studio, and is it verified as a service-area business?
- Product surface hosts, for anything that links to the software: `mustbeviral.com` and `/studio`, `api.mustbeviral.com`, staging at `staging.mustbeviral.com` and `api-staging.mustbeviral.com` (`docs/architecture/SYSTEM_OVERVIEW.md`). Production is still the previous generation and the current foundation is deployed only on protected URLs with generation, provider, queue and charge behaviour off (`PROJECT_STATE.yaml`); do not describe the software as generally available.

# 7. Offers, pricing, CTAs

## 7a. Retail pricing [studio] — exact, owner-set 2026-09-15

**Test Shoot — $700, one-time.**

- One shoot, up to 2 hours
- 2 edited Reels
- 15–25 edited photos
- Creative direction on set
- Formatted for Instagram and TikTok, ready to post

**Full Package — $3,500 per month.**

- 4–8 shoots per month, 2–3 hours each
- 12–16+ edited Reels
- 120–200 edited photos
- Lifestyle, branding, product and team photography
- Cinematic brand content
- Full creative direction
- Monthly content strategy and calendar
- Hook and caption assistance
- Trend research
- Instagram and TikTok optimisation
- Behind-the-scenes and story content
- Monthly strategy meeting
- Priority editing
- Drone / aerial included where applicable

**Add-ons**

- 24-hour turnaround: **+$200–$400 per shoot**
- Drone: **+$300–$600 per shoot** (included in Full Package where applicable)

## 7b. Pricing rules [studio]

- **These two packages are the only published tiers.** Do not publish, quote in public copy, or reference any tier below Full Package.
- **No discounts.** No coupons, no launch pricing, no "limited time", no percentage off, in any language. If a price must move, the package changes, not the price tag.
- Public copy carries **retail prices only**. Production cost, contractor rates, margins, cost-plus framing and supplier names never appear in any surface, file or draft.
- Add-on ranges are owner-set. `[OWNER-INPUT-NEEDED]` — what determines the point inside each range (shoot length, travel, deliverable count)? Until answered, public copy states the full range and the exact figure is confirmed at booking.
- The monthly package is described as "$3,500 a month", never "$3.5k", never rounded, never "starting at" unless a quote path exists.

## 7c. CTAs

- **Primary CTA [studio] EN: "Book a test shoot."** ES: **"Agende un test shoot."** One CTA per studio surface.
- Secondary CTA [studio] EN: "Call 713-899-9346." ES: "Llame al 713-899-9346."
- Primary CTA [product], unchanged and shipped: "Sign in to Studio" (`apps/web/src/components/landing-page.tsx`).
- **Recorded defect — "Request access".** The shipped secondary CTA "Request access" links to `/signup`, a page that states enrollment is closed and **collects nothing** (`apps/web/src/components/landing-page.tsx`; `apps/web/app/signup/page.tsx`). Fix, owner's choice of one: (a) replace the target with a real form that writes a consent record per section 8 and returns a confirmation, or (b) remove the CTA until that form exists. **Do not build the form under this packet.** No copy may promise that a request will be received until one of the two lands. Logged in section 13.
- Software pilot pricing recorded in `docs/architecture/EXECUTION_PROVIDERS_AND_BILLING.md` ($500 setup, $149/month, prepaid usage wallet) is **product-surface only** and must never appear on a studio surface. `[OWNER-INPUT-NEEDED]` — is that pilot offer still live after the studio pivot?

# 8. Legal & consent

## 8a. Entity and contact

- Legal entity: **ERLV INC, DBA Must Be Viral**. Contracts, email footers and legal pages carry this form.
- Contact of record: Houston, Texas · 713-899-9346 · studio@mustbeviral.com.
- Footer postal address: `[OWNER-INPUT-NEEDED]` (section 6). **Blocking for every commercial email.**

## 8b. Legal pages — BLOCKED

Privacy policy, terms of service, and the AI / advertising disclosure page do not exist. The owner has decided these are produced with Anthropic's Legal plugin, which is **not installed in this workstation** (owner decision, 2026-09-15).

- **No agent writes legal text or legal advice for this brand.** Not a privacy policy, not terms, not a disclosure page, not a contract clause.
- What agents may produce: a **facts-only input pack** for the plugin or an attorney — entity name and DBA, contact details, service description, data actually collected and by which system, sub-processors actually in use, retention and deletion behaviour as implemented, consent mechanism as implemented, jurisdiction, and the list of pages needed.
- Until the pages exist and are published, no surface may link to a privacy policy or terms, and no form may claim that data is handled "per our privacy policy".
- `[OWNER-INPUT-NEEDED]` — install the Legal plugin or engage an attorney; who owns this and by when?

## 8c. Consent and suppression — marketing contact is BLOCKED

Owner decision, 2026-09-15: marketing contact is blocked until **both** a consent record and a suppression list exist. Neither exists today.

**The rule:** no marketing email and no SMS may be sent to anyone until a consent record and a suppression list both exist and are checked at send time. Unknown consent fails closed. Suppression always overrides any grant. A purchased or sourced B2B list is **not** consent.

**Required data model (to be built; not built today):**

| Record            | Fields                                                                                                                                            | Rule                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Consent record    | contact point (email or phone, exact) · channel · purpose · basis · timestamp (UTC) · source surface or URL · IP or evidence reference · language | one row per contact point **and** channel **and** purpose; never inferred, never back-filled |
| Suppression entry | contact point (exact) · reason (unsubscribe, STOP, complaint, hard bounce, do-not-contact, invalid) · timestamp · source                          | append-only; a suppressed contact point is never removed by an import or a re-opt-in upload  |

**Acceptance test (all four must pass before the first marketing send):**

1. A send to a contact point with **no** consent record for that exact channel and purpose is rejected by the sending path, not by a human reviewer.
2. A send to a contact point present in the suppression list is rejected, even when a consent record also exists.
3. An unsubscribe, a STOP and a hard bounce each create a suppression entry within one send cycle, and a subsequent send to that contact point is rejected.
4. An audit query can produce, for any contact point, the consent basis and timestamp that authorised the most recent send.

Until all four pass, outbound is limited to **one-to-one human-sent mail with no bulk mechanism**, and even that requires the section 6 postal address and a working opt-out line.

## 8d. Disclosure requirements by surface

Policy requirements to be implemented; the **wording** is blocked on 8b.

| Surface                                                                             | Must disclose                                                                                                                                     |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio site and client deliverables                                                 | That AI tools may be used in editing and post-production, where they are, and that a human directs and approves every delivered asset             |
| Any delivered asset containing synthetic or AI-generated imagery, voice or likeness | A visible disclosure on the asset or in its caption, plus the platform's own AI-content label where the platform provides one                     |
| Paid social placements and client ad accounts                                       | The advertiser of record, plus the platform's required ad label. Paid partnership and sponsored content carry the platform's paid-partnership tag |
| Testimonials and portfolio                                                          | Attribution and date; permission on file (section 4c); no implied typical result                                                                  |
| Product surface (software)                                                          | That outputs are agent-produced, with the run's model route, provider and cost inspectable in the receipt (already the product's behaviour)       |
| Outbound email                                                                      | Identity of the sender, the entity name, the postal address, and a working one-click unsubscribe                                                  |

## 8e. Other standing rules

- Review requests: no incentive of any kind, no gating; ask everyone or no one.
- Minors and sensitive data: never in a marketing audience, a CRM record, an export or a delivered asset without an explicit release, and never for identifiable minors.
- Customer media, signed URLs, raw environment values and account tokens never appear in docs, logs, evidence, fixtures or messages (`AGENTS.md`).
- Client-owned footage, music licences and location permissions are the client's to grant; the studio does not assume rights it has not been given.

# 9. Channels & tools

| Channel / tool          | State                                                                                                                                                                                                                                                                                                          | Rule                                                                                                                                                                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Website                 | `apps/web` on Vercel (Next 16); `apps/core` and `apps/collaboration` on Cloudflare Workers; Supabase Postgres (`README.md`; `docs/architecture/SYSTEM_OVERVIEW.md`)                                                                                                                                            | English-first, with a Spanish variant of the studio landing page. Product and studio surfaces stay separate routes (section 1c).                                                                                                                                                                 |
| Instagram               | Handle `[OWNER-INPUT-NEEDED]`                                                                                                                                                                                                                                                                                  | Studio voice only. Drafts only; nothing posts without owner approval.                                                                                                                                                                                                                            |
| TikTok                  | Handle `[OWNER-INPUT-NEEDED]`                                                                                                                                                                                                                                                                                  | Same as Instagram.                                                                                                                                                                                                                                                                               |
| Email                   | Sending address **studio@mustbeviral.com**. Production from-address `[OWNER-INPUT-NEEDED]`; DMARC status for the domain `[OWNER-INPUT-NEEDED]`. Resend is the transactional adapter and Supabase Auth SMTP (`docs/architecture/SYSTEM_OVERVIEW.md`; `packages/email/src/index.ts`, fails closed without a key) | **Before any bulk send:** DMARC published at **at least `p=none`** with **SPF and DKIM aligned** to the sending domain, plus `List-Unsubscribe` and `List-Unsubscribe-Post` headers, a one-click opt-out, and the section 6 postal address. Consent and suppression per 8c gate the send itself. |
| Outbound sourcing       | **ZoomInfo — not authorised in this workstation.** No list has been pulled and no counts exist.                                                                                                                                                                                                                | Write the target-list **spec**, never fake numbers. A sourced list is not consent (8c).                                                                                                                                                                                                          |
| Outbound drafting       | A Grok bot drafts; a human sends (owner decision, 2026-09-15)                                                                                                                                                                                                                                                  | Drafts carry the section-3 front-matter, `status: draft`, `owner_approval: required`. No agent sends.                                                                                                                                                                                            |
| CRM                     | **HubSpot.** Portal id for Must Be Viral `[OWNER-INPUT-NEEDED]`                                                                                                                                                                                                                                                | Section 10. Agents read freely; every write goes through the `hubspot-agent-cli` approval gate.                                                                                                                                                                                                  |
| Social scheduling       | **Postiz**, drafts only                                                                                                                                                                                                                                                                                        | Default post status is `draft`. Nothing schedules or publishes without owner approval in the current task.                                                                                                                                                                                       |
| Google Business Profile | `[OWNER-INPUT-NEEDED]` (section 6)                                                                                                                                                                                                                                                                             | Service-area business if it exists; NAP must match section 6 exactly.                                                                                                                                                                                                                            |
| SMS                     | Not a channel. No provider, number or 10DLC registration exists.                                                                                                                                                                                                                                               | Blocked outright until 8c is satisfied and a registration exists.                                                                                                                                                                                                                                |
| Analytics               | Web Vitals reporter (`apps/web/src/components/web-vitals-reporter.tsx`), Sentry and OpenTelemetry (`docs/architecture/SYSTEM_OVERVIEW.md`). No product analytics, no marketing attribution.                                                                                                                    | Paid acquisition stays off until attribution is verified.                                                                                                                                                                                                                                        |
| Design tooling          | SuperDesign artifacts in `.superdesign/` (`@superdesign/cli` dev dependency)                                                                                                                                                                                                                                   | Optional tooling, not an authority (`docs/ux/EXPERIENCE_CONTRACT.md`).                                                                                                                                                                                                                           |

- `[OWNER-INPUT-NEEDED]` — Production from-address and the published DMARC policy for its domain. Until both are confirmed, no bulk send of any size.

# 10. CRM object mapping — HubSpot

Owner decision, 2026-09-15: **HubSpot is the CRM.** The owner already operates a HubSpot portal for another brand in this portfolio. `[OWNER-INPUT-NEEDED]` — does Must Be Viral share that existing portal or get its own portal? No portal id is recorded here until that is answered, and no agent connects to a portal it has not been told to use.

Scope: **pre-sale only** — sourcing, outreach, test shoots, proposals and the Full Package close. Post-sale production scheduling and delivery live in the studio operations backbone, not in HubSpot.

**One naming scheme.** This section is the authority for what HubSpot holds; `docs/gtm/hubspot-mapping.md` is its implementation and carries the full property list, the types and the dropdown values. Both use the same persona ids (section 2), the same `mbv_` custom-property names and the same stage list as 10b. There is no second scheme, and a property that the mapping does not define does not exist.

## 10a. Objects and properties

| Concept       | Object        | Key properties                                                                                                                                                                                                                                                            | Notes                                                                                                                    |
| ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Person        | **Contact**   | `mbv_source_system` (zoominfo / site-form / referral / event / manual) · `mbv_persona` (h1…h6, section 2) · `mbv_language` (en / es) · `mbv_consent_basis` · `mbv_consent_recorded_at` (UTC) · `mbv_suppressed` (checkbox) · standard `jobtitle` (owner / marketing lead) | `mbv_consent_basis` and `mbv_suppressed` mirror Supabase and are **never** written upward by an agent or an import (8c). |
| Business      | **Company**   | `mbv_persona` (h1…h6) · `mbv_location_count` · `mbv_content_state` · `mbv_content_audit_at` · `mbv_language` · standard `city`, `state`, `numberofemployees`                                                                                                              | Location is `city` and `state` only. No submarket, district or per-ZIP property exists, and none may be created.         |
| Opportunity   | **Deal**      | pipeline = **Studio**, stages in 10b · `mbv_package` (test-shoot / full-package) · `mbv_shoots_per_month` · `mbv_first_shoot_date` · standard `amount`, `dealstage`, `closedate`                                                                                          | One deal per business per motion; a lost deal is not reopened, a new one is created.                                     |
| What was sold | **Line item** | `Test Shoot` ($700, one-time) · `Full Package` ($3,500 / month) · `24-hour turnaround` (add-on) · `Drone` (add-on)                                                                                                                                                        | Retail figures only, matching section 7 exactly. No cost or margin fields exist in this portal.                          |

**`amount` carries the money; there is no `mrr` property.** On a `full-package` deal `amount` is the monthly recurring retail figure, $3,500; on a `test-shoot` deal it is the one-time $700. Add-ons are line items and are never folded into `amount`.

## 10b. Studio pipeline

Eight stages in order, plus two off-pipeline stages. Entry and exit criteria for each are written once, in `docs/gtm/hubspot-mapping.md` section 4; the stage names below are those stage names exactly.

| Stage                     | Enters when                                                                    | Properties the stage needs                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Sourced**               | The company and contact exist and match a persona filter                       | `mbv_persona`, `mbv_source_system`, `mbv_language`, `city`, `state`                                               |
| **Verified**              | A human confirmed the business is trading and audited its content              | `mbv_content_state`, `mbv_content_audit_notes`, `mbv_content_audit_at`, `mbv_last_verified_at`                    |
| **Contacted**             | A first human-sent, compliant outreach has gone out and is logged              | `mbv_consent_basis`, `mbv_consent_recorded_at`, `mbv_consent_proof_url`, the logged outreach activity             |
| **In conversation**       | The contact replied and is engaged                                             | `hs_lead_status`, `hubspot_owner_id`                                                                              |
| **Test Shoot booked**     | A date, a location and the $700 price are agreed                               | `mbv_package` = `test-shoot`, `mbv_first_shoot_date`, `amount` = $700, line item `Test Shoot`                     |
| **Test Shoot delivered**  | Edited Reels and photos have been handed over                                  | `mbv_test_shoot_delivered_at`, `mbv_assets_delivered_count`, `mbv_permission_to_show_work` (yes / no / not-asked) |
| **Full Package proposed** | The $3,500 per month scope has been presented in writing to the decision maker | `mbv_package` = `full-package`, `amount` = $3,500 monthly retail, add-ons as line items                           |
| **Active client**         | The Full Package is agreed and the first month shoot schedule is set           | `closedate`, `amount` (monthly retail), `mbv_shoots_per_month`, `mbv_first_shoot_date`                            |

Off-pipeline:

| Stage           | Enters when                                             | Properties the stage needs                                                 |
| --------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Nurture**     | A real signal of later interest, with a date to revisit | the revisit date; the account re-enters at **Verified** with a fresh audit |
| **Closed lost** | A written no, or a disqualification                     | `closedate`, plus `mbv_disqualified_reason` on the Company                 |

**Active client is the won stage.** No stage is named "Full Package won" and none is named "Proposal". A Deal at **Active client** with `mbv_package` = `full-package` is a won Full Package, and that is what section 12 counts.

## 10c. Agent write policy

Agents may **read** HubSpot freely. Agents may only **propose** writes. Every write follows the approval gate in `C:\dev\skills\local\hubspot-agent-cli\SKILL.md` section 5: read the current values first, `--dry-run`, print a proposed-change table (`Object | ID | Property | Current | New`) with non-empty user-entered values listed as skipped, batches of **10 records or fewer**, wait for the owner's explicit `approve` in chat, execute exactly what was approved, verify by re-reading, and log the approval. Deletes, merges, archiving, bulk `--digest`/`--confirm` applies, backward lifecycle moves, enabling workflows and any consent-flag import are blocked outright.

- Never mapped into HubSpot: client media and footage, signed URLs, contractor identities or rates, production costs, any row copied out of Supabase, consent states copied from another system, and anything about minors.

# 11. Approved examples

- **Studio headline set (approved 2026-09-15, owner decision):** EN H1 "We film Houston." / sub "Weekly content for Houston businesses — Reels, photos, and a posting schedule you actually keep." ES H1 "Filmamos Houston." / sub "Contenido semanal para negocios de Houston: Reels, fotos y un calendario de publicación que sí se cumple."
- **Product tagline (locked):** "You brief. Agents produce. You approve every dollar." (`.superdesign/brand-id.md`).
- Shipped product copy, still approved for the product surface: `apps/web/src/components/landing-page.tsx`, `apps/web/app/signup/page.tsx`, `apps/web/app/maintenance/page.tsx`, `apps/web/src/components/status-screen.tsx` — subject to the name-form correction in section 1.
- Operator-approved high-fidelity frames (2026-08-17): `.superdesign/hifi/composed-review-desktop.html`, `.superdesign/hifi/composed-review-mobile.html` (`docs/ux/EXPERIENCE_CONTRACT.md`). Other frames in `.superdesign/hifi/` are preview fixtures.
- Studio landing page, studio email, Spanish landing page, social captions, GBP posts, print: **none approved yet.** `[OWNER-INPUT-NEEDED]` — approve one reference example per channel once drafted.

# 12. KPIs and objectives

Primary objective (owner decision, 2026-09-15): **land 5 monthly Full Package clients** — social management: Reels, photo shoots, content management. Internal planning arithmetic: 5 × $3,500 = **$17,500 MRR target**. That figure is a **goal, not achieved revenue**, and never appears in public or client-facing copy.

Every KPI below counts a stage name or a property that exists in section 10 and in `docs/gtm/hubspot-mapping.md`. A KPI that cannot name one is not a KPI.

| #   | Objective                           | KPI                                    | Counting rule                                                                                                                                                                                                                                                                                                             | Source                                                                        | Target                 | Cadence                     |
| --- | ----------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------- | --------------------------- |
| 1   | Land 5 monthly Full Package clients | Active Full Package clients            | Distinct Companies with a Deal at stage **Active client** whose `mbv_package` is `full-package`, and at least one delivered shoot inside the reporting month. A month with no delivered shoot does not count, which is how a paused or cancelled client drops out.                                                        | HubSpot Studio pipeline; delivered shoots from the studio operations backbone | 5                      | Monthly, first business day |
| 2   | Same                                | Committed MRR                          | Sum of `amount` on the Deals counted in KPI 1, where `amount` on a `full-package` deal is the monthly recurring retail figure (10a). Add-on line items excluded. Goal only; never published.                                                                                                                              | HubSpot Deal `amount`                                                         | $17,500                | Monthly                     |
| 3   | Fill the top of the funnel          | Test shoots booked                     | Count of Deals **entering** _Test Shoot booked_ with `mbv_first_shoot_date` set, counted on the date the stage changed, not the shoot date. Reschedules do not re-count.                                                                                                                                                  | HubSpot stage history                                                         | `[OWNER-INPUT-NEEDED]` | Weekly, Monday              |
| 4   | Prove the test shoot converts       | Test shoot → Full Package rate         | Cohort by the month a Deal entered _Test Shoot delivered_ (`mbv_test_shoot_delivered_at`). Numerator: those reaching _Active client_ within 60 days of delivery. Denominator: all test shoots delivered in the cohort month.                                                                                              | HubSpot stage history                                                         | `[OWNER-INPUT-NEEDED]` | Monthly, cohort at 60 days  |
| 5   | Keep sourcing legal                 | Contacts with a recorded consent basis | Contacts whose `mbv_consent_basis` is a granting value (`verified-purpose-grant` or `transactional-exact-scope`) **and** whose `mbv_consent_recorded_at` is non-empty, divided by contacts contacted in the period. `BLOCKED-legacy-unknown`, `n-a` and empty all fail. Anything else is a compliance defect, not a lead. | HubSpot Contact properties                                                    | 100%                   | Weekly                      |
| 6   | Software backbone validation gates  | Unchanged product gates                | Workflow completion ≥80%; usable-output rate ≥70%; landed cost per usable pack ≤$5; time to first reviewable static pack median ≤10 min, p90 ≤15 min. Never published as achieved.                                                                                                                                        | `docs/delivery/QUALITY_GATES.md`                                              | as listed              | Per evaluation round        |

Reporting cadence: weekly pipeline read on Monday (KPIs 3 and 5), monthly client and MRR read on the first business day (KPIs 1, 2 and 4). Every number is read from HubSpot, never estimated, and nothing in this table is publishable as a marketing claim (section 4b). KPI 1 is the one line that reads outside HubSpot: no HubSpot property records a delivered shoot and none may be created, so the delivered-shoot check reads the studio operations backbone, which owns post-sale delivery (section 10). No KPI is measurable until the portal exists (section 13); the definitions above are what will be measured, not what has been measured.

GTM artifacts declare objective 1 in their front-matter unless the artifact is explicitly a top-of-funnel piece, in which case objective 3.

# 13. Open items (needs-owner-input)

Each item: the question, and who must answer.

- 2026-09-15 **Street postal address** for CAN-SPAM footers and legal pages — Houston alone is not valid. Street, suite or USPS/virtual mailbox? — **owner** — blocking all commercial email — open
- 2026-09-15 **HubSpot portal** — does Must Be Viral share the owner's existing portal used by another brand in this portfolio, or get its own? — **owner** — blocking every CRM action — open
- 2026-09-15 **Instagram and TikTok handles** — **owner** — open
- 2026-09-15 **Production email from-address and the published DMARC policy** for its domain; DMARC must be at least `p=none` with SPF and DKIM aligned before any bulk send — **owner / whoever controls DNS** — open
- 2026-09-15 **Legal pages blocked** — privacy, terms and the AI/advertising disclosure are to be produced with Anthropic's Legal plugin, which is not installed here. Install it or engage an attorney; no agent writes legal text — **owner** — open
- 2026-09-15 **Consent record and suppression list do not exist**; marketing contact is blocked until both exist and the four acceptance tests in section 8c pass — **owner + engineering** — open
- 2026-09-15 **"Request access" CTA defect** — the shipped CTA links to a page that collects nothing. Build a real form that writes a consent record, or remove the CTA. Which? — **owner** — open
- 2026-09-15 **Testimonials and portfolio permission** — no written permission is on file for any client name, logo, quote or delivered clip, so none may be published. Who grants the first? — **owner** — open
- 2026-09-15 **Logo mark — owner approval.** The mark, wordmark, both lockups, favicon, mono and reverse variants, the specimen sheet and the usage rules are delivered in `brand/logo/` at `status: draft`. Outstanding: the owner approves or rejects the mark; which raster exports (`.ico`, PNG favicons, OG and app icons) are needed and for which surfaces, given there is no `apps/web/public/` directory yet; and trademark clearance for the name and the mark, which is a question for an attorney and not a matter any agent may opine on — **owner** — open
- 2026-09-15 **Palette and type divergence** between the identity documents and the shipped tokens (section 5) — recorded and deliberately unreconciled — **owner** — open
- 2026-09-15 **Unpublished small-tier price conflict** — an internal pricing source states two different prices for the small tier on its summary page and its detail page. Irrelevant to published pricing (the tier is not sold), but reconcile it before ever selling that tier. The figures are deliberately not recorded here because this repository is public — **owner** — open
- 2026-09-15 **ZoomInfo connector is not authorised** in this workstation, so no list has been pulled and no real count exists. Authorise it. Until then the planning target recorded in section 2 and in `docs/gtm/outbound-target-lists.md` section 3 stands at 200 accounts per persona, 1,200 total, resting on an assumed 25 personalised sends per human sender per week; confirm or replace both numbers — **owner** — open
- 2026-09-15 **Spanish reviewer** — who is the named fluent speaker who reviews and signs off Spanish copy before publishing? — **owner** — open
- 2026-09-15 **Public business hours, their scope, and any response-time commitment** we may state — **owner** — open
- 2026-09-15 **Google Business Profile** — does one exist for the studio, and is it verified as a service-area business? — **owner** — open
- 2026-09-15 **Add-on range rule** — what determines the point inside $200–$400 (24-hour turnaround) and $300–$600 (drone)? — **owner** — open
- 2026-09-15 **Contracted crew paperwork** — is there a standard contractor agreement covering IP assignment, usage rights and model releases for videographers and photographers? Portfolio and delivery claims depend on it — **owner** — open
- 2026-09-15 **Software pilot offer after the pivot** — is the $500 setup / $149-per-month / prepaid-wallet pilot in `docs/architecture/EXECUTION_PROVIDERS_AND_BILLING.md` still live, and do studio clients ever receive a login to the backbone? — **owner** — open
- 2026-09-15 **Stale shipped name form** — `README.md`, `PROJECT_STATE.yaml`, `apps/web/src/components/landing-page.tsx` and `.studio-wordmark` in `apps/web/app/globals.css` still render the one-word "MustBeViral Studio" in public-facing strings; UI strings must move to "Must Be Viral" while code identifiers stay unchanged — **owner to schedule a packet** — open
- 2026-09-15 **KPI targets for the two funnel metrics** — what monthly target for test shoots booked, and what target test-shoot → Full Package conversion rate? — **owner** — open
- 2026-09-15 **Approved reference examples** — one per channel (studio landing, Spanish landing, cold email, IG caption, GBP post) once drafted — **owner** — open
- 2026-09-15 **Diff scope — the in-branch amendment cannot admit its own commit.** `governance/scripts/validate-diff-scope.mjs` reads `docs/delivery/ACTIVE_WORK_PACKET.yaml` from `git merge-base <base> <head>`, not from HEAD, so the five-path amendment made on this branch is invisible to the check: the merge base (`966006b`, `origin/codex/viralgraph-cleanroom`) carries no `brand/**` entry and `pnpm diff-scope:check` fails. Fix, in this order: land the five-path amendment as its own commit on the base branch, rebase this branch onto it, then run `pnpm install --frozen-lockfile` followed by `pnpm diff-scope:check --base <base> --head HEAD`, `pnpm docs:check`, `pnpm governance:check`, `pnpm format:check` and `pnpm generated:check`. **None of those gates has been run.** This worktree has no `node_modules` and no `pnpm`, so nothing here is verified against the repository gates, and the markdown in `brand/` and `docs/gtm/` has never been through Prettier 3.9.5 — expect `format:check` to rewrite table padding — **lead** — open

# Changelog

- v2 (2026-09-15) — rewritten for the studio motion. Records ERLV INC DBA Must Be Viral, the three-word name form, Ashley Ansons as the public face with the owner anonymous, the two surfaces and the never-mix rule, the locked studio headlines EN/ES, six Houston B2B personas with triggers, two voices with EN and ES do/don't pairs and an expanded kill-list, studio claims discipline, retail pricing ($700 Test Shoot, $3,500/month Full Package, add-ons) with the no-discount and no-published-lower-tier rules, the blocked legal pages, the consent and suppression requirement with its acceptance test, per-surface disclosure requirements, the channel table with the DMARC precondition, the HubSpot Studio pipeline mapping — one persona id scheme (`h1-med-spa-aesthetics` … `h6-real-estate-teams`), one `mbv_` property convention and the eight-stage Studio pipeline, shared verbatim with `docs/gtm/hubspot-mapping.md` — with the read-only-by-default agent gate, the five-client KPI set counted against stages and properties that exist, and the delivered logo system in `brand/logo/` awaiting owner approval. Schema `brand-context/v1`, all sections 1–13 retained. Open items: 22.
- v1 (2026-09-15) — initial, from the `brand-context` skill templates. `brand/tokens.css` and `brand/fonts.ts` deliberately not created because the repository already owns both sources. Open items: 19.
