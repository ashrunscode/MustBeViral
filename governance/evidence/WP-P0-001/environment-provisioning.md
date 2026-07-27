# WP-P0-001 — fail-closed environment-provisioning evidence

Date: 2026-07-19. Packet step: `p0-000-environment-provisioning`.

This checklist records identifiers, readiness states, provenance, owners, and value-free
verification commands only. It does not prove that any target has been provisioned and does not
contain credential values, connection strings, or key fragments.

Status meanings:

- `MISSING (operator input)` means repository evidence does not prove the required external input
  or resource. The dependent capability remains disabled.
- `PRESENT-VIA-OPERATOR-CLI` means repository history records an established operator CLI
  authentication path. It does not prove that a target resource exists or authorize mutations
  outside this packet.
- `OPEN` means an enable gate is unresolved, not approved.

Authority basis:

- `docs/operations/LOCAL_ENV_AND_SECRETS.md` requires environment isolation, operator-owned
  credential gates, ignored local secret storage, typed fail-closed validation, least privilege,
  and no secret material in Git or evidence.
- `docs/operations/DEPLOY_ROLLBACK_AND_INCIDENTS.md` requires preview-to-staging promotion,
  compatible deployment order, target/version records, staging smoke evidence, and verified
  rollback before production.
- `docs/architecture/SYSTEM_OVERVIEW.md` assigns relational truth to Supabase, rendering and
  previews to Vercel, provider/webhook execution to Core, and canonical private media bytes to R2.
- `docs/research/MODEL_CATALOG_EVIDENCE.md` defines the launch routes and their price and
  retention enable gates.
- `docs/research/RLS_HYPERDRIVE_BENCHMARK_PLAN.md` keeps Data API/RPC as the baseline and requires
  a dedicated non-owner, non-superuser, non-service, non-`BYPASSRLS` login role before a pooled
  candidate can be evaluated.

## 1. TARGETS

| P0 target                             | Intended identifier                                                                                                                         | Readiness                  | Requirements and fail-closed evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Provenance                                                                                                                                | Owner                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Staging Supabase project              | Logical name `mustbeviral-staging`; actual project ID and confirmed region are `MISSING (operator input)`                                   | `MISSING (operator input)` | Operator creates and names the isolated project and records its actual ID and region. The target must support CLI-applied forward-only migrations, forced RLS on tenant tables, and a dedicated pooled login role that is not an owner, superuser, service role, or `BYPASSRLS`. Sanitized catalog checks must prove the role owns no application object and `rolbypassrls` is false. Creating the role does not enable Hyperdrive; Data API/RPC remains the baseline until G1–G6 pass.        | `SYSTEM_OVERVIEW`; `LOCAL_ENV_AND_SECRETS`; `RLS_HYPERDRIVE_BENCHMARK_PLAN`                                                               | Data/platform operator |
| Vercel project for `apps/web`         | Project name and team are `MISSING (operator input)`                                                                                        | `MISSING (operator input)` | Operator creates or links one isolated project and records project name, team, and deployment IDs. Preview and staging environments must use non-production data, environment-scoped values, and disabled or strictly capped providers. Promotion requires staging smoke and rollback evidence.                                                                                                                                                                                                | `SYSTEM_OVERVIEW`; `LOCAL_ENV_AND_SECRETS`; `DEPLOY_ROLLBACK_AND_INCIDENTS`                                                               | Web platform operator  |
| Cloudflare Core Worker staging target | Account `d2897bdebfa128919bd89b265e6a712e`; proposed Worker name `mustbeviral-core-staging`; actual Worker ID is `MISSING (operator input)` | `MISSING (operator input)` | Deploy later through the repository-pinned Wrangler from `apps/core`. The account is shared with unrelated live businesses: every mutation must be scoped to newly created `mustbeviral-core-*` resources only. The current scaffold declares `mustbeviral-v2-staging-core`, so a later implementation commit must reconcile Wrangler configuration to the operator-created target before any deploy. Record deployed version, bindings, smoke evidence, and last-known-good rollback version. | Operator-supplied account boundary; `SYSTEM_OVERVIEW`; `DEPLOY_ROLLBACK_AND_INCIDENTS`; current `apps/core/wrangler.jsonc`                | Edge platform operator |
| Private R2 artifact bucket            | Proposed bucket `mustbeviral-core-staging-artifacts`; actual bucket confirmation is `MISSING (operator input)`                              | `MISSING (operator input)` | Operator creates only the proposed new bucket in the scoped account. Public access, public development URLs, and bucket listing for product clients must remain disabled. Record the exact bucket name, Core binding, privacy proof, recovery/inventory procedure, and rollback dependency. The current scaffold declares `mustbeviral-v2-staging-media`, so a later implementation commit must reconcile the binding without mutating unrelated resources.                                    | Operator-supplied target; `SYSTEM_OVERVIEW`; `LOCAL_ENV_AND_SECRETS`; `DEPLOY_ROLLBACK_AND_INCIDENTS`; current `apps/core/wrangler.jsonc` | Edge/storage operator  |

No target row may become ready from a proposed name, local placeholder, configuration declaration,
or successful CLI login alone. A later commit must attach sanitized provider receipts and
value-free verification evidence for the actual isolated resource.

## 2. CREDENTIALS

All runtime credentials are external operator inputs. Local files named below are ignored
developer-only storage; staging values belong only in the named provider secret store. A
verification command may prove identity or secret-name presence, never reveal a value.

| Credential or auth path                                                   | Readiness                                                                                                                                                                                                                                                                                           | Authorized storage location                                                                                                                                                               | Rotation owner               | Value-free verification                                                                                                                                     |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| fal API key for `flux-2-pro`, `flux-kontext-pro`, and `seedance-1.0-lite` | `PRESENT-VIA-OPERATOR-CLI` on staging Worker secret `FAL_KEY` and ignored local `apps/core/.dev.vars` (2026-07-27); routes remain disabled until price gates close and `PROVIDER_RUNS_ENABLED` is set intentionally                                                                                 | Local only: ignored `apps/core/.dev.vars`. Staging: Wrangler secret on `mustbeviral-v2-staging-core`. Never Vercel browser environment or Git.                                            | Provider operations owner    | `pnpm exec wrangler secret list --config apps/core/wrangler.jsonc --env staging`; confirm name `FAL_KEY` only.                                              |
| fal webhook signing secret                                                | `PRESENT-VIA-JWKS` (2026-07-27) — live fal uses public JWKS at `https://rest.fal.ai/.well-known/jwks.json` (no shareable HMAC secret). Core verifier accepts official `x-fal-webhook-*` headers via Ed25519 JWKS and keeps optional legacy HMAC only when `FAL_WEBHOOK_SECRET` is set for fixtures. | Staging Worker code path; no Wrangler secret required for live fal. Optional `FAL_WEBHOOK_SECRET` is fixture-only.                                                                        | Provider operations owner    | Unsigned `POST /v1/webhooks/fal` returns 401; JWKS endpoint reachable; unit tests cover JWKS + legacy HMAC.                                                 |
| Moonshot API key for `kimi-k2.6`                                          | `PRESENT-VIA-OPERATOR-CLI` on staging Worker secret `MOONSHOT_API_KEY` and ignored local `apps/core/.dev.vars` (2026-07-27); retention/DPA gate remains `OPEN` and the route stays disabled                                                                                                         | Local only: ignored `apps/core/.dev.vars`. Staging: Wrangler secret on `mustbeviral-v2-staging-core`. Never Vercel browser environment or Git.                                            | AI provider governance owner | `pnpm exec wrangler secret list --config apps/core/wrangler.jsonc --env staging`; confirm name `MOONSHOT_API_KEY` only.                                     |
| Supabase service-role key, staging                                        | `PRESENT-VIA-OPERATOR-CLI` (2026-07-27): staging Worker secrets `SUPABASE_SERVICE_ROLE_KEY` (legacy JWT) and `SUPABASE_SECRET_KEY` (`sb_secret_*`) installed from `supabase projects api-keys --reveal`; also written to ignored `apps/core/.dev.vars`                                              | Staging server-only: Wrangler secrets on `mustbeviral-v2-staging-core`. Local: ignored `apps/core/.dev.vars`. Prohibited from `apps/web`, browser bundles, and public Vercel environment. | Data/platform operator       | `pnpm exec wrangler secret list --config apps/core/wrangler.jsonc --env staging`; confirm names `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_SECRET_KEY` only. |
| Supabase publishable key, preview and staging                             | `PRESENT` as public Worker var `SUPABASE_PUBLISHABLE_KEY` on staging Wrangler config and in ignored local Core `.dev.vars` (2026-07-27); web staging already used the same public publishable value                                                                                                 | Local web: ignored `apps/web/.env.local` as needed. Staging Worker: `apps/core/wrangler.jsonc` `env.staging.vars` (client-public by design). Never substitute a production-project value. | Data/platform operator       | Confirm `SUPABASE_PUBLISHABLE_KEY` in staging Wrangler vars and `pnpm exec vercel env ls` for web scopes.                                                   |
| Vercel deploy authentication                                              | `PRESENT-VIA-OPERATOR-CLI` from established repository history; revalidation required before mutation                                                                                                                                                                                               | Operator CLI/browser credential store only. Do not copy deploy authentication into application runtime variables, Markdown, shell history, or Git.                                        | Web platform operator        | `pnpm exec vercel whoami`; record only the operator-approved identity/team result.                                                                          |
| Cloudflare deploy authentication                                          | `PRESENT-VIA-OPERATOR-CLI` from established repository history; revalidation required before mutation                                                                                                                                                                                               | Operator Wrangler authentication store only. Do not copy deploy authentication into `.dev.vars`, Vercel, Markdown, shell history, or Git.                                                 | Edge platform operator       | `pnpm exec wrangler whoami`; verify the approved account identifier without printing auth material.                                                         |

Credential rotation is staging-first: install the replacement through the provider secret store,
verify dual-key overlap when supported, promote only after smoke evidence, and revoke the prior
value. Missing or malformed runtime values must fail process-start validation. A missing credential
must never be replaced with another account, an unrelated project, or a mock represented as real.

## 3. WEBHOOK MATERIAL

- Planned staging endpoint shape:
  `POST https://api-staging.mustbeviral.com/webhooks/fal`.
- The endpoint must authenticate the raw request bytes with the fal webhook signing material before
  parsing or acting on the event. Missing or invalid signature evidence fails closed, performs no
  run, artifact, or ledger transition, and emits only redacted diagnostics.
- The verified provider event identity must be recorded under a durable unique key before
  acknowledgement. Duplicate delivery or replay returns the existing idempotent result and cannot
  duplicate provider submission, artifact acceptance, or money movement.
- Provider events may append normalized evidence but cannot move terminal state backward. An
  ambiguous or unverified event enters reconciliation rather than blind retry.
- Webhook registration and signing material are `MISSING (operator input)`. Registration must occur
  only after the isolated Worker target exists, TLS routing is verified, and the signing secret is
  installed through Wrangler secret storage.

## 4. PRICE + RETENTION ENABLE GATES

No route below is enabled for real spend. A catalog label, previously observed price, credential,
or successful sandbox call cannot close an enable gate.

| Launch route        | Intended use                           | Live-page price confirmation                                                                                                                        | Retention/DPA clearance                                                                                                             | Gate state | Real spend |
| ------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- |
| `flux-2-pro`        | Three master statics                   | `MISSING (operator input)` — record current official live-page price, source URL, retrieval time, billable unit, and exact pinned provider endpoint | Catalog fal retention rules remain binding; accepted output must be copied server-side to private R2                                | `OPEN`     | `BLOCKED`  |
| `flux-kontext-pro`  | Nine adaptations/reframes              | `MISSING (operator input)` — record current official live-page price, source URL, retrieval time, billable unit, and exact pinned provider endpoint | Catalog fal retention rules remain binding; accepted output must be copied server-side to private R2                                | `OPEN`     | `BLOCKED`  |
| `seedance-1.0-lite` | Default 6–10 second 9:16 motion branch | `MISSING (operator input)` — record current official live-page price, source URL, retrieval time, billable unit, and exact pinned provider endpoint | Use Seedance 1.0 Lite only; catalog fal retention rules remain binding and accepted output must be copied server-side to private R2 | `OPEN`     | `BLOCKED`  |
| `kimi-k2.6`         | Planning and ad copy                   | `MISSING (operator input)` — resolve the official-price discrepancy and record the exact pinned model ID and current official price                 | `MISSING (operator input)` — no-train retention/DPA clearance for client brand data is required                                     | `OPEN`     | `BLOCKED`  |

Price confirmation closes only the price portion of a route's gate. Moonshot remains disabled until
both exact official price and retention/DPA evidence are accepted. Provider/model/price drift after
enable disables new quotes until reviewed.

## 5. READINESS VERDICT

**PARTIALLY READY as of 2026-07-27 — infrastructure targets provisioned; staging provider and
Supabase server credentials are installed; enable gates and fal webhook JWKS alignment remain
open.** Section 6 records infrastructure evidence; section 2 records credential name-presence.
Ordered items 7, 9, and 10 remain open for real spend; no real spend path is enabled
(`PROVIDER_RUNS_ENABLED` remains false/absent).

Exact ordered operator-input list:

1. Create and name the isolated staging Supabase project; record its actual project ID, confirmed
   region, CLI migration capability, forced-RLS capability, and sanitized dedicated pooled-role
   checks.
2. ~~Supply the environment-scoped staging Supabase service-role and preview/staging publishable keys
   through their authorized server-only and web-public stores.~~ **DONE 2026-07-27** — Worker
   secrets `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_SECRET_KEY` via Supabase CLI; publishable is a
   public staging Wrangler var. **Verified 2026-07-27 against staging REST:** only the modern
   `SUPABASE_SECRET_KEY` (`sb_secret_*`) authorizes the machine-only
   `claim_provider_webhook_event` RPC (HTTP 200); the legacy service-role JWT is refused with HTTP
   401 / SQLSTATE 42501 `permission denied for function`. The privileged webhook path therefore
   selects `SUPABASE_SECRET_KEY` first, and a rejected credential now fails non-retryably so a
   misconfiguration surfaces instead of causing unbounded provider redelivery. Status codes only
   were recorded; no key value was printed or stored.
3. Supply Vercel deploy authentication through the operator CLI/browser flow and prove the approved
   identity/team with a value-free `whoami` result.
4. Create or link the isolated Vercel project for `apps/web`; record project name, team, preview and
   staging environment scopes, deployment identifier shape, and rollback target.
5. In Cloudflare account `d2897bdebfa128919bd89b265e6a712e`, create only the new proposed
   `mustbeviral-core-staging` Worker target; record its actual identifier and reconcile the staging
   Wrangler configuration in a later authorized commit before deployment.
6. In the same account, create only the new private
   `mustbeviral-core-staging-artifacts` R2 bucket; record the exact binding, private-access proof,
   inventory/recovery procedure, and config reconciliation needed before use.
7. Confirm on official live pages the current price, billable unit, and exact pinned endpoint for
   `flux-2-pro`, `flux-kontext-pro`, and `seedance-1.0-lite`; attach retrieval timestamps and keep
   every route disabled until accepted.
8. ~~Supply the fal API key through the authorized operator channel and install it only in ignored
   local Core storage and the isolated staging Worker secret store.~~ **DONE 2026-07-27** —
   staging secret `FAL_KEY` + ignored `apps/core/.dev.vars` (names only).
9. ~~Align fal webhook verification with fal’s current JWKS model~~ **DONE 2026-07-27** for Core
   verifier (JWKS Ed25519). Register per-request `webhook_url` /
   `https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev/v1/webhooks/fal` only after
   provider dispatch is enabled; full durable ingest still fail-closed until start_run wiring.
10. Confirm the exact official `kimi-k2.6` price/model ID and obtain accepted no-train
    retention/DPA clearance for client brand data; the retention gate remains `OPEN` until both are
    recorded.
11. ~~Supply the Moonshot API key through the authorized operator channel and install it only in
    ignored local Core storage and the isolated staging Worker secret store after the enable gates
    close.~~ **DONE 2026-07-27 for material install** — staging secret `MOONSHOT_API_KEY` + ignored
    `apps/core/.dev.vars` (names only). Route remains disabled until item 10 closes.

Cloudflare deploy authentication is not on the missing-input list because it is recorded as
`PRESENT-VIA-OPERATOR-CLI`; its approved account identity must still be revalidated before any
later mutation. No destructive teardown is authorized by this evidence. If an isolated resource
cannot be safely removed with exact identifiers and rollback evidence, leave it disabled and
documented.

## 6. PROVISIONING EXECUTION RECORD (2026-07-20)

Operator authorized provisioning in-session (explicit $10/month Supabase cost confirmation
recorded through the management-API confirmation flow). All values below are public identifiers;
no credential value was read, printed, or stored by the agent.

| Target                                | Actual identifier                                                                                                                                                                            | State            | Sanitized proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staging Supabase project              | `mustbeviral-staging`, project ref `lqvigvzqumpwfjikcvws`, region `us-east-1`, Postgres 17.6                                                                                                 | `ACTIVE_HEALTHY` | All four repository migrations applied via the management API in order (`cleanroom_bootstrap`, `p0_authoritative_schema`, `p0_invariants_rls_and_grants`, `p0_hardened_rpcs`). Catalog verification: 5 hardened RPCs present, 23 public tables, forced RLS on all 19 tenant tables, 29 policies, 37 triggers. A transcription defect in `start_run_barrier` (`p_expexpected_revision_id`) was detected by post-apply catalog inspection and corrected with the exact repository text; zero occurrences remain.                                                                                                                                                          |
| Vercel project for `apps/web`         | Project `mustbeviral-web-staging` (`prj_SVRV9Oh6J3lAi3muIbK9Mrtkvv6V`), team `ashrunscode-projects` (`team_A11dbY2xnTWzGL63IRBTWmLo`)                                                        | Deployed         | `vercel whoami` verified identity `ashrunscode`. Production deployment `Ready` at `https://mustbeviral-web-staging.vercel.app`; live smoke returned 200 with the signed-out gate ("Sign in to open your studio") rendered against the staging Supabase target. Monorepo deploys use the CLI with a local ignored builds config (`@vercel/next` on `apps/web`, corepack-enabled pnpm 10) because the local Windows prebuilt path cannot create symlinks; rollback target is the previous `Ready` deployment. Public browser configuration is versioned in `apps/web/.env.production` (Supabase URL, `sb_publishable_*` key, Core API URL — all client-public by design). |
| Cloudflare Core Worker staging target | `mustbeviral-v2-staging-core` in account `d2897bdebfa128919bd89b265e6a712e`; version `612c321d-8950-4685-984f-0c00cf41f6b8`; `https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev` | Deployed         | Deployed through the repository-pinned Wrangler from `apps/core` with `--env staging`. Name reconciliation resolved in favor of the scaffold name declared in `apps/core/wrangler.jsonc` (this section supersedes the earlier proposed `mustbeviral-core-staging`). Live smoke: `/health` 200 with service identity; unauthenticated and invalid-bearer requests to `/v1` and `/mcp` return safe `UNAUTHENTICATED` 401 envelopes; unknown routes return the safe `NOT_FOUND` envelope. Only new `mustbeviral-*` resources were touched in the shared account.                                                                                                           |
| Private R2 artifact bucket            | `mustbeviral-v2-staging-media`, bound as `MEDIA_BUCKET`                                                                                                                                      | Created, private | Created via Wrangler (default private access; no public development URL enabled, no custom domain attached). Name reconciliation as above (supersedes proposed `mustbeviral-core-staging-artifacts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Configuration reconciliation in the same change: the staging Wrangler environment drops the
placeholder Hyperdrive binding (Data API/RPC remains the accepted baseline until the G1–G6
benchmark passes), enables the `workers.dev` subdomain until the product zone lands in the
account, and pins the public `SUPABASE_URL`/`SUPABASE_JWT_AUDIENCE`/`APP_ENV` vars. The
`api-staging.mustbeviral.com` webhook endpoint shape in section 3 will follow the zone; until
then the deployed `workers.dev` hostname is the staging endpoint.

Remaining operator inputs after 2026-07-27 credential install: live-page price confirmations for
the three fal routes (item 7); fal webhook material / Core JWKS verifier alignment (item 9 —
fal no longer ships a shareable HMAC secret); `kimi-k2.6` price/retention/DPA clearance
(item 10). Items 2, 8, and 11 (Supabase service/secret keys, fal API key, Moonshot API key) are
installed on staging Worker `mustbeviral-v2-staging-core` and ignored local `apps/core/.dev.vars`
as names-only evidence. Every provider route stays disabled and fail-closed
(`PROVIDER_RUNS_ENABLED` is not set true). Production Worker
`mustbeviral-v2-production-core` does not exist yet; no production Supabase project exists.
