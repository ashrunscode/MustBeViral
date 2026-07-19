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

| Credential or auth path                                                   | Readiness                                                                                             | Authorized storage location                                                                                                                                                                                                            | Rotation owner               | Value-free verification                                                                                                                                      |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| fal API key for `flux-2-pro`, `flux-kontext-pro`, and `seedance-1.0-lite` | `MISSING (operator input)`; all routes disabled until their price gates close                         | Local only: ignored `apps/core/.dev.vars`. Staging: Wrangler secret on the isolated Core staging Worker. Never Vercel browser environment or Git.                                                                                      | Provider operations owner    | After target/config reconciliation: `pnpm exec wrangler secret list --config apps/core/wrangler.jsonc --env staging`; confirm the expected secret name only. |
| fal webhook signing secret                                                | `MISSING (operator input)`                                                                            | Local only: ignored `apps/core/.dev.vars`. Staging: Wrangler secret on the isolated Core staging Worker. Never logs, fixtures, request evidence, or Git.                                                                               | Provider operations owner    | After target/config reconciliation: `pnpm exec wrangler secret list --config apps/core/wrangler.jsonc --env staging`; confirm the expected secret name only. |
| Moonshot API key for `kimi-k2.6`                                          | `MISSING (operator input)`; retention/DPA gate is `OPEN` and the route is disabled                    | Local only: ignored `apps/core/.dev.vars`. Staging: Wrangler secret on the isolated Core staging Worker. Never Vercel browser environment or Git.                                                                                      | AI provider governance owner | After target/config reconciliation: `pnpm exec wrangler secret list --config apps/core/wrangler.jsonc --env staging`; confirm the expected secret name only. |
| Supabase service-role key, staging                                        | `MISSING (operator input)`                                                                            | Local Core only when explicitly needed: ignored `apps/core/.dev.vars`. Staging server-only use: Wrangler secret on the isolated Core staging Worker. It is prohibited from `apps/web`, browser bundles, and public Vercel environment. | Data/platform operator       | `pnpm exec wrangler secret list --config apps/core/wrangler.jsonc --env staging`; confirm the expected server-only secret name only.                         |
| Supabase publishable key, preview and staging                             | `MISSING (operator input)`                                                                            | Local web: ignored `apps/web/.env.local`. Preview and staging: environment-scoped Vercel environment settings for `apps/web`. Never substitute a production-project value.                                                             | Data/platform operator       | After Vercel project linkage: `pnpm exec vercel env ls`; confirm the variable name and intended environment scopes only.                                     |
| Vercel deploy authentication                                              | `MISSING (operator input)`                                                                            | Operator CLI/browser credential store only. Do not copy deploy authentication into application runtime variables, Markdown, shell history, or Git.                                                                                     | Web platform operator        | `pnpm exec vercel whoami`; record only the operator-approved identity/team result.                                                                           |
| Cloudflare deploy authentication                                          | `PRESENT-VIA-OPERATOR-CLI` from established repository history; revalidation required before mutation | Operator Wrangler authentication store only. Do not copy deploy authentication into `.dev.vars`, Vercel, Markdown, shell history, or Git.                                                                                              | Edge platform operator       | `pnpm exec wrangler whoami`; verify the approved account identifier without printing auth material.                                                          |

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

**NOT READY.** The checklist accurately completes packet step
`p0-000-environment-provisioning`, but it does not claim provisioning completion. Later commits
must replace missing states only with sanitized proof from the actual isolated targets.

Exact ordered operator-input list:

1. Create and name the isolated staging Supabase project; record its actual project ID, confirmed
   region, CLI migration capability, forced-RLS capability, and sanitized dedicated pooled-role
   checks.
2. Supply the environment-scoped staging Supabase service-role and preview/staging publishable keys
   through their authorized server-only and web-public stores.
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
8. Supply the fal API key through the authorized operator channel and install it only in ignored
   local Core storage and the isolated staging Worker secret store.
9. Supply the fal webhook signing secret, install it only in the staging Worker secret store, and
   register the staging webhook only after endpoint, TLS, signature, and replay-protection smoke
   evidence exists.
10. Confirm the exact official `kimi-k2.6` price/model ID and obtain accepted no-train
    retention/DPA clearance for client brand data; the retention gate remains `OPEN` until both are
    recorded.
11. Supply the Moonshot API key through the authorized operator channel and install it only in
    ignored local Core storage and the isolated staging Worker secret store after the enable gates
    close.

Cloudflare deploy authentication is not on the missing-input list because it is recorded as
`PRESENT-VIA-OPERATOR-CLI`; its approved account identity must still be revalidated before any
later mutation. No destructive teardown is authorized by this evidence. If an isolated resource
cannot be safely removed with exact identifiers and rollback evidence, leave it disabled and
documented.
