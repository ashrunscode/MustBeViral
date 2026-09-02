# WP-P3-008 production binding and smoke evidence

## Database and Auth

- Applied the forward-only migration
  `supabase/migrations/20260902154759_production_disabled_binding_hardening.sql` to only
  `jjgtlfblsfobdhmtngbz`.
- The migration made the four singleton kill switches false, changed the generation/provider
  defaults to false, converted six RLS predicates to initplan-safe `(select auth.uid())` form, and
  added 32 foreign-key covering indexes.
- The database pgTAP contract is
  `supabase/tests/database/00036_production_disabled_binding_hardening.test.sql`.
- Security Advisor has zero errors. The remaining 19 findings are the previously classified
  allowlist. Performance Advisor no longer reports uncovered foreign keys or `auth_rls_initplan`;
  its remaining 59 unused-index notices are expected before traffic and its one Auth connection
  notice is a managed-project setting.
- Auth remains closed: `disable_signup=true`, `mailer_autoconfirm=false`, and there are zero Auth
  users. Site/callback values now name only the protected provider alias
  `https://mustbeviral-web-production-ashrunscode-projects.vercel.app` and its `/auth/callback`.

## Cloudflare Core and private R2

- Final Worker version: `b832cca9-3dea-46d2-8313-eba80854c1ca`.
- Final deployment: `ee26c70e-9be5-4406-a5af-ceec2897f42a` at 100 percent.
- Provider URL: `https://mustbeviral-v2-production-core.ernijs-ansons.workers.dev`.
- Bindings name only the exact production R2 and Supabase targets. `PROVIDER_RUNS_ENABLED=false`
  and `QUEUES_ENABLED=false`; no route, custom domain, cron, queue, or Hyperdrive is bound.
- Secret presence is exactly `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
  `CONFIRMATION_SIGNING_KEY`, and `ARTIFACT_ACCESS_SIGNING_KEY`. Values moved through provider CLIs
  on stdin and never entered source/evidence. fal, OpenRouter, Stripe, Resend, and Sentry secrets are
  intentionally absent.
- R2 remains at 0 objects / 0 B with no custom domain and r2.dev disabled.
- Core Worker type generation and checking both use `.dev.vars.example` explicitly, so the declared
  binding-name surface is deterministic between developer machines and clean CI checkouts without
  reading or copying real local values.

Final HTTP probes on the exact Worker version:

| Probe                             | Result                                         |
| --------------------------------- | ---------------------------------------------- |
| `GET /health`                     | 200, correct Core service/generation envelope  |
| protected V1 request without JWT  | 401 `UNAUTHENTICATED`                          |
| `POST /v1/webhooks/fal`           | 503 `MODEL_UNAVAILABLE` before verifier/ingest |
| `POST /webhooks/stripe`           | 503 `PROVIDER_UNAVAILABLE`                     |
| unsigned artifact content request | 401 `UNAUTHENTICATED`                          |

Cloudflare observability returned these same paths/statuses on the final version with outcome `ok`,
zero exceptions, zero truncated events, and no authorization, API-key, secret, email, raw-body, or
request-body field names in the returned events.

## Vercel web

- Exact project/team: `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj` /
  `ashrunscode-projects`.
- Final READY production deployment: `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`.
- Protected deployment URL:
  `https://mustbeviral-web-production-hjqmp880t-ashrunscode-projects.vercel.app`.
- Protected stable provider alias:
  `https://mustbeviral-web-production-ashrunscode-projects.vercel.app`.
- Both protected URLs return a 302 to Vercel SSO with `X-Robots-Tag: noindex` to an anonymous
  request. The short alias `mustbeviral-web-production.vercel.app` was removed after Vercel's plan
  would not extend SSO to production custom aliases; it now returns 404.
- Production environment names are exactly `NEXT_PUBLIC_APP_ORIGIN`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
  `NEXT_PUBLIC_CORE_API_URL`. No Supabase secret/service-role key is present.
- The remote Next.js build completed all nine Turbo build tasks. The governed repository pin stays
  at pnpm `11.12.0`; because that release is broken in Vercel's installer, the exact production
  project uses the isolated install override
  `corepack pnpm@11.25.0 --pm-on-fail=ignore install --frozen-lockfile`. No repository toolchain
  authority was changed.
- A final production log query returned no runtime error events for the READY deployment.

The first bounded deployment failed before build because Vercel rejects pnpm `11.12.0`. A second
validation deployment proved the override must carry `--pm-on-fail=ignore`; both failed deployments
remained ERROR and were never promoted. The successful final build used the exact override above.
An earlier unbounded CLI upload was interrupted at 0 B when it reported a 4.2 GB local input; the
successful clean tracked-source package uploaded 25.3 KB and contained no real environment file.

## Concrete blocker

The packet requires authenticated operator smoke for database/RLS connectivity. Production Auth
has zero users, so there is no approved identity. Per packet authority, no identity was invented,
self-service signup was not enabled, and no customer row was created. Health, closed enrollment,
JWT denial, artifact denial, disabled provider/charge paths, provider configuration, and direct
database state are proven; an actual signed-in RLS session remains blocked until the operator
supplies or separately authorizes exactly one production owner identity.
