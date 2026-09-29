---
doc_id: adr-0010-drive-autopilot-saas
---

# ADR-0010: Direct Drive, approved automation and studio-plus-SaaS delivery

## Status and scope

Accepted direction from the owner's September 28, 2026 instruction, "PLEASE IMPLEMENT THIS PLAN",
recorded in `governance/evidence/WP-PLATFORM-W2-002/expanded-product-amendment-2026-09-28.yaml` before
these authority edits. This decision refines ADR-0007's full-platform scope without removing any
W0–W12 acceptance. It changes no ready W2 product acceptance or live capability. Migrations and Zod
contracts continue to own implemented interfaces. Topic authorities contain the detailed contracts;
this decision records the rationale and boundaries rather than a second implementation/status plan.
It replaces ADR-0007's earlier Postiz-then-Sendible evaluation ordering only; that historical record
retains its original meaning and the rest of its full-platform decision remains in force.

## Decisions

- Keep studio service marketing separate from the SaaS offer. Public name is Must Be Viral; SaaS
  marketing uses `/software` and `/software/pricing`; `/studio` and durable brand routes remain.
- Use direct Google OAuth for selected-root Drive ingestion and continuous synchronization. The
  scope/verification gate remains mandatory; no workstation owner's account substitutes for a
  customer's consent. Original-media fidelity, provenance and rights are part of acceptance.
- Use hosted Treg as the initial credential transport for Facebook, Instagram, Google Business
  Profile, YouTube, LinkedIn, TikTok and X. Use direct Pinterest/Threads adapters. The domain
  interface stays independent so a failing Treg isolation/commercial path has a prescribed direct
  fallback. Do not migrate an in-flight publication between transports.
- Keep permissions, immutable revisions/policies, jobs, schedules and integer money in Postgres
  and existing Core handlers. Backend-enforced account binding and transactional budgets remain
  necessary even when a transport supplies tagging, caps or idempotency.
- Adopt explicitly approved automation policies, with human/platform exceptions and current
  authorization rechecks. Preserve one scheduler and per-account submission/reconciliation state.
- Use the provisional subscription catalog and separate prepaid credits recorded in
  `execution-providers-billing`; measure economics before live charging. Keep existing customer
  prices and ledger settlement identities. Initially track creator settlement externally.

Hosted API use and source licensing are distinct. Treg's source license contains additional
restrictions on providing hosted/embedded services to third parties; this decision neither embeds
nor self-hosts it. [Treg source license](https://github.com/superdesigndev/treg/blob/main/LICENSE).

## Conditional rendering direction

Benchmark sharp 0.34.5 in an internal stateless Node function in the existing Vercel project for
static composition/overlays; retain fal-first AI and video composition. The function accepts only
Core-authorized short-lived job capabilities and approved assets. Core owns authorization, durable
state, billing, output verification and private R2 registration. No second media library or job
authority is introduced.

The feasibility packet must predeclare limits from the intended runtime and cost allowance, then
measure actual source-image fidelity, exact logos/text/fonts, a real-footage reel with captions and
cover, latency/memory, cancellation and private input/output handling. Commit that measured runtime
decision before implementation. A failed benchmark stops dependent rendering and requires a
concrete architecture correction, not an improvised executor. API schema alone is insufficient:
fal's composition schema exposes image/video/audio tracks but does not establish our complete
caption/font/overlay workflow. [fal compose API](https://fal.ai/models/fal-ai/ffmpeg-api/compose/api),
[sharp compositing](https://sharp.pixelplumbing.com/api-composite/).

## Consequences and unchanged gates

Postiz and Sendible are not launch dependencies. Drive verification, social provider approvals,
customer authentication, transport isolation, new-screen design approval, attorney/legal review,
commercial economics, real human acceptance and exact-action release permissions remain explicit.
The $100 cumulative development ceiling is not a promise that third-party assessments fit within it.
Current W2 remains active until its own checks and required independent reviews pass. This decision
does not authorize public posts, outreach, production database writes, infrastructure/settings
changes, feature activation or traffic cutover. The release runbook, project state and packet own
those effects. Preserve the 72-hour private production observation and fresh owner traffic ruling.
