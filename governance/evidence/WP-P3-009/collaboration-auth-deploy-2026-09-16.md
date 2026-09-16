# Collaboration authentication deployment — 2026-09-16

Owner instruction in the working session: fix collaboration authentication and deploy.
Operator: Claude Code (Opus 5) session on Impact_flow, acting for the owner.
Source: `codex/viralgraph-cleanroom` at `417228de5704a63e44c4c16c6c3e11bfd8f5f98e`
(merge of PR #23), detached clean worktree, `pnpm install --frozen-lockfile`
with Node 24.18.0 / pnpm 11.12.0. Collaboration worker tests at that SHA:
41 passed. `wrangler deploy --dry-run` succeeded for staging and production.

## Scope

Deployed: the collaboration Worker in staging and production, and the new
`COLLABORATION_TICKET_SECRET` secret on the Core and collaboration Workers in
staging and production (a different value per environment, generated locally
from 48 random bytes and piped directly to `wrangler secret put`; never printed
or stored).

Not deployed: Core Worker code, the Next.js web app, and Supabase migrations.
The branch also carries merged Stripe webhook and database work whose
migrations are coordinated separately, and the web projects deploy through the
Vercel CLI, which is not authenticated on this machine. Setting a secret on Core
publishes a new version of the already-running Core code with the added secret;
no Core code changed.

## Why

Before this deployment the staging collaboration Worker served canvas snapshots
and accepted WebSocket connections without authentication.

## Versions

| Worker                                         | Rollback target (before)               | Deployed now                           |
| ---------------------------------------------- | -------------------------------------- | -------------------------------------- |
| `mustbeviral-v2-staging-collaboration`         | `92255439-310e-4803-a2ac-864008053882` | `85081635-d80a-4553-99c7-3cd2471ed12d` |
| `mustbeviral-v2-production-collaboration`      | `a1ab92c9-c651-4fee-a036-01a798b5081d` | `e58a5294-7544-4121-a8ee-b3f059b6f509` |
| `mustbeviral-v2-staging-core` (secret only)    | `e66b6d1c-47d1-44b9-b83d-e062c0119cae` | `80344a3c-3182-4917-be06-8128d6b9454d` |
| `mustbeviral-v2-production-core` (secret only) | `b832cca9-3dea-46d2-8313-eba80854c1ca` | `533592d3-9bfb-455d-9581-f023f2169f9f` |

Rollback: `wrangler rollback <version-id>` with the matching `--config` and
`--env`. Rolling collaboration back re-opens unauthenticated access; roll
forward instead.

## Smoke evidence

Staging collaboration, `https://mustbeviral-v2-staging-collaboration.ernijs-ansons.workers.dev`,
probed with a new, empty canvas id (`deploy-probe-1789563378`) so no real
canvas data was read.

| Request                                         | Before | After |
| ----------------------------------------------- | ------ | ----- |
| `GET /health`                                   | 200    | 200   |
| `GET /canvases/:id/snapshot`, no ticket         | 200    | 401   |
| WebSocket upgrade, no ticket                    | 101    | 401   |
| Snapshot with a forged `Authorization: Bearer`  | —      | 401   |
| Snapshot with a ticket in the query string      | —      | 401   |
| Snapshot with a forged identity header          | —      | 401   |
| WebSocket upgrade with a forged protocol ticket | —      | 401   |

Production collaboration has no `workers.dev` route and no custom route: `GET
/health` on its `workers.dev` hostname returned Cloudflare error 1042 (HTTP 404)
before and after, so it was not publicly reachable. Core `GET /health` returned
200 on staging and production after the secret was added.

## Consequence until the rest ships

Live collaboration is refused rather than open until Core code with the ticket
endpoint and the web app with the ticket client are deployed and
`NEXT_PUBLIC_COLLABORATION_API_URL` is configured on the web projects. No
deployment evidence records that variable, so live collaboration was already
unavailable in the deployed web app.
