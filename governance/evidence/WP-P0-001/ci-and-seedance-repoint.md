# WP-P0-001 — CI identity + Seedance Pro Fast repoint

Date: 2026-07-28. Value-free (no credentials).

## GitHub identity

| Check                        | Result                                           |
| ---------------------------- | ------------------------------------------------ |
| `gh` authenticated login     | `ashrunscode`                                    |
| Repo remote                  | `https://github.com/ashrunscode/MustBeViral.git` |
| Plan                         | GitHub Pro                                       |
| CODEOWNERS                   | `@ashrunscode`                                   |
| Vercel team (prior evidence) | `ashrunscode-projects`                           |

Historical D0 evidence files still record operator name `ernijsansons` as a past signature; they are
immutable approvals and were not rewritten. Cloudflare `workers.dev` hostnames still use the
account subdomain `ernijs-ansons` (Cloudflare account naming, not GitHub login).

## CI / pgTAP

The earlier "billing-blocked" diagnosis is **stale**. Actions runs are executing on this account
(Governance green; Quality currently red for an unrelated `@mustbeviral/core` wrangler types check).

Root cause for "pgTAP never ran in CI" was twofold:

1. Historical account/minutes block (resolved under `ashrunscode` Pro).
2. **No job ever invoked `pnpm supabase:test`.**

Fix: `.github/workflows/quality.yml` now has a `database-pgtap` job that starts local Supabase,
runs the full pgTAP suite, and stops Supabase. Local Docker Desktop was offline in this session, so
the suite was not executed here; CI is the first automatic runner.

## Seedance endpoint repoint

| Field                              | Before                                             | After                                                            |
| ---------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| Catalog `route_key`                | `fal/seedance-1.0-lite/motion`                     | unchanged (quote continuity)                                     |
| `provider_model_id` / driver model | `fal-ai/bytedance/seedance/v1/lite/image-to-video` | `fal-ai/bytedance/seedance/v1/pro/fast/image-to-video`           |
| Queue endpoint                     | `…/v1/lite/image-to-video`                         | `…/v1/pro/fast/image-to-video`                                   |
| Provider unit cost (720p)          | $0.039/s                                           | ≈ $0.022/s ($1.00/1M video tokens; live fal page 2026-07-28)     |
| Submit safeguards                  | none for resolution                                | pins `resolution=720p`; stringifies `duration` for Pro Fast enum |

Sources: migration `20260728030000_p0_seedance_pro_fast_repoint.sql`,
`packages/provider/src/catalog.ts`, `packages/provider/src/fal.ts`,
pgTAP `00012_p0_seedance_pro_fast_repoint.test.sql`.

Spend gate remains **CLOSED** until operator enable evidence; this only removes the deprecated
endpoint hazard so a future enable cannot bill Lite.

## Residual

1. Apply the Seedance repoint migration on staging Supabase (forward-only; operator/remote apply).
2. First green `database-pgtap` Actions run after merge/push.
3. Quality typecheck still fails independently: `wrangler types --check` reports
   `worker-configuration.d.ts` out of date on ubuntu runners (local check is clean). Separate fix.
