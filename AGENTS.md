# MustBeViral agent contract

This file is the sole authority for agent behavior in this repository. Product, UX, architecture, and operational behavior live in the documents registered by `docs/MANIFEST.yaml`.

## Start every task

1. Use the repository-pinned Node and pnpm versions.
2. Run `pnpm agent:preflight` before reading implementation files or making changes.
3. Read the documents and active work packet printed by preflight, ending with `docs/delivery/ACTIVE_WORK_PACKET.yaml`.
4. Confirm the active packet has no blocker or pending decision and that the current branch matches it.
5. Work only on the packet's current step and allowed paths.

If dependencies are not installed, use `corepack pnpm install --frozen-lockfile`. Never substitute npm, Yarn, Bun, Deno, or an unpinned global platform CLI.

## Authority and scope

- `PROJECT_STATE.yaml` owns current phase, active packet, next action, and external-mutation policy.
- `docs/MANIFEST.yaml` assigns one accepted authority per topic.
- Accepted product, UX, and architecture documents define intended behavior.
- Migrations, Zod/OpenAPI contracts, typed environment schemas, and the model catalog define implemented contracts.
- The active work packet authorizes one bounded slice. It cannot override accepted authority.
- Research is informative only. Git and pull requests hold history.
- If sources conflict or a required decision is absent, stop that packet and record a blocker. Do not invent a local convention.

## Mandatory cleanroom rules

- MustBeViral Studio serves DTC/e-commerce marketing teams first. Agency workflows are deferred.
- ViralGraph V2 uses Next.js/Vercel, Supabase, one Cloudflare Core Worker, private R2, and fal-first provider drivers.
- Never revive the legacy React Router, D1-auth, marketing-autopilot, multi-brand social-posting, or System DNA implementation.
- Do not add a second documentation database, `docs/archive`, progress diary, nested `AGENTS.md`, or competing status file.
- Never expose secrets, raw environment values, account tokens, customer media, or signed URLs in docs, logs, evidence, fixtures, or messages.
- Never perform a remote destructive action unless `PROJECT_STATE.yaml` and the active packet explicitly allow the exact resource IDs and rollback evidence.

## Skills

Use `.agents/skills/build-mustbeviral/SKILL.md` when building, resuming, reviewing, or handing off this project. When available, select only the specialist skills relevant to the packet:

- Architecture: `architect-prime`, then `think` for irreversible decisions.
- UI: `superdesign`, then `frontend-master`; use `web-perf` for measured performance.
- Data/auth/API: `data-architect`, `auth-fortress`, `api-craft`.
- Cloudflare: `cloudflare`, `wrangler`, `workers-best-practices`, `file-forge`.
- Billing/email/operations: `billing-engine`, `email-flow`, `observability-ops`.
- Verification: `test-mastery`, then `quality-check`.
- P2 only: `durable-objects` and `realtime-sync`.
- Queues only after an accepted evidence gate: `queue-master`.

Skills accelerate work but never override repository authority. Retrieve current official provider documentation before using unstable APIs, limits, prices, model IDs, or CLI behavior.

## Implementation discipline

- Preserve strict TypeScript, explicit boundaries, deterministic state machines, immutable revisions, integer money, and private-by-default artifacts.
- Add or update tests with every behavioral change.
- Use generated contracts instead of hand-maintained duplicates.
- Keep browser, REST, CLI, and MCP transports thin; shared command/query handlers own behavior.
- Keep Supabase/Postgres authoritative for permissions, revisions, runs, and money. Do not create a second authority in Durable Objects or local caches.
- Do not broaden a ready packet's scope in the same change as implementation.

## Finish or hand off

1. Run `pnpm agent:verify` and the packet's named checks.
2. Update only mutable packet progress, evidence, blockers, and handoff fields.
3. Run `pnpm agent:handoff` when work remains.
4. Run `pnpm agent:finish` only when every acceptance criterion is proven and the successor packet is ready.
5. Report changed paths, checks, evidence, remaining risks, and exactly one next action.
