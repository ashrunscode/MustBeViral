# Full-platform authority rebaseline

The owner explicitly requested implementation of the September 9 full-platform plan and chose
immediate rebaseline. WP-P3-009 was superseded through the verified ADR-0008 command, with its
untouched predecessor snapshot and 56 committed evidence files retained in the receipt chain.
The observation-window and fresh-traffic-decision acceptance remain pending.

ADR-0007 accepts the platform direction. ADR-0001 and the previous finish-sprint instruction are
marked superseded in the manifest. The product, release, architecture, data/tenancy, API,
execution/billing, UX, screen-state, glossary, quality and roadmap authorities now cover the broader
platform. Agent instructions and the build skill follow those authorities. No second plan database
was added.

The existing roadmap contains every work unit W0.1 through W12.5 exactly once. Quality gates retain
all five golden journeys and all eleven negative/recovery categories. The portfolio foundation is
followed by brand knowledge, real assets, publishing, creative campaigns, client operations,
creators, partnerships, engagement, measurement, commercial operations and release hardening.

The obsolete filename ban on client/social-publishing features was replaced with an authority
coherence gate. Tests protecting the existing Worker topology, no BYOK, gated Hyperdrive,
private production routes/bindings and disabled execution flags remain unchanged. Existing
required GitHub reviews/checks and CI cost controls remain applicable.

Verification on September 9, 2026, pinned Node 24.18.0 and pnpm 11.12.0:

- `pnpm agent:verify` passed: governance, formatting, lint, strict types, unit/integration suites
  and all 18 workspace builds; valid Turbo build caches were reused.
- All 143 governance tests passed with zero failures, including exact 65-unit roadmap coverage,
  golden-journey/recovery coverage, supersession/completion integrity and production containment.
- `pnpm docs:check` passed with 39 registered documents; generated references and cleanroom passed.
- `git diff --check` passed. Runtime code, migration files and production configuration are unchanged.
- Local Docker is not running. Database pgTAP and controlled browser reproductions belong to the
  bounded Wave 0 successor; this authority amendment does not claim that baseline work has passed.

The ready successor is `successor-WP-PLATFORM-W0-001.yaml`. It covers evidence inventory, controlled
UI/database failure reproduction, baseline repairs, reviewable desktop/mobile frames, and bounded
publishing/rendering feasibility. External access, visual approval, spend and release decisions
must retain their actual evidence states.

Next action: activate WP-PLATFORM-W0-001 and begin the local baseline inventory and failure reproduction.
