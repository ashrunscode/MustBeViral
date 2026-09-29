# The seven golden screens now use the authenticated Worker client

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-11

## 1. The ports were replaced in money-safety order

The production paths for all seven locked screens now use the T3 typed REST client with the active
Supabase session JWT. The dev-only `MBV_LOCAL_GOLDEN_PREVIEW=1` transport remains available to the
golden and performance suites only when `NODE_ENV !== 'production'`; the production page boundary
selects the Worker ports. Each increment was verified, committed and pushed before the next began.

| Order | Screen boundary        | Authenticated behavior                                                                                                                           | Commit    |
| ----: | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
|     1 | Canvas read            | `GET /v1/canvases/:id` maps the authoritative revision, graph, catalog and loading/forbidden/not-found/error states                              | `b93b50e` |
|     2 | Canvas mutation        | validate precedes a full-snapshot patch carrying `expected_revision_id`; `REVISION_CONFLICT` returns the actual revision                         | `f0dcfd9` |
|     3 | Quote                  | `POST /v1/canvases/:id/quotes` supplies the immutable maximum, expiry, line items, confirmation token and cap snapshot                           | `1fc3e5d` |
|     4 | Run start and progress | `POST /v1/quotes/:id/runs` uses the server token and a stable idempotency key; `GET /v1/runs/:id` polls to a terminal state                      | `e2d0769` |
|     5 | Review and approval    | receipt artifacts drive review and compare mode; approval carries selected artifact IDs, accessibility descriptions and a stable idempotency key | `b06a0e0` |
|     6 | Export and receipt     | explicit export navigation creates the approved-member export once, re-reads the immutable receipt and renders ledger/lineage truth              | `0b9924a` |
|     7 | Brief bootstrap        | the draft stays local while Worker workspace, project and canvas bootstrap returns the real route identifiers                                    | `56a3333` |

The quote screen keeps the locked acknowledgment sentence and names the exact maximum on its
confirmation control. Production confirmation uses the server-minted token; the staging E2E never
clicked it. Error mapping stays discriminated rather than widening responses: graph invalid,
revision conflict, quote expiry, spend-cap rejection, forbidden, not found and retryable transport
errors retain separate UI states.

## 2. Authentication remains fail closed

Every studio page calls `requireStudioSession`. Server components use the SSR Supabase client;
client ports use the browser Supabase client and the same typed REST client. An absent or invalid
session redirects to `/login` with a safe studio-only return path. The browser client sends the JWT
in `Authorization: Bearer`, adds `X-Request-Id`, adds `Idempotency-Key` to mutations and parses the
operation-specific Zod response before returning it to a screen.

A production-browser probe exposed that the staging Worker has no CORS preflight handler: an
`OPTIONS` request from the isolated local origin returned HTTP 404 with no allow-origin, method or
header response. The web app therefore keeps Core as the sole API but reaches it through a fixed
same-origin Next rewrite at `/api/core/*`. The rewrite transparently forwards the typed request to
the configured Worker; it creates no second command handler or data authority. The authenticated
staging canvas read below proves the browser JWT crossed that boundary successfully.

The browser public-environment reader now names each `NEXT_PUBLIC_*` property directly so Next can
statically expose the registered public values. Passing the whole `process.env` object had caused a
production client initialization failure before any Worker request was sent.

## 3. A disposable staging customer proved sign-in and read truth

At `2026-08-11T09:47:10.390Z`, the production-mode Playwright lane created an email-confirmed
disposable staging identity through the Supabase Auth admin REST API without logging its email,
password or service-role credential. It then created only the permitted synthetic workspace,
project, canvas and revision through the typed staging Worker client:

| Field     | Identifier                             |
| --------- | -------------------------------------- |
| Workspace | `50f0b0c4-9302-4aab-8a03-d1953e71d8f7` |
| Project   | `314c25b4-a046-5d91-b715-f9bc2eebe24c` |
| Canvas    | `6690335b-517f-4590-a2ba-c2033014da81` |
| Revision  | `97fd65c8-8765-4488-8400-2a06a8534e1a` |

The browser opened the real `/login` surface, submitted that customer's password, followed the
sanitized redirect back to the canvas, observed HTTP 200 from
`/api/core/v1/canvases/6690335b-517f-4590-a2ba-c2033014da81`, rendered the synthetic
`master-static` node and displayed the exact revision above. The attached test proof recorded
`run_submitted=false`. No confirmation request, provider submission, reservation, capture or spend
occurred.

Three earlier authenticated setup probes also created only allowed disposable Auth/workspace/
project/canvas fixtures while the production-browser environment and CORS boundaries were being
diagnosed. One of those issued one free quote through the rewrite and stopped when the local T4
response parser rejected the pre-T4 staging response; no start-run request followed. A privileged
PostgREST inventory attempt was correctly denied with `42501` because `service_role` has no direct
`SELECT` grant on `public.workspaces`, so no direct-table bypass was improvised.

## 4. The confirmation boundary stayed no-spend

The standard dev-only Playwright lane exercised the locked quote state: the named `$4.20` fixture
price renders, confirmation begins disabled, acknowledgment is required, and the mock transport is
the only transport allowed to cross that boundary. The staging production-mode lane stops after
the authenticated read. The real Worker run-start port is covered by unit and integration tests,
but no staging E2E in T4 invoked it.

The full Playwright lane passed 32 tests with four intentional skips (the staging-only spec in both
projects and the desktop-only performance/stress specs in the mobile project). The unchanged
performance gates also passed: the final 100-node sample measured 56.29 FPS against a 55 FPS
threshold; the 500-node sample measured 51.65 FPS against 30 FPS with 30 mounted nodes and 30.2 ms
selection latency. The lane now uses one browser worker so performance evidence is not distorted by
concurrent visual browsers, and its isolated ignored Next output prevents another dev process from
sharing a build lock. Product thresholds and visual assertions were not relaxed. Regenerated PNGs
and volatile JSON measurements were restored to their committed goldens rather than treated as new
baselines.

## 5. Review, approval, export and receipt are fail closed

Approval sends only selected artifact IDs and explicit accessibility descriptions. Missing
descriptions do not fall back to fabricated copy. Compare mode reads the same authoritative receipt
artifacts. The rejection control remains a local review draft because the accepted P0 REST surface
does not define a reject command; it is not mislabeled as persisted Worker state.

Export is initiated only by explicit `Export approved` navigation and includes approved members.
After creation, the screen re-reads the receipt so the displayed export, reservation, captures,
artifacts and lineage come from Core. The production download control is disabled as `Export
recorded` because the accepted P0 REST surface has no export-byte download operation; no public
object URL, provider delivery URL or invented download endpoint was added.

## 6. Verification

Before each of the seven implementation commits, the exact tracked candidate passed formatting,
governance, security, lint, typecheck, unit, integration and production-build lanes. Core and web
typechecks passed after the E2E/auth additions; Core unit passed 173 tests and web unit passed 91.
The production-mode staging Playwright proof passed one desktop test in 57.9 seconds, including its
production build. The complete dev-only visual/interaction lane passed 32 tests with four expected
skips in 2.6 minutes.

The literal root `pnpm verify` invocation is recorded for every commit candidate. Earlier increments
could not complete its first formatting phase because the operator-owned untracked
`apps/core/tools/approve-export-august-pack.ts` was visible to Prettier and was explicitly outside
T4 authority; every remaining root gate and exact tracked-candidate format check passed. The file
was never edited, formatted, staged or committed by T4.

## 7. Boundaries

- No paid run, provider submission, staging reservation, capture or production mutation occurred.
- Staging mutations were limited to disposable Auth identities, workspaces, projects, canvases,
  revisions and one free quote created during the bounded E2E diagnosis.
- No staging Worker deployment or configuration change was made; the same-origin rewrite is local
  candidate code and the Core Worker remains the sole API authority.
- No legacy-v1 path or data was read or mutated.
- No secret, raw token, signed URL, customer media or provider payload is recorded here.
- The locked screenshots were not updated.

## 8. Left open

- The T4 Core response adds the quote spend-cap snapshot used by the locked screen. Until this
  candidate is deployed after merge, the pre-T4 staging Worker response is version-skewed and a live
  quote cannot pass the new response parser; the staging E2E therefore proves the required sign-in
  and read path and stops before live confirmation.
- Four disposable E2E Auth/workspace/project/canvas fixtures and one free quote remain on staging.
  Removing them is a remote destructive action and was not authorized by T4.
- Rejection remains a local review draft and export-byte download remains unavailable until an
  accepted contract adds those operations; neither state is represented as persisted or complete.
- T5 still owns the 20-brief staging run, its approximately `$13` provider spend and the aggregate
  technical, latency, ledger, lineage and receipt evidence.
