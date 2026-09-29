# Stripe/payments merges and production collaboration routing — 2026-09-16/17

Owner instruction: after the web/Worker production deploy (recorded in
`web-and-worker-production-deploy-2026-09-16.md`, PR #37), the owner approved merging the open
Stripe PRs with this operator's own independent review (explicitly not a substitute for a human
payments reviewer — see below), pushing the private local line for review, and routing the
production collaboration Worker (recorded separately in
`production-collaboration-traffic-decision-2026-09-16.md`, PR #38). This file records the first
two and the deploy/smoke steps that finished the third.

## Stripe/payments PRs merged

All five open Stripe PRs merged in dependency order, each reviewed by this operator (reading the
full diff, the migrations, and running the affected test suites and a typecheck locally before any
merge that required a manual conflict resolution) rather than by a human payments specialist. The
owner explicitly chose this ("Merge now with AI review only") over waiting for human review, after
being asked directly and told the tradeoff.

| PR  | What it does                                                                                                                                                                                                                                                                                                                           | Merge commit |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| #21 | Classifies a permanently-rejected Stripe webhook dedup RPC call separately from an outage in Core's error log (logging only; no behavior change to the HTTP response)                                                                                                                                                                  | `27a79ba`    |
| #33 | Same classification for settlement RPC calls, refactored into a shared `postgrest-rejection.ts`; rebased onto #21 after it merged                                                                                                                                                                                                      | `62ee987`    |
| #24 | Stops an older Stripe subscription event from overwriting newer billing-profile state (migration `20260916160000`, expand-only: a new 9-argument `apply_stripe_subscription_update` overload; the old 7-argument one stays as a transitional unordered writer)                                                                         | `06e7536`    |
| #29 | Implements the owner's decision on issue #20: only an explicit, marked wallet top-up funds the prepaid wallet, once per Checkout Session, not per event (migration `20260916170000`: new `apply_stripe_wallet_top_up`; the old `apply_stripe_wallet_credit` is retired to always refuse, so a rolled-back Worker cannot double-credit) | `0f4ff84`    |
| #32 | Rewrites a PostgREST-emulation test's RPC contract for `apply_stripe_wallet_top_up` (it still exercised the retired `apply_stripe_wallet_credit`, so it failed once #29 merged); fixed by this operator in the same PR (commit `d277ea0`) before merging                                                                               | `59d1136`    |

#24 and #29 conflicted, as anticipated in the prior handoff, in
`apps/core/src/composition/stripe-webhook-settlement.ts`, its unit test, and
`docs/architecture/EXECUTION_PROVIDERS_AND_BILLING.md`. Resolved by keeping both sides' additions
(both are net-new, non-overlapping error classes and doc paragraphs); verified with
`vitest run` (137/137 Core tests, 89/89 billing tests) and `tsc --noEmit` on both `@mustbeviral/core`
and `@mustbeviral/billing` before pushing the resolved merge commit.

**Not done, and still owner-gated:** no migration was applied to any remote database (staging or
production); `STRIPE_WEBHOOK_SECRET` remains unbound on both Core Workers, so `/webhooks/stripe`
still returns 503 in both environments and none of this new code is reachable in production yet;
the merged Core code was not redeployed to Cloudflare (staging and production Core still run the
`fe36f20` build recorded in `web-and-worker-production-deploy-2026-09-16.md`). A human payments
review of all merged Stripe PRs (including the ones from earlier sessions: #8, #9, #13, #16, #17,
#18) is still outstanding.

## Private local MustBeViral line pushed for review

The 56-commit private local continuation (previously only on this machine, `e1d648d` on the local
`codex/viralgraph-cleanroom` branch) was pushed, unmodified, to a new branch
`private-platform-continuation-20260916` on `ashrunscode/MustBeViral`, at the owner's explicit
request, for review. It was not merged, and `codex/viralgraph-cleanroom` was not touched by this
push. Before pushing, this operator scanned the diff against the current default branch for common
secret patterns and credential-shaped files; nothing beyond synthetic test fixtures (`whsec_*` test
constants, a `SYNTHETIC_JOURNEY_PASSWORD` labelled as such) was found. The 592-file diff still needs
the owner's own review to decide how it reconciles with the current `codex/viralgraph-cleanroom`
plan.

## Production collaboration Worker: deploy and smoke, following PR #38

PR #38 (merge commit `3371648`) set `workers_dev: true` for
`mustbeviral-v2-production-collaboration`. This section records the deploy and verification that
followed it, per that PR's "after merge" note.

### Deploy

| Component                                                                | Before                                                               | After                                                                                                     |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `mustbeviral-v2-production-collaboration`                                | `0ed24f4e-2ddc-4015-b6b0-775f691d77e3`, unrouted                     | `07e600ef-f1c8-45ab-afb6-7d92ad9a1191`, same code, now `workers_dev: true`                                |
| `mustbeviral-web-production` (Vercel `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`) | `dpl_8Nq2ZzmZzN5Q1RaJJ9xVS6uhFrrm` (no collaboration URL configured) | `dpl_5j3JcUsBR8foiEaaTtqto21EbQH7`, same source (`3371648`), now with `NEXT_PUBLIC_COLLABORATION_API_URL` |

`NEXT_PUBLIC_COLLABORATION_API_URL` was added to the `mustbeviral-web-production` Vercel project
(encrypted, Production target) as `https://mustbeviral-v2-production-collaboration.ernijs-ansons.workers.dev`,
matching the pattern already used on `mustbeviral-web-staging`.

Rollback: for the Worker, `wrangler rollback 0ed24f4e-2ddc-4015-b6b0-775f691d77e3 --config
apps/collaboration/wrangler.jsonc --env production` restores the code version, but the config
change (`workers_dev`) is only reverted by setting it back to `false`/removing the key and
redeploying — see `production-collaboration-traffic-decision-2026-09-16.md` for the full rollback
note. For the web app, `vercel rollback dpl_8Nq2ZzmZzN5Q1RaJJ9xVS6uhFrrm` in the production project,
or remove the env var and redeploy.

### Smoke evidence

| Request                                                              | Before this deploy                          | After                      |
| -------------------------------------------------------------------- | ------------------------------------------- | -------------------------- |
| `GET /health` on the production collaboration `workers.dev` hostname | 404 (Cloudflare error 1042 class; unrouted) | 200                        |
| `GET /canvases/:id/snapshot`, no ticket                              | unreachable                                 | 401                        |
| WebSocket upgrade, no ticket                                         | unreachable                                 | 401                        |
| WebSocket upgrade, forged `Sec-WebSocket-Protocol` ticket            | unreachable                                 | 401                        |
| Production web `/`, `/login`, `/forgot-password`                     | 200                                         | 200 (unchanged)            |
| Production web `/studio` (unauthenticated)                           | 307 → `/login`                              | 307 → `/login` (unchanged) |
| Production web `/api/core/health` (proxy)                            | 200                                         | 200 (unchanged)            |
| Production web ticket endpoint, no auth                              | 401                                         | 401 (unchanged)            |

### Bundle verification

A local production build of the web app from `3371648`, with `NEXT_PUBLIC_COLLABORATION_API_URL`
set to the production collaboration Worker's new public URL, confirmed the origin compiles into
`.next/static` (1 match), the same mechanism verified for staging and for the deliberately-excluded
earlier production build in `web-and-worker-production-deploy-2026-09-16.md`. The production
collaboration origin was not found in the 14 `/_next/static/*.js` chunks referenced from `/`,
`/login`, and `/forgot-password` when fetched from the live site — expected, since the collaboration
client only loads on the authenticated `/studio` route, which those public pages do not reference.

### CI

`3371648` (the merge that landed the `workers_dev` change) is green on
`codex/viralgraph-cleanroom`: governance, quality, and database-pgtap all passed.

## Worktree/tooling notes for a future session

Deploying a Cloudflare Worker or building the web app from a **new** worktree in this pnpm
workspace needs a real `pnpm install --frozen-lockfile` run inside that worktree — not a
`node_modules` junction back to the canonical checkout. A per-package `node_modules` junction
(e.g. `apps/collaboration/node_modules` → canonical's) drags in the canonical checkout's _own_
relative symlinks to `packages/*`, so esbuild ends up bundling the canonical checkout's version of
a shared package (which may be a different, possibly stale, commit) instead of the worktree's own.
This was caught before any bad deploy went out — `wrangler deploy --dry-run` failed loudly with
"No matching export" once the worktree's Worker source (current tip) was paired with the
canonical checkout's older `packages/collaboration` — but it is a real trap: junctioning only the
top-level `node_modules` (fine for scripts that stay within one package, as done earlier this
session for the web build) is not sufficient once a build needs to resolve a workspace-linked
package's _own_ source.
