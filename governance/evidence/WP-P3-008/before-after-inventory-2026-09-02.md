# WP-P3-008 production before/after inventory

Captured 2026-09-02 on branch `codex/viralgraph-cleanroom`. Values below are identifiers,
counts, or booleans only. No credential value was printed or persisted.

## Exact target allowlist

| Provider          | Exact production target                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| Supabase          | `jjgtlfblsfobdhmtngbz` (`mustbeviral-prod`, `us-east-1`, `ACTIVE_HEALTHY`) |
| Cloudflare R2     | `mustbeviral-v2-production-media`                                          |
| Cloudflare Worker | `mustbeviral-v2-production-core`                                           |
| Vercel            | `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj` in `ashrunscode-projects`               |

The legacy Vercel projects `must-be-viral` and `mustbeviral`, legacy Workers
`mustbeviral`, `mustbeviral-staging`, and `mustbeviral-production`, and the existing V2
staging resources were inventory-only and were not mutated.

## Before and after

| Boundary               | Before                                                                                                                                                               | After                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Git                    | Correct branch; local history was 74 commits ahead and 3 behind the same-named remote branch                                                                         | Correct branch; history is preserved and no rebase, squash, reset, or force-push was used                                          |
| Supabase migrations    | 38                                                                                                                                                                   | 39; last is `20260902154759_production_disabled_binding_hardening`                                                                 |
| Database kill switches | signup false; charging false; generation true; provider routes true                                                                                                  | signup false; charging false; generation false; provider routes false                                                              |
| Supabase Auth users    | 0                                                                                                                                                                    | 0                                                                                                                                  |
| Customer/work rows     | 0 workspaces, memberships, projects, quotes, runs, attempts, provider jobs, artifacts, reservations, ledger rows, outbox events, Stripe events, and billing profiles | Same zero counts                                                                                                                   |
| Storage rows           | 0                                                                                                                                                                    | 0                                                                                                                                  |
| Security Advisor       | 19 classified findings: 0 error, 17 intentional authenticated `SECURITY DEFINER` warnings, 2 webhook-table policy infos                                              | Same classified set; 0 errors                                                                                                      |
| Performance Advisor    | 66 infos: 32 uncovered foreign keys, 6 `auth_rls_initplan`, 27 unused indexes, 1 Auth connection setting                                                             | 60 infos: 59 unused indexes and 1 Auth connection setting; uncovered-FK and initplan classes are zero                              |
| Production Core        | Did not exist                                                                                                                                                        | Worker ID `90bbdf6c78094d779754a28ebb1ec019`; current version `b832cca9-3dea-46d2-8313-eba80854c1ca`; workers.dev only             |
| Production R2          | 0 objects, 0 B, no custom domain, r2.dev disabled                                                                                                                    | Unchanged: 0 objects, 0 B, no custom domain, r2.dev disabled                                                                       |
| Production queue       | None                                                                                                                                                                 | None; only `mustbeviral-v2-staging-outbox-dispatch` exists                                                                         |
| Vercel project         | Exact project existed with no deployment, no custom domains, framework/root unset                                                                                    | Next.js, root `apps/web`; current READY deployment `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`; no MustBeViral custom domain                |
| Web access             | No production V2 deployment                                                                                                                                          | Provider deployment and team-scoped alias redirect to Vercel SSO; the unprotected short provider alias was removed and returns 404 |
| Legacy traffic         | `mustbeviral.com` and `www.mustbeviral.com` remained on the legacy Cloudflare surface                                                                                | Both still return 200 from the legacy Cloudflare surface; `api.mustbeviral.com` remains NXDOMAIN                                   |

No DNS API mutation, Cloudflare route attachment, custom-domain attachment, public R2 action,
customer admission, provider invocation, queue binding, Stripe/Resend action, or charge command was
issued. The public-DNS conclusion is backed by the unchanged legacy HTTP surface plus the mutation
ledger; the available Cloudflare credential did not expose a machine-readable zone-route listing.
