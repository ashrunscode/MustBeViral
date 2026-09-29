---
doc_id: gtm-legal-input-pack
---

# Legal input pack — facts for privacy, terms and disclosure

**This document contains no legal text and no legal advice.** It is a facts-only input pack for the party who will write the pages: Anthropic's Legal plugin, which is not installed in this workstation, or an attorney. Nothing here is a policy, a clause, a term or an opinion about which law applies.

**The pages are blocked until that review happens.** The privacy policy, the terms of service and the AI and advertising disclosure may not be drafted, published or linked from any surface until the plugin is installed or an attorney is engaged, and the resulting text is reviewed and approved by the owner.

Every fact below comes from the owner decisions recorded 2026-09-15 or from a file in this repository. Where neither settles a question the line reads `[OWNER-INPUT-NEEDED]`. This repository is public, so no private financials, supplier names, customer data or internal margins appear here.

## 1. Entity and contact

- Legal entity: **ERLV INC**, doing business as **Must Be Viral**. Used for contracts, email footers and legal pages.
- Public name in all copy and legal text: **Must Be Viral**, three words. `MustBeViral` and `mustbeviral` remain code, package and repository identifiers only and are not the public name.
- Operating location: Houston, Texas, United States.
- Phone: 713-899-9346.
- Email, also the approved reference and reply-to address: studio@mustbeviral.com.
- Street postal address for the footer and the legal pages: `[OWNER-INPUT-NEEDED]` — A street address, suite or mailbox is required. Houston alone is not a valid postal address.
- Named public face of the studio: Ashley Ansons. The repository owner is never named in public copy; role-only signature, "Must Be Viral Studio".
- Domains in use: `mustbeviral.com` and `api.mustbeviral.com`, with `staging.mustbeviral.com` and `api-staging.mustbeviral.com` for staging (`docs/architecture/SYSTEM_OVERVIEW.md`).

## 2. What the business does

Two distinct activities. The reviewer needs both, and they are never blended into one description.

- **The studio service.** Done-for-you content production and social management sold to Houston businesses. Staffed by contracted videographers and photographers. Deliverables are edited Reels and photos, a content calendar and posting support. Retail prices: Test Shoot $700 one-time; Full Package $3,500 per month; 24-hour turnaround add-on $200 to $400 per shoot; drone add-on $300 to $600 per shoot.
- **The agentic software.** The existing workflow in `apps/web` — brief, quote, run, review, receipt — is the operations backbone behind the studio service. It is not what these Houston customers are buying. Its own product surface is in closed evaluation: enrollment is invitation-only, signup is manual and allowlist-based, and the production environment is not generally available (`apps/web/app/signup/page.tsx`; `PROJECT_STATE.yaml`).

## 3. Data collected, and where

- **Site form.** No working form exists yet. The shipped "Request access" call to action links to a page that collects nothing (`apps/web/app/signup/page.tsx`). When a form is built it will collect at minimum a name, a business name, an email address and a consent record as specified in `docs/gtm/consent-and-suppression.md`, and will capture IP address and user agent alongside the consent grant.
- **Email outreach.** Business contact data sourced from a B2B data provider: name, job title, business email, business phone, company name, company address band, employee band and industry. Reply content is retained as sales correspondence. No list has been pulled; the provider connector is not authorised yet.
- **Client content.** Video and photography produced on client premises. This routinely includes images of identifiable people: owners, staff and, in hospitality and fitness settings, potentially customers and members. It includes business premises, products, and third-party branding visible on site. Model and property releases: `[OWNER-INPUT-NEEDED]` — What release is obtained, from whom, and at what point in the shoot?
- **Account and product data.** For the software surface: authentication identity through Supabase Auth, workspace-scoped relational records, briefs, runs, quotes, ledger entries and audit events in Supabase Postgres. Media bytes are stored in private object storage and are private by default; they are copied out of temporary provider storage into private storage immediately after verification (`docs/product/PRODUCT_CONTRACT.md`; `docs/architecture/SYSTEM_OVERVIEW.md`).
- **Analytics and telemetry.** A Web Vitals reporter in the web application, plus error, trace and alert telemetry. There is no product analytics and no marketing attribution today; paid acquisition stays off until attribution is verified (`brand/context.md` section 9).
- **Payments.** `[OWNER-INPUT-NEEDED]` — How are studio customers invoiced and paid, and which payment processor handles it? The billing paths in this repository describe the software product's pilot billing, not the studio service.

## 4. Processors and subprocessors

Each entry names what it does for this business. Contract status, data processing agreements and regions are for the reviewer to confirm.

- **Vercel** — hosts `apps/web`, the Next.js web application (`README.md`; `docs/architecture/SYSTEM_OVERVIEW.md`).
- **Cloudflare** — runs `apps/core` and `apps/collaboration` as Workers, and holds media in private object storage.
- **Supabase** — Postgres database and authentication; the system of record for identity-linked relational truth.
- **HubSpot** — customer relationship management, pre-sale only. Portal id `[OWNER-INPUT-NEEDED]`.
- **Resend** — transactional email delivery and the SMTP path for Supabase Auth. The adapter fails closed without an API key (`packages/email/src/index.ts`).
- **ZoomInfo** — B2B contact and firmographic data for outbound. Named by the owner as the intended source. Not authorised in this workstation, and no data has been pulled.
- **Postiz** — social scheduling, named by the owner as a processor to cover. Not configured in this repository today.
- **Error and performance telemetry** — Sentry and OpenTelemetry for errors, traces and alerts (`docs/architecture/SYSTEM_OVERVIEW.md`).
- **Model and media providers** — the execution providers the software routes to. Per-route training and retention posture is per model and privacy-gated, so no blanket statement about model training may be made (`docs/research/MODEL_CATALOG_EVIDENCE.md`).
- `[OWNER-INPUT-NEEDED]` — Which accounting, invoicing, payment, scheduling, file-delivery and storage tools does the studio side use? Contracted videographers and photographers are also recipients of client content and need to be covered.

## 5. Retention

- Consent records and suppression entries: as specified in `docs/gtm/consent-and-suppression.md`. Suppression entries are permanent; the consent retention period after last contact is `[OWNER-INPUT-NEEDED]`.
- Client media: `[OWNER-INPUT-NEEDED]` — How long are raw footage, selects and delivered files kept, and what happens to them when an engagement ends?
- Sales correspondence and CRM records: `[OWNER-INPUT-NEEDED]`.
- Product data, logs and telemetry: `[OWNER-INPUT-NEEDED]` — Confirm against the retention already configured for the Supabase, object storage and telemetry services.

## 6. Rights requests

- Intake channel: studio@mustbeviral.com is the only published address today.
- Identity verification method, response time commitment and the internal owner of these requests: `[OWNER-INPUT-NEEDED]`.
- Known constraint to hand the reviewer: a suppression entry survives an erasure request in reduced form, because deleting it would re-enable contact the person asked to stop.
- Requests about a person who appears in client media raise a separate question from requests by a client: `[OWNER-INPUT-NEEDED]` — Who handles a request from someone filmed on a client's premises, the studio or the client?

## 7. Jurisdiction context

Facts only. Which statutes apply, and what any of them require, is for the reviewer to determine.

- The business is incorporated and operating in the United States and based in Houston, Texas.
- Customers are Houston-area businesses. The engagement is business-to-business.
- Outbound is cold business-to-business email to United States recipients. The owner already requires a street postal address in the footer for CAN-SPAM purposes; that requirement is the owner's, recorded here as a fact, not as a legal conclusion.
- The site is publicly reachable and is not geo-restricted. Whether visitors outside the United States create obligations is for the reviewer.
- Content is published to Instagram and TikTok on behalf of clients, so those platforms' own terms and advertising rules also bear on the service.
- A Spanish-language sales surface is planned. Whether any disclosure must be presented in Spanish as well as English is for the reviewer; the owner's decision is that Spanish copy is written and reviewed by a fluent speaker, never machine translated.

## 8. Page-by-page inputs

### 8.1 Privacy policy

Facts the writer needs: sections 1, 3, 4, 5 and 6 of this document. Specifically the entity and contact block, every collection point (site form, email outreach, client content, product and account data, analytics), the processor list, the retention answers once given, and the rights-request intake.

Open before drafting: street postal address; payment processor; studio-side tooling; retention periods; rights-request handling for people appearing in client media.

### 8.2 Terms of service

Facts the writer needs: the two distinct activities in section 2 and the fact that they are sold separately; the retail prices and what each package includes; the add-on price ranges; the use of contracted videographers and photographers rather than employees; that deliverables are produced on client premises; and, for the software surface, that it is in closed evaluation with manual, allowlist-based admission and is not generally available.

Open before drafting: `[OWNER-INPUT-NEEDED]` — cancellation and notice terms for the monthly package; rescheduling and weather policy for shoots; who owns the footage and what licence each side gets; usage rights in the studio's own portfolio and marketing; deposit, payment terms and late payment; what happens to undelivered work if an engagement ends mid-month.

### 8.3 AI and advertising disclosure

Surfaces the disclosure has to cover, each a fact about how the work is actually produced:

- **AI-assisted editing** of studio deliverables: where AI tooling touches client photography or video, and to what extent.
- **Agentic software runs**: the brief-to-receipt workflow generates creative through model providers. The product already commits that nothing presented as generated is a hidden mock or silent fallback, and that a pinned revision, model route, provider and price basis stay inspectable (`docs/product/PRODUCT_CONTRACT.md`).
- **Outbound email drafted by a bot and sent by a human**: the owner's decision is that a drafting bot writes and a person sends. Whether that needs disclosing is for the reviewer.
- **Paid partnerships and sponsored content** published on behalf of clients.
- **Testimonials and results claims**: none exist with written permission on file today (`brand/context.md` section 4). Any future testimonial needs attribution, a date and permission before publication.
- Existing constraints the disclosure must not contradict: no promise that content will go viral or hit a performance number; no superlatives; no comparative claims naming a competitor; no claim that customer data is never used for model training, because routing posture is per model and privacy-gated.

Open before drafting: `[OWNER-INPUT-NEEDED]` — Exactly which steps of the studio deliverable pipeline use AI tooling, and does the owner want a disclosure line on delivered content, on the site, or both?

## 9. Open items

- 2026-09-15 Privacy policy, terms of service and AI and advertising disclosure are blocked until Anthropic's Legal plugin is installed or an attorney is engaged, and the text is reviewed — open
- 2026-09-15 Street postal address for the footer and legal pages — open
- 2026-09-15 Payment processor and invoicing path for the studio service — open
- 2026-09-15 Studio-side tooling and the contracted crew as recipients of client content — open
- 2026-09-15 Model and property releases for people and premises appearing in client media — open
- 2026-09-15 Retention periods for client media, sales correspondence, CRM records and product data — open
- 2026-09-15 Footage ownership, licence and portfolio usage rights — open
- 2026-09-15 Cancellation, rescheduling, deposit and payment terms for the monthly package — open
- 2026-09-15 Which steps of the deliverable pipeline use AI tooling, and where the disclosure appears — open
