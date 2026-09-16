# Web and Worker production deploy — 2026-09-16

Owner instruction in the working session: "deploy". Continuation of
`collaboration-auth-deploy-2026-09-16.md`, which covered the collaboration
Worker authentication fix on 2026-09-16 morning. This record covers the
staging web redeploy, the production Worker deploys, and the production web
deploy that followed later the same day, after PRs #30–#36 merged.
Operator: Claude Code (Opus 5) session on Impact_flow, acting for the owner.

## Scope

Deployed:
- Collaboration Worker, staging and production (hardening + presence, PRs #31 and #35).
- Core Worker, staging and production (collaboration ticket route, PR #23; merged Stripe webhook code carried along, route left disabled — see below).
- Web app, staging and production (Vercel), from `codex/viralgraph-cleanroom` at `d5487a635f0efb257b48f7efe7df96b2f649dea5` (merge of PR #36).

Not deployed / not changed: Supabase migrations (none applied remotely, staging or production); `STRIPE_WEBHOOK_SECRET` (left unbound on both Core Workers, so `/webhooks/stripe` intentionally returns 503); production collaboration Worker routing (still has no `workers.dev` route and no custom route — not publicly reachable, unchanged from the prior record).

## Why

PR #36 removed a bug introduced by PR #27: `apps/web/.env.production` had
committed `NEXT_PUBLIC_COLLABORATION_API_URL` pointing at the **staging**
collaboration Worker. Every value in that file is inherited by any Vercel
project that does not override it, so the production web build would have
proxied live collaboration traffic to the staging Worker. PR #36 removed the
line and left a comment explaining why; the staging Vercel project was given
its own `NEXT_PUBLIC_COLLABORATION_API_URL` override in project env instead.
Before deploying production, this session verified the mechanism directly
(see "Bundle verification" below) rather than assuming the doc comment was
correct.

## Versions

| Worker | Rollback target (before this session) | Deployed now |
| --- | --- | --- |
| `mustbeviral-v2-staging-collaboration` | `85081635-d80a-4553-99c7-3cd2471ed12d` | `9be94011-009c-4096-b10d-aeae469a0c18` (collab hardening + presence, `7d740ae`, PRs #31/#35) |
| `mustbeviral-v2-production-collaboration` | `e58a5294-7544-4121-a8ee-b3f059b6f509` | `0ed24f4e-2ddc-4015-b6b0-775f691d77e3` (same source, `fe36f20`) |
| `mustbeviral-v2-staging-core` | `80344a3c-3182-4917-be06-8128d6b9454d` | `2e3f030c-0258-4551-bb7d-309323b1a45e` (collaboration tickets, `7d740ae`, PR #23) |
| `mustbeviral-v2-production-core` | `533592d3-9bfb-455d-9581-f023f2169f9f` | `5e8b2202-112a-468a-964d-882a5b88f914` (same source, `fe36f20`; Stripe route left disabled) |

Rollback for Workers: `wrangler rollback <version-id>` with the matching
`--config` and `--env`.

| Vercel project | Rollback target (before this session) | Deployed now |
| --- | --- | --- |
| `mustbeviral-web-staging` (`prj_SVRV9Oh6J3lAi3muIbK9Mrtkvv6V`) | `dpl_EFVgRCdcWm3DkrVBL8usUQgidkMN` | `dpl_9UyKmePoeBdWLK8BnEDx25sAGbbv` (`d5487a6`, PR #36) |
| `mustbeviral-web-production` (`prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`) | `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb` | `dpl_8Nq2ZzmZzN5Q1RaJJ9xVS6uhFrrm` (`d5487a6`, PR #36) |

Rollback for web: `vercel rollback <deployment-url-or-id>` in each project, or
`vercel promote <deployment-id>` to re-alias the prior deployment.

## Vercel project configuration changes made during this deploy

Both were required to get the production build passing; neither changes
application behavior:

1. **`mustbeviral-web-production` install command** was
   `` corepack pnpm@11.25.0 --pm-on-fail=ignore install --frozen-lockfile `` (a
   stale setting from an earlier troubleshooting session, not present on
   staging). Changed to match staging exactly:
   `` corepack enable && corepack prepare pnpm@11.12.0 --activate && pnpm install --frozen-lockfile ``.
2. **`mustbeviral-web-production` env**: added `ENABLE_EXPERIMENTAL_COREPACK=1`
   (encrypted, Production target) — staging already had this set. Without it,
   Vercel's own bundled pnpm resolver picks pnpm 11.25.0, whose `@pnpm/exe`
   build is broken upstream ("pnpm v11.12.0 is a broken release and cannot be
   installed" / equivalent failure on 11.25.0); with it, corepack installs the
   pinned `packageManager` version from `package.json` (11.12.0) instead. Two
   production builds failed on this before the fix (`dpl_D4bEaLbcCb2bxcSdpRvW746GiXgL`,
   `dpl_5TWmiA6RFf3pBvRvtxWEPVi9KJdD`), both left in `ERROR` state and never
   promoted — production traffic stayed on `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`
   throughout.
   No collaboration URL was added to production — that variable is
   deliberately absent there, per PR #36.

Earlier the same day (recorded here for completeness, not new in this
record): `mustbeviral-web-staging`'s `rootDirectory` was corrected from `null`
to `apps/web`, and `NEXT_PUBLIC_COLLABORATION_API_URL` was added to that
project's env — both already reflected in PR #36 and its surrounding work.

## Bundle verification

Before the production web deploy, this session built the web app locally
twice from `d5487a6` (via `pnpm --filter @mustbeviral/web exec next build`,
since plain `next` is not hoisted to the repo root under this pnpm workspace)
to confirm the inclusion mechanism rather than assume it:

| Build | `NEXT_PUBLIC_COLLABORATION_API_URL` | Collaboration origin string present in `.next/static` |
| --- | --- | --- |
| A (mirrors `mustbeviral-web-staging`) | set to the staging collaboration Worker URL | yes |
| B (mirrors `mustbeviral-web-production`) | unset | no |

This confirms the variable is compiled into the client bundle only when set,
and that production's build (which leaves it unset) does not ship a
collaboration origin at all — live collaboration stays off in production
until the owner decides to route it there.

After the actual production deploy, the same check was repeated against the
live bundle: all 14 `/_next/static/*.js` chunks referenced from `/`, `/login`,
and `/forgot-password` were fetched and scanned. Zero contained any
`workers.dev` URL, any `staging` string, or the collaboration Worker host
name.

## Smoke evidence

All checks below ran after the deploys above, with a new probe canvas id
(`deploy-probe-<unix-timestamp>`, never a real canvas) where a canvas id was
needed.

### Web

| Request | Staging (`mustbeviral-web-staging.vercel.app`) | Production (`mustbeviral-web-production.vercel.app`) |
| --- | --- | --- |
| `GET /` | 200 | 200 |
| `GET /login` | 200 | 200 |
| `GET /forgot-password` | 200 | 200 |
| `GET /studio` (unauthenticated) | 307 → `/login?next=%2Fstudio` | 307 → `/login?next=%2Fstudio` |
| `GET /api/core/health` (proxy) | 200 | 200 |
| `POST /api/core/v1/canvases/:id/collaboration-tickets`, no auth | 401 | 401 |

Production's `/api/core/health` body: `{"schema_version":"2026-07-12","service":"mustbeviral-core","generation":"viralgraph-cleanroom-v2","status":"ok",...}` — confirms the Next.js rewrite reaches the production Core Worker, not staging.

### Collaboration Worker (staging; production has no public route, see Scope)

| Request | Result |
| --- | --- |
| `GET /health` | 200 |
| `GET /canvases/:id/snapshot`, no ticket | 401 |
| WebSocket upgrade, no ticket | 401 |
| WebSocket upgrade, forged `Sec-WebSocket-Protocol` ticket | 401 |

`GET /health` on the production collaboration Worker's `workers.dev` hostname
returned 404 (Cloudflare error 1042 class), confirming it stayed unreachable
by direct route, consistent with the prior record.

### Core Worker (direct, both environments)

| Request | Staging | Production |
| --- | --- | --- |
| `GET /health` | 200 | 200 |
| `POST /webhooks/stripe`, unsigned | — | 503 (expected: `STRIPE_WEBHOOK_SECRET` intentionally unbound) |

### CI on deployed source commits

| Commit | governance | quality | database-pgtap |
| --- | --- | --- | --- |
| `7d740ae` (PR #35, staging Worker source) | success | success | success |
| `fe36f20` (PR #34, production Worker source) | success | success | success |
| `d5487a6` (PR #36, both web deploys' source) | success | success | success |

## Consequence until the rest ships

Production behaves as before this session for end users: live collaboration
stays refused there because the web bundle carries no collaboration Worker
address. Staging now correctly serves a working, authenticated collaboration
path end-to-end (Worker + Core ticket route + web client), but an actual
signed-in, two-browser collaboration session there has not been exercised in
this session and needs owner sign-in to verify. Routing production
collaboration traffic to a real address, applying any Supabase migration, and
binding `STRIPE_WEBHOOK_SECRET` remain owner decisions, not made here.
