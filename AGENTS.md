# MustBeViral agent contract

This file owns agent behavior. `PROJECT_STATE.yaml` owns current state and external-mutation policy; `docs/MANIFEST.yaml` assigns accepted product, UX, architecture, and operational authorities. Research is informative; Git/PRs hold history.

## Start governed work

- Use repository-pinned Node/pnpm and CLIs. If dependencies are needed, use `corepack pnpm install --frozen-lockfile`; do not substitute package managers.
- Run `pnpm agent:preflight` before packet implementation or edits. A read-only explanation of a named document can use that document directly.
- Read `PROJECT_STATE.yaml` and `docs/delivery/ACTIVE_WORK_PACKET.yaml`. Use preflight's document list as an authority map; read sections governing the current step and all applicable acceptance requirements before declaring completion.
- Confirm the packet, branch, current step, allowed paths, blockers, and pending decisions. Work within that scope. Stop dependent implementation on failed preflight, conflicting authority, or a missing required decision; record the blocker and continue only independently authorized work.

## Preserve the architecture and controls

- Build MustBeViral Studio's full-platform scope accepted in ADR-0007 for brand operators and multi-brand studios using ViralGraph V2: Next.js/Vercel, Supabase, one Core Worker, private R2, and fal-first provider drivers.
- Do not revive legacy React Router, D1-auth, marketing-autopilot, or System DNA. New publishing and portfolio work belongs in V2. Do not add a second documentation database, archive, progress diary, nested AGENTS.md, or competing status file.
- Preserve strict TypeScript, explicit boundaries, deterministic state machines, immutable revisions, integer money, and private artifacts. Supabase/Postgres owns permissions, revisions, runs, and money; Durable Objects/caches must not become a second authority.
- Migrations, Zod/OpenAPI contracts, environment schemas, and the model catalog own implemented contracts. Generate projections; keep browser/REST/CLI/MCP transports thin around shared command/query handlers.
- Never expose secrets, raw environment values, account tokens, customer media, or signed URLs in docs, logs, fixtures, evidence, or messages. Remote destructive actions require state and packet authority naming exact resources and rollback evidence.

## Skills and verification

Use `.agents/skills/build-mustbeviral/SKILL.md` for active-packet implementation, verification, or handoff. Load packet-required specialists for their matching steps; other skills should supply needed, available expertise. Skills never override repository authority. New queues and live enablement retain architecture/environment gates. Verify mutable provider facts against current official documentation when relying on them.

Use meaningful regression coverage for changed behavior and preserve every packet-required test. Continue through implementation, affected behavior, and repairs caused by the change. Product acceptance requires `pnpm agent:verify` and all packet checks. Update only mutable progress, evidence, blockers, and handoff fields; use `agent:handoff` when product work remains and `agent:finish` only when every criterion is proven and the successor is ready. Report results, evidence, remaining risks, and one next action.

## Owner-directed authority changes

Do not broaden a ready packet in the same change as implementation. Packet replacement follows ADR-0008: commit the authority-only amendment first, then use audited supersession; never claim unfinished acceptance passed.

An explicitly requested instruction-only amendment follows a separately committed authorization naming its exact paths and purpose. Preserve product steps, acceptance, required skills/checks, external-effects policy, state, and history. Validate documentation, governance, skill frontmatter, and references proportionally; do not use packet handoff/finish to count instruction editing as product progress.

Brand and design context: read `brand/context.md` and `brand/BRAND.md` before customer-facing copy or UI work; repo-local agent skills live in `.agents/skills/` (Claude Code: `.claude/skills/`).
