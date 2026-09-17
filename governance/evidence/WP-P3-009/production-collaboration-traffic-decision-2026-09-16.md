# Production collaboration Worker traffic decision — 2026-09-16

## Scope note

WP-P3-009's objective states it prepares, without executing, a DNS/customer-traffic go or no-go
decision, and its `public_interfaces` list previously named only the SSO-protected Vercel team
alias and the workers.dev Core URL. This record documents a deliberate, owner-authorized deviation
from that "no cutover" framing for one narrow surface — the production collaboration Worker's
`workers.dev` reachability — not an oversight of it. It is not the separate DNS/customer-traffic
decision packet that WP-P3-009's pending step `p3i-004-traffic-go-no-go-packet` describes: no
custom domain, DNS record, or legacy V1 traffic is touched, and public signup, customer admission,
provider execution, queues, and charging remain exactly as WP-P3-009 already states.

## Owner decision

In the working session, after this operator's report listed "Decide whether/when to route the
production collaboration Worker" as a remaining owner-gated item, the owner replied "all approved,
proceed." Asked again directly, after this operator surfaced WP-P3-009's "no cutover" language,
the owner confirmed: proceed now, with the deviation documented here.

## Exact change

- `apps/collaboration/wrangler.jsonc`: `env.production` gets `"workers_dev": true`, matching
  `env.staging` on the same file and `env.production` on `apps/core/wrangler.jsonc` (Core's
  production Worker has been `workers_dev: true` since 2026-09-02).
- New public surface: `https://mustbeviral-v2-production-collaboration.ernijs-ansons.workers.dev`.
  No custom route, no custom domain.
- `NEXT_PUBLIC_COLLABORATION_API_URL` set on the `mustbeviral-web-production` Vercel project
  (`prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`) to that URL, encrypted, Production target only — the same
  pattern already used for `mustbeviral-web-staging`. Production web redeployed from the current
  `codex/viralgraph-cleanroom` tip so the client bundle picks it up at build time.
- `docs/delivery/ACTIVE_WORK_PACKET.yaml` `public_interfaces` updated to name this surface, so the
  packet's own scope declaration matches what is now actually public.

## What already gates access

The Worker's authentication does not change here — it was built, deployed, and independently
verified in `collaboration-auth-deploy-2026-09-16.md` (PR #25) and re-verified in
`web-and-worker-production-deploy-2026-09-16.md` (PR #37): 60-second HMAC-SHA256 tickets issued by
Core's `POST /v1/canvases/{id}/collaboration-tickets`, checked on every snapshot read and every
WebSocket upgrade. An unauthenticated or forged request gets 401 whether or not the Worker has a
public route. Enabling `workers_dev` only makes the Worker reachable to attempt a request against;
it does not weaken that check. The Worker still has no Origin/CORS allow-list (unlike Core's
`CORS_ALLOWED_ORIGINS`), so any origin can attempt a request — it will still be refused without a
valid ticket. Adding an origin allow-list here is a reasonable follow-up but is out of scope for
this traffic decision, since it is a new security control that would need its own review and tests
rather than being folded into a routing change.

## Smoke evidence

Recorded after deploy, in this same PR's follow-up commit or the next evidence file:
`GET /health` on the new public URL, and unauthenticated snapshot/WebSocket 401, both before and
after the web app is redeployed. See `web-and-worker-production-deploy-2026-09-16.md` for the
equivalent staging results this mirrors.

## Rollback

Set `workers_dev` back to `false` (or remove the key) in `apps/collaboration/wrangler.jsonc`
`env.production`, then `wrangler deploy --config apps/collaboration/wrangler.jsonc --env
production`. Takes effect immediately: the Worker returns to unreachable (Cloudflare error 1042).
Separately, remove `NEXT_PUBLIC_COLLABORATION_API_URL` from the `mustbeviral-web-production`
Vercel project and redeploy production web to stop shipping the collaboration origin in the
client bundle. Rollback owner: the account owner (`ernijs.ansons@gmail.com`), the same identity
authorized in `owner-identity-authorization-2026-09-04.md`.
