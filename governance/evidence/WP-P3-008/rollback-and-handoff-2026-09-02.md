# WP-P3-008 rollback and handoff

## Kill order

On any anomaly, keep `signups_enabled`, `generation_enabled`, `provider_routes_enabled`, and
`charging_enabled` false in `app_private.platform_kill_switches`; keep
`PROVIDER_RUNS_ENABLED=false` and `QUEUES_ENABLED=false`; do not add a queue, cron, route, custom
domain, provider secret, or public R2 URL.

## Core rollback

- Current reviewed version: `b832cca9-3dea-46d2-8313-eba80854c1ca`.
- Emergency containment version: `45077c66-f31e-4c30-8396-9300b8e27fe0`.
- Inspect: `pnpm exec wrangler versions list --name mustbeviral-v2-production-core --json`.
- Roll back only if required:
  `pnpm exec wrangler rollback 45077c66-f31e-4c30-8396-9300b8e27fe0 --name mustbeviral-v2-production-core`.
- Re-prove secret names after rollback with
  `pnpm exec wrangler secret list --env production --config apps/core/wrangler.jsonc`.

The emergency version is fail-closed, but it was built before a scope-rejected billing edit was
removed and is not an exact reviewed-source candidate. Use it only to restore containment during an
incident, then forward-deploy the reviewed current source. No older production version is both a
distinct rollback target and an exact build of the final governed source because the Worker did not
exist before this packet.

## Web rollback

- Current READY deployment: `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`.
- Prior READY deployment: `dpl_GViXhNqvydKLR14T9kjhh42CQPxc`.
- Failed, never-ready deployments: `dpl_HodxZuhwpWUnghUarFWjgfYV7hZ8` and
  `dpl_DxN1YzWwP7Ca3mbdPG3SVhA36ajP` (never select either).
- To restore only the protected team provider alias without recreating the unprotected short alias:
  `pnpm exec vercel alias set dpl_GViXhNqvydKLR14T9kjhh42CQPxc mustbeviral-web-production-ashrunscode-projects.vercel.app --scope ashrunscode-projects`.
- Confirm the anonymous response remains the Vercel SSO redirect before any operator smoke.

Local `.vercel` metadata was restored to the staging project after the production operation. The
temporary local OIDC environment file was removed.

## Database rollback

The migration is additive/forward-only and stays applied. Do not rewrite migration history or
restore over production. If a defect appears, keep traffic at zero and ship a separately reviewed
forward migration. Auth callback rollback values were `site_url=http://localhost:3000` and an empty
URI allowlist, but reverting them is unnecessary while the provider alias remains SSO protected.

## Handoff blocker

`hello@mustbeviral.com` is now the exact approved production owner identity, but the pre-send email
delivery gate failed closed. Supabase organization `cwsipbaunvifcpgoygsc` has one member and zero
members matching the approved address, while project `jjgtlfblsfobdhmtngbz` has no custom SMTP.
Supabase's default SMTP refuses Auth mail to addresses outside the project team. No Auth user or
invitation was created, and the single authorized invitation attempt remains unused.

`BLOCKED_AUTH_EMAIL_DELIVERY_NOT_CONFIGURED`: configure an existing zero-spend custom SMTP provider
for only project `jjgtlfblsfobdhmtngbz`, without sending a test email or changing DNS, then reply
`SMTP READY`. Do not enable public signup, invite a customer, add provider/Stripe credentials,
execute a queue/run, or change DNS to resolve this.

## 2026-09-03 cloud-environment revalidation

Production containment still holds: zero Auth users/identities/sessions, zero approved-email
matches, zero workspaces/memberships, all four database kill switches false, Core health 200,
unsigned artifact 401, protected Vercel alias 302 SSO, removed short alias 404, legacy public
DNS surface unchanged, and no invitation sent.

This Linux cloud VM does not contain `%USERPROFILE%\.agent-secrets` / `$HOME/.agent-secrets`,
has no self-hosted worker, and has no active Resend or SMTP credentials. Custom SMTP was
therefore not configured. Official current `inviteUserByEmail` documentation states PKCE is not
supported, while the deployed callback is SSR PKCE-only; resolve that from accepted authority
before using the one authorized invitation. Do not paste secrets into chat. Do not use the
fallback Gmail address unless a recorded authority-compatible decision changes the exact owner
email. Do not begin WP-P3-009 observation and do not merge PR #3.
