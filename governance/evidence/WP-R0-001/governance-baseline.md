# WP-R0-001 governance baseline evidence

Verified on 2026-07-12 with Node 24.18.0 and pnpm 11.12.0.

- `pnpm docs:check`: 30 registered authority files valid.
- `pnpm packet:verify`: project state, branch, scope, and active packet valid.
- `pnpm cleanroom:check`: 73 repository files inspected with no forbidden legacy or secret fingerprint.
- `pnpm generated:check`: eight generated context/reference files current.
- `pnpm governance:test`: 12 positive and negative governance tests passed.
- `pnpm agent:preflight`: correctly reported MustBeViral Studio, ViralGraph, DTC/e-commerce launch customer, R0, `WP-R0-001`, one current step, one next action, no blockers, no pending decisions, and remote destruction forbidden.
- `pnpm verify`: complete R0-applicable quality gate passed; application task lanes correctly reported zero packages before the scaffold commit.
- Clean-clone proof: a new temporary clone completed a frozen install, preflight, and `pnpm verify` with a clean worktree.
- Fresh-agent proof: a context-isolated agent identified the DTC customer, V2 generation, R0 phase, `WP-R0-001`, `r0-003-preflight`, no blockers, remote destruction forbidden, and the correct required skills without editing files.
