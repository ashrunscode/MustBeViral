# W0 local database recovery and acceptance

Evidence level: **locally verified against real PostgreSQL**. This is not connected staging or production verification. Continue from `4e03c26` on `codex/viralgraph-cleanroom`, one existing checkout.

## Recovery

Docker Engine 29.7.2 was already running when this continuation began. No socket removal, Desktop reset, volume deletion, WSL change or unrelated-container mutation was performed. The previous automatic rejection remains historical evidence; this continuation did not retry it.

The existing `supabase_db_mustbeviral` volume has matching MustBeViral labels. The pinned Supabase CLI 2.109.1 successfully started its local stack after downloading required images, using Postgres image `public.ecr.aws/supabase/postgres:17.6.1.166` and the preserved volume. The database became healthy on the configured local port 54322. Startup credentials were kept out of evidence and tool output.

`pnpm exec supabase migration list --local` showed 27 applied and 13 pending migrations. `pnpm exec supabase migration up --local` applied those 13 in order, from `20260811114946` through `20260910000000`. No remote or linked migration command was used; no database reset was needed.

## Reproduced failures and corrections

The first full database run executed all 38 files and failed in two suites. The Stripe subscription audit identity repair passed, including event replay, workspace identity and cross-workspace event rejection.

- OAuth: the existing accepted grants allow an owner to SELECT rows under RLS. The September 9 test/evidence incorrectly described the entire table as unreadable; that expectation is corrected. The suite checks the permitted owner read and denies an actor without membership. Revocation uses the token identifier returned by the issuing RPC without selecting credential hashes. A separate assertion proves the service role cannot insert a token directly. An expired-token fixture is seeded only as the test administrator, then verification runs as service_role. Production privileges are unchanged.
- Collaboration: the authenticated owner correctly receives `42501` before an attempted revision UPDATE can reach its immutability trigger. The suite now verifies this denial, then separately verifies `55000:canvas_revisions_IMMUTABLE` under the privileged test role and reads back unchanged checkpoint content. Existing stale-head, parent and child-history checks remain.

Second `corepack pnpm supabase:test`: **exit 0, Files=38, Tests=494, Result: PASS**. Test files wrap their fixtures in transactions with rollback. `database-baseline-2026-09-10.json` records source hashes and the result. These tests exercise actual database grants, RLS, RPCs, audit, ledger and immutable revision behavior; browser fixtures are not used as substitutes.

The prior database blocker is resolved. Final `corepack pnpm agent:verify` passed: 143 governance tests, 925 unit tests, 26 integration tests, 18 build tasks, lint/typecheck, design checks, generated contracts/docs and all 17 prior transition receipts. Valid Turbo cache entries were reused. This is separate from the real Postgres 38-file/494-assertion result above. The prepared W1 foundation successor and explicitly approved WashBodega/UnPile design remain unchanged. The accepted quality journey and roadmap now name UnPile consistently without claiming an unrelated-industry pilot. Resource-aware routing and actual billing reads are W1 outcomes, not claims of this baseline repair.

Rollback preserves the volume, all migration history and existing data. Application compatibility is unchanged by these additional test corrections; the Stripe repair retains its existing function signature. No production execution authority is added.

After the UnPile journey wording was reconciled, both targeted roadmap/acceptance governance tests passed, including preservation of all 65 units, all five journeys, broader category coverage and pending production obligations. Formatting and lint passed for the updated test; final governance/generated checks also passed.
