# WP-P3-008 production closeout revalidation — 2026-09-03

Sanitized operator evidence only. No SMTP values, API keys, tokens, invite links, cookies,
passwords, signed URLs, raw environment values, or customer data.

Working branch for this execution: `codex/wp-p3-008-production-foundation` at
`1b8e234` before this evidence commit. Packet metadata previously named
`codex/viralgraph-cleanroom`; that branch has diverged to unrelated P0 work and is not
the production-evidence checkout used here.

## Phase 1 — Governed preflight

- Repository path: `/workspace` (this cloud checkout). No second checkout was created.
- Runtime: Node `24.18.0`, pnpm `11.12.0`.
- `pnpm agent:preflight` failed on branch mismatch (`codex/wp-p3-008-production-foundation`
  vs packet branch `codex/viralgraph-cleanroom`) before printing the document list.
- Authority documents required by the packet were still read: `AGENTS.md`,
  `PROJECT_STATE.yaml`, product/release/system/data-auth/quality/secrets/deploy/legacy
  finish-sprint authorities, and `docs/delivery/ACTIVE_WORK_PACKET.yaml`.
- Active packet: `WP-P3-008`. Current step: `p3h-004-private-smoke-and-cutover-gate`.
- Exact production Supabase project: `jjgtlfblsfobdhmtngbz` (`mustbeviral-prod`,
  `us-east-1`, `ACTIVE_HEALTHY`).
- Exact approved owner email: `hello@mustbeviral.com`.
- Remote destructive actions remain forbidden.
- Fallback address `ernijs.ansons@gmail.com` was not used. No dual-owner model was
  created. No invitation was sent.

## Phase 2 — Production containment revalidation

Captured 2026-09-03 from read-only Supabase MCP SQL, Cloudflare MCP metadata, and
anonymous HTTP probes. Wrangler CLI and Vercel CLI were not authenticated in this
environment. Supabase CLI was not linked (`supabase/.temp/project-ref` absent).

### Database and Auth counts

| Item                                             | Count |
| ------------------------------------------------ | ----- |
| Auth users                                       | 0     |
| Auth identities                                  | 0     |
| Auth sessions                                    | 0     |
| Auth refresh tokens                              | 0     |
| Approved-email matches (`hello@mustbeviral.com`) | 0     |
| Workspaces                                       | 0     |
| Workspace memberships                            | 0     |
| Projects                                         | 0     |
| Artifacts                                        | 0     |
| Runs                                             | 0     |
| Attempts                                         | 0     |
| Provider jobs                                    | 0     |
| Outbox events                                    | 0     |
| Quotes                                           | 0     |
| Cost reservations                                | 0     |
| Ledger transactions                              | 0     |
| Stripe webhook events                            | 0     |
| Workspace billing profiles                       | 0     |

Catalog/reference rows remain present and were not mutated: provider registrations 4,
price catalog versions 2, model routes 5, model route prices 8.

### Kill switches

`app_private.platform_kill_switches` singleton:

- `signups_enabled`: false
- `generation_enabled`: false
- `provider_routes_enabled`: false
- `charging_enabled`: false

### Auth configuration

Management API Auth config was not re-read: this environment has no Supabase access
token or trusted secret-store loader. The unauthenticated `/auth/v1/settings` probe
returned 401. Last recorded closed-enrollment values from 2026-09-02 remain the last
proven snapshot: `disable_signup=true`, `mailer_autoconfirm=false`, site/callback naming
only `https://mustbeviral-web-production-ashrunscode-projects.vercel.app` and
`/auth/callback`.

Custom SMTP presence could not be read back as booleans from Auth config in this
environment. Containment still proves zero Auth users and zero approved-email matches,
so no invitation or owner identity exists.

### Cloudflare Core and R2

- Production Core Worker ID still `90bbdf6c78094d779754a28ebb1ec019`.
- Production R2 bucket `mustbeviral-v2-production-media` still exists (ENAM, Standard).
- Repository production Worker config still has `PROVIDER_RUNS_ENABLED=false`,
  `QUEUES_ENABLED=false`, no production queue, no production cron, no custom route, and
  `preview_urls=false`.
- Object count could not be re-listed: Wrangler CLI is unauthenticated here. Previous
  proven count was 0 objects / 0 B.
- Named public probe `https://mustbeviral-v2-production-media.r2.dev/` returned 500, not
  a public object listing. Official R2 docs state buckets are private until r2.dev or a
  custom domain is explicitly enabled.
- Anonymous Core `GET /health` returned 200 with service `mustbeviral-core`, generation
  `viralgraph-cleanroom-v2`, status `ok`.
- Anonymous unsigned artifact content request returned 401 `UNAUTHENTICATED`.

### Vercel and DNS surface

- Protected alias
  `https://mustbeviral-web-production-ashrunscode-projects.vercel.app/` still returns 302
  to Vercel SSO with `X-Robots-Tag: noindex`.
- Removed short alias `https://mustbeviral-web-production.vercel.app/` still returns 404.
- Legacy `mustbeviral.com` and `www.mustbeviral.com` still return 200.
- `api.mustbeviral.com` remains unresolved.
- No DNS, custom-domain, or legacy mutation was performed.

## Phase 3 — Custom SMTP

Inspected only trusted-store metadata and already-connected provider metadata:

- `$HOME/.agent-secrets/README.md` is absent on this Linux cloud VM.
- `%USERPROFILE%\.agent-secrets` is absent.
- No self-hosted Cursor worker is connected.
- Process environment has no SMTP / Resend / Supabase secret names present.
- No local `.env`, `.env.local`, or `.dev.vars` file is present.
- Composio toolkit `resend` has no active connection (`has_active_connection=false`,
  accounts empty). A list-status call initiated a pending connection with zero
  accounts; that OAuth was not completed and no Resend resource was created.

Official current Supabase Auth SMTP documentation
(`https://supabase.com/docs/guides/auth/auth-smtp`) still states that without custom
SMTP, Auth refuses delivery to addresses that are not organization/project-team
members.

No compliant existing SMTP provider or verified sender credential was available in this
execution environment. Custom SMTP was not configured. No SMTP test email was sent. No
DNS change was made. No new email provider was provisioned or purchased.

## Phase 4 — Invitation

Not attempted. Pre-send gates that failed closed:

- Custom SMTP not configured and not readable as present.
- Auth users remain 0; approved-email matches remain 0.
- The single authorized invitation attempt remains unused.

Official current `inviteUserByEmail` documentation states PKCE is not supported for
that Admin API. The deployed web callback is SSR PKCE-only
(`exchangeCodeForSession` on a `code` query parameter). Official email-template docs
show the default `ConfirmationURL` going through `/auth/v1/verify?token=...` and, for
SSR, recommend a `token_hash` + `verifyOtp` server path. This compatibility question
must be resolved from accepted authority before the one authorized invitation is
attempted. No local workaround was invented and no second callback origin was added.

## Phases 5 and 6

Skipped. The user has not replied `SIGNED IN`. Authenticated smoke, workspace
creation, JWT validation, RLS/cross-tenant proofs, and `pnpm agent:finish` were not
run.

## Zero-spend and no-mutation

No generation, provider job, queue, cron, charge, Stripe, ledger, customer admission,
public R2, DNS, custom-domain, or Legacy V1 mutation was performed. The unused
invitation budget remains one.

## PR #3 inherited status (read-only; not merged)

PR #3 head `1b8e234` on `codex/wp-p3-008-production-foundation` targeting `main`:

- GitHub `mergeable`: `MERGEABLE`
- GitHub `mergeStateStatus`: `UNSTABLE`
- Governance: fail — merge-range paths `.github/workflows/governance.yml` and
  `.github/workflows/quality.yml` remain outside base packet `WP-R0-002`
- Quality: pass
- database-pgtap: fail
  - `00029_p1a_stripe_wallet_settlement`: `operator does not exist: uuid = text`
  - `00032_p1b_oauth_scope_and_revocation`: `permission denied for table oauth_access_tokens`
  - `00034_p2_collaboration_checkpoint_revision`: `FORBIDDEN`
  - `00036_production_disabled_binding_hardening`: ok
- GitGuardian: `NEUTRAL` / skipping — not remediation

Mechanical mergeability is not governance mergeability. PR #3 remains a governance
NO-GO and was not merged or repaired in this packet.
