---
doc_id: gtm-hubspot-mapping
---

# HubSpot object mapping — Must Be Viral Studio

The concrete implementation of the CRM object mapping in `brand/context.md` section 10, which is the authority. The persona ids, the `mbv_` property names and the stage names in this document and in section 10 are the same strings; neither document carries a second scheme, and a disagreement between them is a defect to be reconciled, not a variant to be chosen from. HubSpot is the pre-sale system of record. Supabase Postgres stays the post-sale system of record for identity-linked relational truth, runs, quotes, ledger entries and audit events (`docs/architecture/SYSTEM_OVERVIEW.md`); HubSpot never becomes a second authority over any of it.

`[OWNER-INPUT-NEEDED]` — Does Must Be Viral use its own HubSpot portal, or share a portal the owner already operates for another business? Record the portal id, the region, the tier and the dedicated agent user here once decided. The id is deliberately not guessed, and another business's portal id is deliberately not written into this public repository.

`[OWNER-INPUT-NEEDED]` — Which HubSpot tier applies? Tier decides whether the product library, line items, quotes, sequences and workflows exist at all. On a free portal, pipelines and properties are created in the HubSpot interface rather than through the CLI, and quotes are read-only.

## 1. Object boundary

- **Contacts** — a person at a Houston business. Prospects, replies, referrals. Never a person who only exists as a row in a purchased list without a verification step.
- **Companies** — the Houston business itself. The persona, the location facts and the content audit live here.
- **Deals** — one engagement in the Studio pipeline. A test shoot is a deal. A Full Package subscription is a deal. A renewal is not a new deal.
- **Line items** — the package and add-ons attached to a deal.
- **Never in HubSpot, under any circumstances**: customer media, signed URLs, provider request or artifact identifiers, ledger rows, workspace secrets, or any row copied out of Supabase (`brand/context.md` section 10). Consent states are never copied in from another system.

## 2. Contacts

Standard properties used as HubSpot defines them:

- `firstname`, `lastname` — single-line text. Personalisation and the greeting register; the Spanish sequence uses formal `usted` regardless.
- `email` — the unique identifier for a contact and the key the suppression check normalises on.
- `phone`, `mobilephone` — phone number. Recorded, but not a contact channel: no SMS programme exists and none may be started without its own consent basis and registration.
- `jobtitle` — single-line text. Confirms the decision maker is the owner or the person who runs marketing.
- `city`, `state` — single-line text. Confirms the Houston metro filter.
- `lifecyclestage` — dropdown. HubSpot's own progression; set from the deal stage, never by hand.
- `hs_lead_status` — dropdown. Working state within a stage.
- `hubspot_owner_id` — HubSpot user. The human accountable for the relationship. Never an agent.
- `hs_email_optout` — read-only for agents. A HubSpot-side opt-out is authoritative against sending and is never written back upward.

Custom properties. Internal name, type, and why it exists:

- `mbv_persona` — dropdown (`h1-med-spa-aesthetics`, `h2-restaurant-bar-coffee`, `h3-gym-studio-coach`, `h4-auto`, `h5-home-services`, `h6-real-estate-teams`). The same six ids as `brand/context.md` section 2 and `docs/gtm/outbound-target-lists.md` section 3, so reporting is per persona.
- `mbv_language` — dropdown (`en`, `es`). Which sequence and which reviewed copy this person receives. Set from observation, never assumed from a surname.
- `mbv_source_system` — dropdown (`zoominfo`, `site-form`, `referral`, `event`, `manual`). Provenance for every record, required before any send.
- `mbv_consent_basis` — dropdown (`verified-purpose-grant`, `transactional-exact-scope`, `BLOCKED-legacy-unknown`, `n-a`). A mirror of the Supabase consent record, never the authority.
- `mbv_consent_recorded_at` — date picker. When the mirrored consent record was captured.
- `mbv_consent_proof_url` — single-line text. Pointer to the proof held in Supabase. Never the proof itself.
- `mbv_suppressed` — single checkbox. Mirror of the suppression list. Checked blocks every send.
- `mbv_suppression_reason` — dropdown (`unsubscribe`, `complaint`, `hard-bounce`, `do-not-contact`, `invalid`). Why contact stopped.
- `mbv_last_verified_at` — date picker. When a human last confirmed the business exists and the contact is current.

Consent direction rule: consent and suppression are written in Supabase first and mirrored into HubSpot afterwards. A HubSpot edit never creates consent, never upgrades a basis, and never clears a suppression flag.

## 3. Companies

Standard properties: `name`, `domain`, `website`, `phone`, `city`, `state`, `numberofemployees`, `industry`, `hubspot_owner_id`.

Custom properties:

- `mbv_persona` — dropdown, same six values. The company-level persona; the contact inherits it.
- `mbv_location_count` — number. Single or few locations is part of the qualification filter.
- `mbv_content_state` — dropdown (`none`, `stale`, `inconsistent`, `borrowed-or-stock`, `strong`). The outcome of the verification step. `strong` disqualifies the account.
- `mbv_content_audit_notes` — multi-line text. What was actually observed, in one or two sentences, with the date. This is the only permitted basis for a personalised opening line.
- `mbv_content_audit_at` — date picker. When that audit was done. An audit older than the owner's chosen window is re-run before any send.
- `mbv_language` — dropdown (`en`, `es`). How the business presents itself, which decides the sequence variant.
- `mbv_disqualified_reason` — dropdown (`strong-content`, `agency-under-contract`, `national-chain`, `out-of-area`, `out-of-band-size`, `unreachable`, `not-trading`). Keeps a rejected account from being re-sourced into the next wave.

## 4. Studio pipeline

Pipeline name: **Studio**. One pipeline, one set of stages. Every stage has an entry criterion that must be true to enter and an exit criterion that must be true to move on.

1. **Sourced** — Entry: the account matches a persona filter and has been written to HubSpot with `mbv_persona` and `mbv_source_system`. Exit: the verification step has been run.
2. **Verified** — Entry: a human confirmed the business is trading and recorded `mbv_content_state` and `mbv_content_audit_notes`. Exit: `mbv_content_state` is not `strong`, and the pre-send consent and suppression check passes.
3. **Contacted** — Entry: a human sent the first compliant message and the activity is logged with the consent record id. Exit: a reply from the contact, or the sequence is exhausted.
4. **In conversation** — Entry: the contact replied and is engaged. Exit: a test shoot is scheduled with a date, or the account is moved to nurture or lost.
5. **Test Shoot booked** — Entry: a date, a location and a price of $700 are agreed, and the Test Shoot line item is on the deal. Exit: the shoot has happened.
6. **Test Shoot delivered** — Entry: the edited Reels and photos have been handed over and `mbv_test_shoot_delivered_at` is set. Exit: the Full Package has been presented.
7. **Full Package proposed** — Entry: the $3,500 per month scope has been presented in writing to the decision maker. Exit: a written yes or a written no.
8. **Active client** — Entry: the Full Package is agreed and the first month's shoot schedule is set, with `amount` at the monthly retail figure and `mbv_shoots_per_month` set. Exit: none. The deal stays here; the relationship is now post-sale and Supabase owns it. This is the won stage: there is no stage called "Full Package won", and the client-count and MRR KPIs in `brand/context.md` section 12 count `full-package` deals here.

Off-pipeline stages:

- **Nurture** — Entry: a real signal of later interest with a date to revisit. Exit: the date arrives and the account re-enters at Verified with a fresh audit.
- **Closed lost** — Entry: a written no, or a disqualification recorded in `mbv_disqualified_reason`. Exit: none, unless the owner personally re-opens it.

## 5. Line items

Published retail prices only. Cost, margin, supplier names and the word markup never appear on a record, a quote, a property or a note.

- **Test Shoot** — `$700`, one-time. One shoot, up to 2 hours; 2 edited Reels; 15 to 25 edited photos; creative direction on set; formatted for Instagram and TikTok, ready to post.
- **Full Package** — `$3,500` per month, recurring monthly. 4 to 8 shoots per month at 2 to 3 hours each; 12 to 16 or more edited Reels; 120 to 200 edited photos; lifestyle, branding, product and team photography; cinematic brand content; full creative direction; monthly content strategy and calendar; hook and caption assistance; trend research; Instagram and TikTok optimisation; behind-the-scenes and story content; a monthly strategy meeting; priority editing; drone and aerial included where applicable.
- **24-hour turnaround** — per shoot, `$200` to `$400`. A range, so the deal carries the agreed unit price; the range itself is never quoted as a single number after the price is agreed.
- **Drone** — per shoot, `$300` to `$600`. Same rule. Included in the Full Package where applicable, in which case no add-on line item is created.

Only these two packages are sold. Smaller tiers are not published and are not created in the product library.

Deal-level custom properties:

- `mbv_package` — dropdown (`test-shoot`, `full-package`). Which offer this deal represents.
- `mbv_shoots_per_month` — number. The agreed cadence inside the 4 to 8 shoots per month band. The band is the shoot count; 2 to 3 is the length of each shoot in hours and is never recorded here.
- `mbv_first_shoot_date` — date picker. The commitment that makes stage 5 real.
- `mbv_test_shoot_delivered_at` — date picker. The day the edited Reels and photos were handed over. Stage 6 entry, and the cohort date for the test-shoot conversion KPI (`brand/context.md` section 12, KPI 4).
- `mbv_assets_delivered_count` — number. How many edited assets were handed over, against what the package promised.
- `mbv_permission_to_show_work` — dropdown (`yes`, `no`, `not-asked`). Whether written permission exists to show this work publicly. `yes` requires the permission record described in `brand/context.md` section 4c; nothing is published on the strength of this field alone.
- `mbv_addon_rush`, `mbv_addon_drone` — single checkbox each. Whether the add-on was sold, with the agreed amount on the line item.
- `mbv_language` — dropdown (`en`, `es`). Which language the engagement is run in.

Standard deal properties used as HubSpot defines them: `dealname`, `amount`, `dealstage`, `pipeline`, `closedate`, `hubspot_owner_id`.

**`amount` carries the money and there is no `mrr` property.** On a `full-package` deal, `amount` is the monthly recurring retail figure, $3,500; on a `test-shoot` deal it is the one-time $700. Add-ons stay on their own line items and are never folded into `amount`. Committed MRR (`brand/context.md` section 12, KPI 2) is the sum of `amount` across `full-package` deals at **Active client**, so no separate MRR property is created.

## 6. Agent rule

- **Read freely.** Any agent may read objects, properties, pipelines, stages and owners without approval.
- **Every write goes through the approval table.** The gate in the `hubspot-agent-cli` skill applies without exception: read the current values, run the change as a dry run, present a proposed-change table showing old and new values for each record, keep batches to at most 10 records, wait for the owner's explicit approval, then execute, verify and log. No write is bundled with a read, and no write is inferred from a task description.
- **Never enrol an existing customer in prospecting sequences.** An account at Active client is post-sale. No prospecting email, no sequence, no marketing workflow, no task that messages them.
- **No agent sends anything.** The CLI exposes no sequences API and none is emulated. A human sends.
- **Never write consent upward** (unknown to granted), never bundle email and SMS consent, and never clear a suppression flag. Suppression always wins.
- **Never delete or merge records.** A wrong record is reported, not removed.
- **Data hygiene.** Ask for the minimum properties, keep scratch exports in the session scratch directory, never commit an export, and keep emails, phone numbers and names out of task notes and reports beyond what the owner needs in order to approve a change.

## 7. Open items

- 2026-09-15 HubSpot portal id, region, tier and the dedicated agent user for Must Be Viral — open
- 2026-09-15 Whether the portal supports the product library and line items, or whether packages are tracked on deal properties only — open
- 2026-09-15 Whether the prospecting pipeline may be created at all before the consent store exists; HubSpot records are not consent — open
- 2026-09-15 An unpublished small tier appears at two different prices in the owner's own pricing sheet and should be reconciled before that tier is ever sold. The two figures are deliberately not written here because this repository is public and the tier is not published — open
