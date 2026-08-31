# WP-P1B-001 implementable acceptance — 2026-08-31

This evidence bundle records P1b implementable acceptance proven on commits `d6ab103`,
`f720027`, and the P1b finish commit on branch `codex/viralgraph-cleanroom`.

## OAuth scope and revocation

- `governance/evidence/WP-P1B-001/oauth-scope-and-revocation.yaml`
- `supabase/tests/database/00032_p1b_oauth_scope_and_revocation.test.sql`
- `packages/contracts/src/scopes.test.ts`
- `apps/core/test/unit/programmatic-auth.test.ts`

## Three-client REST/MCP/CLI parity

- `governance/evidence/WP-P1B-001/rest-mcp-cli-parity.yaml`
- `governance/evidence/WP-P1B-001/three-client-parity.yaml`
- `governance/evidence/WP-P1B-001/p1b-parity-vectors.json`
- `apps/core/test/unit/p1b-three-client-parity.test.ts`
- `apps/core/test/unit/production-mcp-parity.test.ts`
- `apps/web/src/lib/core/p1b-client.test.ts`
- `apps/cli/test/p1b-cli-parity.test.ts`
- `packages/contracts/src/p1b-parity.test.ts`

All nine vector kinds across eleven production tools are proven with no handler-local policy drift.

## Immutable user-authored Skills

- `governance/evidence/WP-P1B-001/immutable-skill-versions.yaml`
- `supabase/tests/database/00033_p1b_immutable_skill_versions.test.sql`
- `packages/contracts/src/p1b-handlers.test.ts`
- `apps/web/src/features/skills/skills-access-panel.test.tsx`

## No autonomous spend surface

- `governance/evidence/WP-P1B-001/no-autonomous-spend-surface.yaml`
- MCP `start_run` description, Zod `confirmed: true`, signed confirmation tokens, scoped API keys,
  CLI `--confirmed` gates, Postgres `start_run_barrier`, and platform kill switches prevent MCP,
  CLI, and API-key automation from triggering provider spend without explicit confirmation.

No live provider spend occurred while collecting this evidence.

## Quality gates

- `corepack pnpm design:check`
- `corepack pnpm governance:check`
- `corepack pnpm agent:verify`

## Verification

`corepack pnpm agent:verify` passed on the committed tree before WP-P2-001 activation.
