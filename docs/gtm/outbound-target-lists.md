---
doc_id: gtm-outbound-target-lists
---

# Outbound target lists — specification

**No list has been pulled.** The ZoomInfo connector is not authorised in this workstation, so every account count below is a planning target, not a count of real records. Nothing in this document may be presented as a sourced list, a market size or a forecast. Marketing contact is blocked until the consent record and suppression list described in `docs/gtm/consent-and-suppression.md` exist.

Source of every business fact here: owner decisions recorded 2026-09-15, plus `brand/context.md`. Where neither settles a question the line reads `[OWNER-INPUT-NEEDED]`.

## 1. GTM front-matter

Every artifact drafted from this spec (email, sequence, one-pager, ad) opens with the front-matter required by the `brand-context/v1` schema. This document carries only `doc_id` in its own front-matter because `docs/MANIFEST.yaml` allows exactly one key there; the GTM block below is the template artifacts copy.

```text
artifact: <slug>
type: <email | sequence | landing | social>
objective: Land 5 monthly Full Package clients
audience: <persona id from section 3>
channels: [email]
languages: [en]            # add es for the Spanish variant
consent_basis: BLOCKED-legacy-unknown
claims_checked: true
status: draft
owner_approval: required
```

`consent_basis` stays `BLOCKED-legacy-unknown` for every outbound artifact until the consent store exists. An agent never writes `approved`.

## 2. Objective and KPI

- Persona ids below are the ids in `brand/context.md` section 2 and the `mbv_persona` dropdown values in `docs/gtm/hubspot-mapping.md`. One scheme, three documents.
- Primary objective, owner decision 2026-09-15: **land 5 monthly Full Package clients** — social management covering Reels, photo shoots and content management.
- Secondary measures: test shoots booked, and test-shoot to Full Package conversion.
- Internal planning arithmetic, from published retail prices only: 5 × $3,500 = $17,500 monthly recurring. This is a target, never an achieved result, and never appears in customer-facing copy, a case study or a public page.
- No response-rate, meeting-rate or close-rate evidence exists for this brand. No outbound has been sent (`brand/context.md`, section 9). Any funnel maths beyond the line above would be invented, so none is written here.

## 3. Personas

Common filter, applied to all six personas:

- Geography: Houston metro. Single location, or a few locations under one owner.
- Employee band: 3 to 100.
- Decision maker: the owner, or the person who actually runs marketing. Not a corporate marketing department, not a franchise head office, not an agency.
- Excluded: national chains, franchisors, businesses whose social accounts are run by an incumbent agency under contract, and any account already on the suppression list.
- Language: English first. A Spanish variant of the sequence exists for accounts where the business presents itself in Spanish; that copy is written in neutral Latin-American Spanish with formal `usted` on first contact, never machine translated, and reviewed by a fluent speaker before any send (owner decision 2026-09-15).

Planning-target list size: **200 accounts per persona, 1,200 total** — the same figure recorded in `brand/context.md` section 2, which is the authority for it. Basis, stated plainly so it is not mistaken for research: the sizes are equal across personas because no Houston firmographic counts exist in this workstation, and 200 is eight weekly waves of 25 sends, 25 being the assumed volume one human sender can personalise and send in a week. That weekly figure is an assumption, not a measurement. `[OWNER-INPUT-NEEDED]` — Confirm the weekly send capacity and confirm or replace each per-persona size once ZoomInfo returns real counts.

### 3.1 `h1-med-spa-aesthetics`

- Firmographic filter: med spas, aesthetics and injectables clinics, laser and skin studios, cosmetic dentistry with a visible retail front. Classified under personal care and outpatient cosmetic services rather than general medical practice.
- Buying trigger: a new provider, device or treatment is being introduced and there is nothing to show it with; or the Instagram grid is a mix of vendor stock images and reposted manufacturer creative.
- Opening-line angle: name the specific treatment they are trying to fill and the fact that their feed shows no footage of it happening in their own room. Offer the test shoot as the way to get that footage.
- Planning-target size: 200.

### 3.2 `h2-restaurant-bar-coffee`

- Firmographic filter: independent restaurants, bars, coffee shops and bakeries. One to five locations, owner-operated.
- Buying trigger: a menu change, a patio or room opening, a seasonal push, or a gap of several weeks in posting after a busy period.
- Opening-line angle: name a dish or drink that is clearly the house signature and point out that the newest photo of it is old or was taken by a guest. Offer a two-hour shoot that covers the whole menu refresh.
- Planning-target size: 200.

### 3.3 `h3-gym-studio-coach`

- Firmographic filter: gyms, boxing and jiu-jitsu gyms, pilates, yoga and cycle studios, and independent coaches with a physical space. Membership businesses, not equipment retailers.
- Buying trigger: an intake cycle, a challenge or a new class block; or a feed built from screenshots, text cards and reposted quotes rather than footage of their own floor.
- Opening-line angle: name their intake cycle and the fact that a prospective member cannot see the room, the coaches or a class from the outside. Offer weekly footage tied to the cycle.
- Planning-target size: 200.

### 3.4 `h4-auto`

- Firmographic filter: independent dealers, detailing and ceramic coating shops, custom and performance shops, wheel and wrap shops. Excludes franchised dealer groups with corporate marketing.
- Buying trigger: inventory or build turnover that outruns the photography; or listing photos shot on a phone in a crowded lot.
- Opening-line angle: name a specific build or unit on their lot and the fact that the only images of it are lot snapshots. Offer a repeatable shoot cadence that keeps pace with turnover.
- Planning-target size: 200.

### 3.5 `h5-home-services`

- Firmographic filter: contractors and home services — remodelling, roofing, HVAC, plumbing, electrical, landscaping, pools, pest. Local operators with crews, not national franchises.
- Buying trigger: finished jobs that were never documented; a seasonal demand window; or a website gallery of before-and-after photos taken years ago by a crew member.
- Opening-line angle: name the job type they clearly do most and the fact that the finished work is invisible online. Offer on-site capture of a real job, edited for Reels.
- Planning-target size: 200.

### 3.6 `h6-real-estate-teams`

- Firmographic filter: independent agent teams and boutique brokerages. Team-level marketing decisions, not brokerage-wide corporate marketing.
- Buying trigger: a listing cadence that needs both listing media and agent-brand content; or a feed that carries listing flyers and no footage of the agents.
- Opening-line angle: separate listing photography from the agent's own brand content, and point out that only the first exists today. Offer the monthly cadence that covers both.
- Planning-target size: 200.

## 4. Voice rules for anything drafted from this spec

- Use the studio voice: warm, local, concrete and priced. The product voice from `.superdesign/brand-id.md` belongs to the software surface only. Never mix the two on one surface (owner decision 2026-09-15).
- Retail prices only: Test Shoot $700 one-time; Full Package $3,500 per month; 24-hour turnaround +$200 to $400 per shoot; drone +$300 to $600 per shoot, included in the Full Package where applicable. Never write cost, margin, supplier names or the word markup.
- Never promise a view count, a follower count, a booking volume or that anything will go viral. Never use discount language, fake urgency or a superlative. The kill-list in `brand/context.md` section 3 applies to outbound in both languages.
- Never publish or imply the owner's name. Public copy is signed by role, "Must Be Viral Studio". Ashley Ansons is the named public face of the studio (owner decision 2026-09-15).
- Write the brand as "Must Be Viral" in every piece of copy, subject line and signature. `MustBeViral` stays a code identifier only.

## 5. Sequencing rule

Every outbound account moves through these steps in order. A step may not be skipped, and an account that fails a step stops there.

1. **Source.** Pull the account from the ZoomInfo filter for its persona. Record the persona id and the source system on the record.
2. **Verify.** Confirm the business exists and is trading, then audit its content. The account only continues if its content is weak or inconsistent — no recent posting, borrowed or stock creative, or an obvious gap between how the business presents in person and online. Record what was observed. An account with strong current content is marked not a fit, not contacted.
3. **Draft.** The drafting bot writes from the verified observation and this spec. Every claim traces to `brand/context.md` section 4 or to the owner decisions. Drafts are drafts.
4. **Human sends.** A person reads the draft and sends it. No agent sends anything, schedules anything or triggers a sequence.
5. **Log to HubSpot.** The contact, company, deal and the activity are written through the approval gate in `docs/gtm/hubspot-mapping.md`. HubSpot records the outreach; it never grants consent.
6. **Suppression check before every send.** The check in `docs/gtm/consent-and-suppression.md` runs immediately before each individual send, including every follow-up in a sequence, not once per campaign. A suppression hit stops the send and every future send to that contact point. Until the consent store and suppression list exist, this check fails closed and no outbound send is permitted at all.

## 6. Open items

- 2026-09-15 The ZoomInfo connector is not authorised in this workstation; no list has been pulled and every size here is a planning target — open
- 2026-09-15 Weekly send capacity per human sender, and confirmation or replacement of each per-persona list size — open
- 2026-09-15 Street postal address for the CAN-SPAM footer; Houston alone is not a valid postal address — open
- 2026-09-15 Marketing contact is blocked until the consent record and suppression list exist — open
