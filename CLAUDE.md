@AGENTS.md

# Claude in MustBeViral Studio

The import owns agent behavior. This file provides command and layout orientation; `PROJECT_STATE.yaml`, the active packet, and `docs/MANIFEST.yaml` retain their existing authorities.

## Commands and verification

- Run commands from the repository root with pinned Node 24.18.0 and pnpm 11.12.0, as declared in the manifests. On Windows, `corepack pnpm` works when no standalone pnpm shim is installed; use `corepack pnpm install --frozen-lockfile` when dependencies are needed.
- Before product packet work, run `corepack pnpm agent:preflight` and read its required documents, current step, allowed paths, acceptance, and blockers. Do not count instruction editing as packet progress.
- `corepack pnpm dev` starts workspace development. Coordinate ports, deployments, and the Supabase migration/test lane before using shared resources.
- Product verification uses `corepack pnpm agent:verify` and every packet-required check. Root `lint`, `typecheck`, `test`, `test:integration`, and `build` scripts orchestrate the workspace checks; use affected-package scripts during iteration.
- Instruction-only merge checks follow the existing fresh single-worktree clone procedure in `docs/delivery/QUALITY_GATES.md`: check out the exact PR head on a local branch named after its target, then run `corepack pnpm agent:preflight`, `corepack pnpm governance:check`, `corepack pnpm governance:test`, and `corepack pnpm format:check` with frozen dependencies.
- The packet validator intentionally rejects a mismatched branch or multiple linked worktrees. Keep the writer in its registered task worktree and use the documented independent validation clone; preserve the guard and other sessions' work.
- `corepack pnpm docs:check`, `corepack pnpm generated:check`, and `corepack pnpm diff-scope:check --base <base-sha> --head HEAD` check authority, generated projections, and committed scope. A scope amendment must merge before implementation that needs it.

## Architecture and gotchas

- `apps/web` is the Next.js studio/software interface. `apps/core` owns shared command/query transport; `apps/collaboration` owns its separate collaboration Worker surface.
- Supabase/Postgres owns permissions, revisions, runs, and money. Private R2 owns artifacts; Durable Objects and caches do not become another data authority.
- Keep contracts in `packages/contracts`, domain behavior in `packages/domain`, and environment contracts in `packages/config`. Browser, REST, CLI, and MCP transports stay thin around shared handlers.
- Preserve ViralGraph V2, immutable revisions, deterministic state machines, integer money, and private artifacts. Read the accepted architecture rather than reviving legacy V1 behavior.
- Use `.agents/skills/build-mustbeviral/SKILL.md` for active-packet implementation, verification, or handoff, and packet-required specialists for matching steps. Keep detailed procedures in the existing skills and registered documents.

## Collaboration and delivery

One accountable task owner coordinates bounded delegation, separate registered writer worktrees, current independent review, and shared deployment/migration ownership under `C:/dev/bootstrap/AGENT-POLICY.md`. Packet ownership and validation remain required. Local workstation agents may finish authorized commit, push, PR, merge, and guarded deployment steps without repeated confirmation under the imported contract and ADR-0009. Preserve dated owner grants, hooks, runtime protections, and every external-action boundary; cloud agents do not inherit workstation authority or credentials.
