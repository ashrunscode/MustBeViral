---
doc_id: roadmap
---

# Full-platform delivery roadmap

Accepted September 9, 2026 under ADR-0007 and the committed owner instruction. All 65 work units below are required program scope. Historical implementation and receipts remain valid only for their original evidence. These are delivery definitions, not claims that the features are already shipped.

## Work units

The following waves are accepted delivery milestones implemented through bounded active packets. Every wave has a complete user outcome. Work units are bounded slices with their own checks; split any unit that cannot be reviewed coherently. Existing working functionality is adapted rather than recreated.

### Wave 0 — Accept the new product and establish a trustworthy baseline

Dependency: the accepted owner direction in ADR-0007.

| ID   | Deliverable                                                                                                                           | Proof required                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| W0.1 | Reconcile product contract, release scope, DTC decision, terminology, UX/architecture, and manifest around the full platform.         | One accepted authority per topic; no contradictory agency/import/publishing exclusion remains.       |
| W0.2 | Record a current feature/evidence inventory separating code, connected staging proof, production proof, and unavailable capabilities. | Every claimed capability links to a route, command, test, or observed workflow.                      |
| W0.3 | Reproduce the supplied navigation, sentinel-workspace, billing-model, and styling problems in a controlled browser.                   | Evidence for each failure, exact trigger, and a repair acceptance case.                              |
| W0.4 | Prototype the studio → brand → assets → campaign → review journey and choose the visual direction using actual brand materials.       | Desktop/mobile walkthrough reaches useful work with no dead ends.                                    |
| W0.5 | Run bounded publishing-adapter and real-asset-rendering feasibility spikes.                                                           | Capability/rights/cost matrix; source-image and exact-logo output proof; explicit selected approach. |

Exit: accepted scope, named architecture choices, reviewable product experience, and a ready foundation implementation packet. Provider commercial/app-review work is started as a separate dependency; it does not halt local product engineering.

### Wave 1 — Durable portfolio and brand foundation

Dependency: W0 product/data decisions.

| ID   | Deliverable                                                                                              | Proof required                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| W1.1 | Add studio/workspace grants, brands, locations, and project mappings with additive migrations.           | Cross-tenant and cross-brand denial tests; migration/backfill rehearsal.                |
| W1.2 | Implement portfolio list/search, brand creation, switching, archive, and permissions-aware home.         | Two unrelated brands remain distinct after reload and sign-in on another device.        |
| W1.3 | Implement durable resource routes and compatible redirects; replace browser-only resume authority.       | Direct link, refresh, back/forward, session expiry, and missing-resource recovery pass. |
| W1.4 | Persist onboarding and draft changes with visible save/conflict recovery.                                | Closing the browser and concurrent edits do not silently lose or overwrite work.        |
| W1.5 | Establish permission presets, invitation contracts, and settings boundaries; connect real billing reads. | Unauthorized actions denied at server/database; unavailable billing never becomes zero. |

Exit: one operator manages multiple persistent brands with correct identity, access, and recovery. The existing creative flow can still be reached under a real project context.

### Wave 2 — Website-to-brand understanding

Dependency: W1 brand identity and durable jobs; W0 rendering choices can proceed separately.

| ID   | Deliverable                                                                                | Proof required                                                                                 |
| ---- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| W2.1 | Bounded website/document ingestion with safe URL handling and source capture.              | Redirect/private-address, timeout, duplicate, malformed file, and prompt-injection cases pass. |
| W2.2 | Extract offerings, locations, facts, offers, visual candidates, and language.              | Representative sites produce traceable assertions with unknowns preserved.                     |
| W2.3 | Produce voice, audience, and positioning proposals with evidence and confidence.           | Reviewer can distinguish observed facts from hypotheses and correct them.                      |
| W2.4 | Deliver editable findings, source review, targeted questions, and approved brand versions. | Owner approves/corrects a brand once and a new campaign reuses it correctly.                   |
| W2.5 | Add change detection, expiry, contradiction handling, and manual/catalog import.           | Stale offers cannot become newly approved content; conflicting facts request review.           |

Exit: website → evidence-backed brand profile works without a lengthy blank form. A business without a usable website can reach the same state through manual inputs.

### Wave 3 — Real asset library and identity controls

Dependency: W1 ownership; W2 identity proposals improve classification but are not required for uploading.

| ID   | Deliverable                                                                                      | Proof required                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| W3.1 | Extend private upload to reusable photos, logos, documents, and video with metadata/rights.      | Interrupted upload recovery, MIME validation, access denial, and original hash checks.          |
| W3.2 | Add collections, tags, search, duplicate detection, clip/transcript indexing, and usage history. | Correct assets found across a populated library; unauthorized search results never appear.      |
| W3.3 | Implement approved logo/font/color rules and protected-source regions.                           | Selected identity assets and permitted transforms are enforced in output.                       |
| W3.4 | Implement controlled static composition and source-first templates.                              | Storefront/product remain the selected originals; logo, CTA, price, and typography are correct. |
| W3.5 | Deliver capture requests, missing-asset UX, expiry rules, and lineage inspection.                | A missing real asset prompts a useful request; expired rights prevent future dispatch.          |

Exit: the owner can build branded static content from actual assets and verify exactly what was used.

### Wave 4 — Social connections and the first publishing loop

Dependency: W1 and the adapter spike. Connection implementation can run alongside W2–W3.

| ID   | Deliverable                                                                                             | Proof required                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| W4.1 | Implement adapter boundary, credential storage, OAuth connection, account selection, and brand mapping. | Denied consent, partial scopes, duplicate account, wrong brand, and reconnect cases pass.    |
| W4.2 | Implement per-account capability and health views.                                                      | UI matches verified operations; unsupported/manual paths are explicit.                       |
| W4.3 | Add publication intents, approved payload hashes, idempotency, external IDs, and reconciliation.        | Timeout after accepted submission does not cause blind duplicate posting.                    |
| W4.4 | Build basic composer/calendar with save, schedule, cancel, and channel-specific previews.               | Reload preserves work; edits affect only intended variants; timezone behavior is correct.    |
| W4.5 | Prove the first complete publish/confirm/metric-read workflow on authorized test accounts.              | External post ID/status and source media lineage recorded; failure/reconnect path exercised. |

Exit: approved real-brand content reaches a supported channel and returns trustworthy publication evidence. Any external approval dependency is recorded per channel, not hidden behind a green overall integration badge.

### Wave 5 — Campaign planning and creative production

Dependency: W2, W3; publish integration from W4 joins at the end-to-end gate.

| ID   | Deliverable                                                                                    | Proof required                                                                      |
| ---- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| W5.1 | Add campaign objective, offering, audience, offer, budget, and content-plan records.           | Correct facts and brand version pinned to every planned item.                       |
| W5.2 | Generate a seven-day plan with content pillars, selected assets, reasons, gaps, and estimates. | Plan is relevant to the industry and can be edited without regenerating everything. |
| W5.3 | Connect creative jobs to real selected assets; preserve useful graph execution internals.      | Provider payload tests prove references are transmitted when required.              |
| W5.4 | Add storyboard/timeline, reels/carousels, captions, audio, thumbnails, and EN/ES variants.     | Real-footage render and language/destination checks pass across selected formats.   |
| W5.5 | Deliver automated/assisted QA, variant comparison, approval, and scheduling handoff.           | Failed identity/offer/rights checks block approval or publication as defined.       |

Exit: the complete WashBodega and second-brand core pilot passes. This is the first usable end-to-end product milestone, not the finish line for the full platform.

### Wave 6 — Full studio workflow and client approvals

Dependency: W1 permission model, W5 content revisions. Portal and task work can begin earlier against stable contracts.

| ID   | Deliverable                                                                                         | Proof required                                                                               |
| ---- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| W6.1 | Deliver member invitations, scoped roles, client reviewer access, and revocation.                   | Each role's allowed/denied actions tested across two clients and several brands.             |
| W6.2 | Add review queues, annotated comments, approval chains, deadlines, and version differences.         | Editing approved content invalidates the correct approval; revoked reviewers lose access.    |
| W6.3 | Add portfolio tasks, saved views, bulk actions, notification preferences, and exception dashboards. | Bulk operations preview scope and report partial results without affecting other brands.     |
| W6.4 | Add advanced calendar, evergreen queues, bulk import, location variations, and conflict detection.  | DST, expired offers, conflicting edits, repeated posts, and accidental duplicate cases pass. |
| W6.5 | Add client offboarding/export and branded client portal presentation.                               | Client can recover owned data; access and future schedules are reconciled.                   |

Exit: one studio operates several client brands, approvals, campaigns, and publishing schedules through complete user flows.

### Wave 7 — Creator discovery and relationships

Dependency: W2 brand/audience model, W1 access. Provider licensing spike starts in W0/W2, not after all publishing work is complete.

| ID   | Deliverable                                                                                 | Proof required                                                                         |
| ---- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| W7.1 | Add imported/opt-in creators and one approved discovery adapter.                            | Source, permitted use, freshness, and missing data are retained.                       |
| W7.2 | Build explainable search, suitability filters, and campaign shortlists.                     | Local/language/style fit has evidence; missing geography is not fabricated.            |
| W7.3 | Add creator CRM, relationship history, authorized outreach drafts, and contact preferences. | No outbound action without the configured authorization; opt-outs respected.           |
| W7.4 | Deliver briefs, creator portal, draft uploads, revision feedback, rights, and deadlines.    | Creator sees only assigned work; exact deliverable versions are reviewed.              |
| W7.5 | Link publication evidence, campaign results, usage rights, and settlement records.          | Rights and costs are distinct; publication is verified; estimated results are labeled. |

Exit: a campaign can find an appropriate creator, manage an agreed deliverable, approve it, and measure the resulting work. A directory of names alone does not pass.

### Wave 8 — Cross-brand campaigns

Dependency: W6 approvals and W3 rights. Partnership discovery can share infrastructure with W7.

| ID   | Deliverable                                                                                  | Proof required                                                                                   |
| ---- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| W8.1 | Add participant agreements, contributions, purpose-limited asset grants, and expiry.         | Sharing grants no unrelated client access; revocation stops future use.                          |
| W8.2 | Build joint briefs, tasks, participant approvals, and locked co-brand templates.             | Both brands' required identity and review rules are enforced.                                    |
| W8.3 | Coordinate publishing, supported native collaboration, and explicit manual acceptance tasks. | The product distinguishes native collab, paid partnership, tags, and coordinated ordinary posts. |
| W8.4 | Add referral/offer links, campaign cost allocation, and participant reporting scope.         | Participants see only agreed data; totals reconcile to underlying records.                       |
| W8.5 | Complete a two-brand joint campaign rehearsal and cancellation/exit flow.                    | Rights, schedule, approval, and cancellation consequences remain traceable.                      |

Exit: two independently owned brands can operate a joint campaign without surrendering their private workspaces.

### Wave 9 — Inbox, reputation, and relevant content inputs

Dependency: W4 connectors, W2 knowledge, W6 assignments.

| ID   | Deliverable                                                                           | Proof required                                                                            |
| ---- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| W9.1 | Ingest supported messages/comments/reviews with cursor checkpoints and deduplication. | Replay and outages recover without duplicate conversation records.                        |
| W9.2 | Build triage, assignment, internal notes, supported replies, and human escalation.    | Correct account/permission/window checked before send; concurrent reply conflict handled. |
| W9.3 | Add knowledge-grounded response drafts and narrow opt-in automation policies.         | Wrong-brand facts and expired offers rejected; human takeover works.                      |
| W9.4 | Add approved RSS/catalog/storage/design connectors and content opportunity queues.    | Freshness, provenance, permissions, and rights survive import into creative work.         |
| W9.5 | Add brand crisis pause, listening coverage indicators, and operational notifications. | Scope is accurate; pauses contain pending activity without rewriting history.             |

Exit: the operator can manage supported customer engagement and turn legitimate content inputs into relevant campaigns.

### Wave 10 — Analytics and measurable learning

Dependency: W4 publication evidence, W5 campaign identity; first metric reads are already required in W4.

| ID    | Deliverable                                                                                     | Proof required                                                                           |
| ----- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| W10.1 | Normalize metric observations while preserving raw definitions, windows, source, and freshness. | Missing/unsupported values remain distinct from zero; incompatible metrics not combined. |
| W10.2 | Deliver brand/campaign/channel/creator reporting and studio aggregates with scoped exports.     | Totals trace to source records and enforce client permissions.                           |
| W10.3 | Connect first-party outcomes, links/codes, destination checks, and attribution records.         | Duplicate events, language mismatch, stale offers, and broken funnel cases tested.       |
| W10.4 | Add experiments, feedback, content-fatigue indicators, and recommendations.                     | Recommendations explain evidence/uncertainty and respect brand policy.                   |
| W10.5 | Deliver report builder, scheduled reports with preferences, and learning-to-next-plan flow.     | A completed campaign informs a reviewable next plan; reports expose stale data.          |

Exit: users can see what performed, what is uncertain, and what to change next without fabricated ROI.

### Wave 11 — Commercial operations and paid-media expansion

Dependency: W6 multi-client operation and W10 measurement. Existing billing data connection is already required in W1.

| ID    | Deliverable                                                                                          | Proof required                                                                           |
| ----- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| W11.1 | Implement current subscription/entitlement product and transparent metered usage.                    | Test-mode purchase, renewal, failure, cancellation, credit, and receipt flows reconcile. |
| W11.2 | Add studio sponsorship, client allocation, delegated budgets, and cost reporting.                    | Workspace and aggregate limits remain consistent under concurrent jobs.                  |
| W11.3 | Deliver read-only ad-account/measurement audit and approved campaign drafts.                         | Account relationships and permissions are verified; diagnostics distinguish data gaps.   |
| W11.4 | Implement separately authorized paid-media publication/optimization controls.                        | Exact budget/target account confirmation, limits, pause, and reconciliation tests pass.  |
| W11.5 | Add provider-backed creator payouts and affiliate settlements if the commercial model requires them. | Identity/settlement/reversal failure paths and accounting pass before activation.        |

Exit: the selected paid product operates with real entitlements and reconciled money; optional payouts/ads remain explicitly unavailable until their separate acceptance passes.

### Wave 12 — Portfolio scale and release completion

Dependency: all features selected for the release; hardening starts in every earlier wave.

| ID    | Deliverable                                                                                                      | Proof required                                                                           |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| W12.1 | Execute 1/10/100/1,000-brand synthetic load tiers and tune data/job boundaries.                                  | Measured latency, backlog, fairness, storage, and cost under defined workload.           |
| W12.2 | Run failure drills for provider outage, ambiguous publication, token revocation, restore, and adapter migration. | Recovery preserves approvals, schedules, private assets, and ledger invariants.          |
| W12.3 | Complete accessibility, responsive, visual, and usability checks on populated and empty workspaces.              | Qualified users complete core tasks with recorded friction and resolved critical issues. |
| W12.4 | Validate import/export/offboarding, retention, operational support, and release rollback.                        | Rehearsed evidence with exact environment/resource boundaries.                           |
| W12.5 | Run the final capability-by-capability release assessment and authorized live pilot.                             | Each marketed feature has connected evidence; outstanding limitations are explicit.      |

Exit: the release earns its completion label against the new platform contract. A passing build, rendered sidebar, or elapsed observation window is insufficient.

## Dependencies and packet discipline

The critical path is accepted product/data scope → durable portfolio/brands → approved knowledge and real assets → content revisions → approval → confirmed publication → measured next campaign. W1 depends on W0 product/data decisions; publishing access and render-runtime spikes remain explicit dependencies of the features that use them, not barriers to unrelated local engineering.

One active packet owns one bounded slice. Every packet includes user outcomes, allowed paths, data/contracts, failure states, tests, external dependencies, rollback and successor. Continue implementable successors after truthful completion. Do not add a competing ship plan or status database. Product, architecture, UX and quality documents remain the accepted topic authorities.

Use current official documentation for provider feasibility. Postiz is evaluated first, Sendible second and direct adapters follow if neither passes. Missing commercial access, real accounts, paid-provider budgets or a required visual approval must remain explicit. Produce concrete review artifacts before requesting an owner decision.

## Current evidence and carried release obligations

WP-P3-009 is superseded with its evidence and pending acceptance preserved. Continuous production observation and the owner traffic ruling remain required before a future public release. They do not determine platform product completeness and do not block local implementation. The active packet and generated status own the current step; this roadmap does not duplicate live progress.

## Milestone acceptance

The five golden journeys and mandatory negative/recovery cases in quality-gates define acceptance. A two-brand pilot is the first complete core operating milestone; W6–W12 remain required for full-platform completion. Use specified, implemented, locally verified, connected staging verified and authorized production verified evidence levels. Unsupported or unavailable integrations stay explicit.

Load tiers are 1, 10, 100 and 1,000 synthetic brands, with dataset size/concurrency defined before measuring. Common portfolio/brand reads target p95 under two seconds at the agreed load. At least 20 varied briefs and a defined pilot cohort are required for usefulness/fidelity/usability evidence; do not invent human evaluations. Re-estimate after W0/W1 rather than promise an unmeasured launch date.
