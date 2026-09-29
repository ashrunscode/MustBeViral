# Staging recovery deploy — 2026-08-26

Work packet: WP-P0-001, current step `p0-007-p0-gate-evaluation`

No secret values, signed URLs, or customer media are recorded. No GB-02 spend. No production
mutation.

## Git

- Branch: `codex/viralgraph-cleanroom`
- Commit: `4627de7aeb664492e0b7b3f241514e436c787b84`
- Pushed to `origin/codex/viralgraph-cleanroom`

## Core Worker staging

- Worker: `mustbeviral-v2-staging-core`
- New version: `2d47b183-ad36-4954-8ca5-dafdb4e4f79f`
- Rollback target: `872ac183-8601-44d9-ba0c-74f46bd6d027` (was 100% before this deploy)
- After deploy `GET /health`: `status=ok`, `generation=viralgraph-cleanroom-v2`

This puts fail-evaluation / provider error-code handling on staging Core. It does not prove a
failed-run UI walk.

## Web staging

`vercel deploy --prod --yes --cwd apps/web` targeted project `mustbeviral-web-staging` and failed
install because that upload had no workspace `pnpm-lock.yaml` (monorepo lockfile lives at repo
root). The failed deployment URL is not the stable alias. The alias
`https://mustbeviral-web-staging.vercel.app` was not replaced by this session.

Customer-safe run-progress recovery copy is therefore on Git `4627de7` and on staging Core
`2d47b183`, but not proven on the current web alias. A monorepo-root Vercel deploy remains
outstanding. No GB-02 spend.
