# W1 studio and brand foundation evidence

Scope: W1.1 and the W1.2 backend foundation, WP-PLATFORM-W1-001, existing `codex/viralgraph-cleanroom` checkout.

## Implemented

- Nine normalized portfolio tables with forced RLS, immutable identities, explicit action grants,
  archived references and recorded owner/workspace/project mappings. Workspaces retain tenant and
  ledger ownership. Owner revocation durably revokes grants; restoring membership cannot revive them.
- Twenty-one operations in the shared Zod registry drive REST routes, typed clients, CLI commands,
  MCP tools and OpenAPI. Hardened Postgres commands recheck current authority before idempotent
  replay. Queries use native caller RLS and bounded timestamp/UUID cursors bound to actor and query.
- Original user JWT reaches Supabase. No service-key fallback is used by platform commands. Existing
  scoped programmatic credentials do not implicitly gain portfolio access.
- `node packages/db/scripts/verify-platform-connected.mjs` creates a uniquely named local database,
  copies schema only with original owners/permissions, exercises synthetic records over separate
  connections, then removes only that run's temporary database. The primary local volume is preserved.
- Local type generation resolves credentials from the inspected MustBeViral container so a
  machine-wide Supabase password cannot redirect local generation to another project's credentials.

## Locally verified

- 40 real Supabase pgTAP suites: **561 assertions passed**, including 67 new identity/operation cases.
  Existing foreign-key index coverage initially caught 11 omissions; the additive index migration
  fixes them without changing the required test.
- Seven connected journeys passed: WashBodega/UnPile reconnect; grant revoke during a waiting edit;
  studio membership revoke during a waiting edit; workspace owner revoke during a waiting edit;
  simultaneous slug collision; simultaneous idempotent replay; old application plus repeated
  project-to-brand backfill with unchanged funded ledger rows, balance and wallet amount.
- 20 shared validation/handler tests and 81 Core transport/port/MCP tests passed. These cover all 21
  operations across REST, CLI and MCP, safe errors, JWT forwarding, missing idempotency, bad pagination,
  forged IDs, stale revisions, archived records and revoked replay.
- Every previous OpenAPI path (28) and schema (47) is semantically unchanged. Added schemas/routes
  are generated. Database types include the installed additive schema and previously missing
  baseline generated entries.
- Local baseline inventory before W1 had zero workspaces, projects, kits, artifacts, runs and ledger
  rows. Backfill never inferred ownership or touched external tenant data. Synthetic acceptance uses
  the explicit WashBodega and UnPile identities selected by the owner.

Full agent verification passed: 143 governance tests, 984 unit tests, 26 integration tests, all 18 builds, lint, strict types, formatting, generated contracts and security checks. The design check also passed. Evidence levels and source hashes are recorded in local-verification-2026-09-10.json.
Raw local verification output is retained under `.git/mbv-wave1-*.log` and is not a second status file.

## Connected staging verified

Not run for W1. No staging migrations, account connections or publication occurred.

## Authorized production verified

Not run for W1. Production observation/traffic, live publication, provider spending and customer
charging retain their separate release obligations and exact-resource authorization requirements.

The ready W1 successor implements saved onboarding, approved UI navigation, invitations/settings
and actual billing reads. W2–W12 and the full operating pilot remain unfinished.
