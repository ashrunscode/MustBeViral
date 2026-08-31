---
doc_id: release-scope
---

# Release scope

## P0 private validation slice

P0 includes only what is required to prove the Meta Campaign Launch Pack for one owner in one workspace:

- Authentication shell and a structured campaign brief (brand, audience, offer, and claims live on that brief, not on a separate settings app).
- Desktop graph canvas plus semantic outline, graph validation, quote, explicit confirmation, execution, partial progress, composed Review, comparison, approval, export, and receipt.
- Initial node kinds: brief/input, brand context, planner/text, image generation/edit, video generation, QA, output/export, and non-executable group.
- DAGs with at most 100 executable nodes and no arbitrary loop construct.
- Supabase Auth/Postgres/RLS, one Core Worker, private R2, fal-first provider transport, immutable billing semantics without automated customer charging, and private five-operation MCP proof.
- The pinned launch trio plus one copy route, not arbitrary access to every provider model.
- Internal operator visibility for runs, costs, reconciliation, and kill switches.
- Desktop authoring; tablet and mobile Review, approval, and export.

P0 does **not** ship a marketing landing, project dashboard, settings admin, member invites, comments, or Stripe. Those names stay in later phases. A short signed-out story and a signed-in “continue this campaign” screen may be added as last-mile honesty; they are not a second product.

## P1a paid single-user product

P1a adds the secure paid web product: production-grade identity and RLS, durable revisions, Stripe subscription and prepaid wallet, enforced entitlements and spend caps, transactional email, durable multi-step execution where proven necessary, expanded exports, operational reconciliation, and production deployment/rollback.

## P1b programmable surface

P1b adds production OAuth/API-key authorization, supported public REST API, production MCP tools, CLI parity, user-authored Skills with immutable versions, and three-client semantic parity evidence.

## P2 collaboration

P2 adds multiplayer presence, comments, text collaboration, edit leases for expensive node configuration, and checkpointing through a dedicated collaboration Worker and one coordination object per canvas. Postgres revisions remain durable authority; collaboration state is a recoverable draft.

## P3 scale and resilience

P3 may add a separately deployable executor, queues, direct high-volume provider adapters, circuit breakers, canaries, disaster-recovery automation, stronger compliance controls, and BYOK only when measurements justify each addition.

## P4 expansion

P4 may introduce agency accounts, client approval portals, white-labeling, multi-client reporting, workflow marketplaces, enterprise identity, and internationalization after the DTC product demonstrates retention and viable economics.

## Explicitly deferred before validation

- Agency billing, white-labeling, client portals, complex approval hierarchies, and multi-client reporting.
- Audio workflows, arbitrary graph loops, long-form video editing, and auto-publishing.
- Website crawling and automatic Shopify catalog import.
- Template marketplaces, public community sharing, and self-hosted control planes.
- BYOK, enterprise SSO/SCIM, and internationalization.
- Regulated or political advertising workflows.
- Full multiplayer and mobile graph editing.
- Multiple planning agents, autonomous provider access, or agent access to database, storage, and billing credentials.

## Remaining finish-sprint sequence

Remaining accepted engineering work, in order, is:

1. P0 last-mile product: signed-out story, auth completeness including honest closed-enrollment signup, brief onboarding, continue-this-campaign, measurement and landed-cost instrumentation.
2. P1a paid single-user product as defined above.
3. P1b programmable surface as defined above.
4. P2 collaboration as defined above.

P3 and P4 stay evidence-driven or deferred. Connected social publishing, Drive import, and auto-publishing are not in this sequence until a separately accepted product/architecture change.

Scope can expand only through a product/architecture change linked to measured evidence and a new or superseding decision. An implementation packet cannot promote deferred work by convenience.
