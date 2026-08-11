# Response contracts, sign-in, and the typed client are ready for T4

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs

Recorded 2026-08-11

## 1. What this proves

T3 closes the three prerequisites that previously prevented the web product from leaving fixtures:
operation-specific response contracts, a production Supabase sign-in surface, and one typed client
that can be used from both server and client components. This task made no provider call, moved no
money, and mutated no staging, production, or legacy-v1 resource.

The 18-operation count is the authenticated customer surface. The complete Worker surface also has
the signed fal webhook, so the generated document contains 19 P0 operations plus health rather than
silently omitting the provider route.

## 2. Response contracts and OpenAPI are generated from Zod

`packages/contracts/src/responses.ts` declares an operation-specific success-data schema and a
discriminated `data`/`error` response envelope for each authenticated operation. The signed webhook
is also typed for full Worker parity. Handler-native schemas retain bigint money while the wire
quote schemas require the decimal strings produced by the Worker's JSON boundary.

The command response schemas are compile-time compatible with every hand-written result union in
`handlers.ts`. Runtime vectors cover every operation's success envelope, the common error envelope,
strict drift rejection, revision conflicts, graph-invalid errors, and the exact billing cap shape:
`run`, `workspace_day`, or `global_day`, with cap, current, requested, and projected micros. The live
T2 behavior remains authoritative for approval, export, and receipt shapes.

`governance/scripts/generate-openapi.ts` now runs inside the existing `docs:generate` pipeline. It
emits Prettier-stable OpenAPI 3.1 with:

- 20 paths: health plus all 19 Worker routes;
- 18 bearer-JWT operations and the separately signed fal webhook;
- operation-specific request and success components;
- path, `X-Request-Id`, and required mutation `Idempotency-Key` parameters; and
- the shared typed error envelope on every operation.

`generated:check` regenerates and compares this source, so hand-editing either the JSON document or
the Markdown reference now fails the governed lane.

## 3. The production sign-in surface uses the existing SSR boundary

`/login` uses the supported Supabase SSR client and `signInWithPassword`. Protected `/studio`
requests without a verified claim are redirected by `proxy.ts` to `/login?next=...`; the target is
restricted to same-origin Studio paths before the server action redirects back. The fallback
session boundary now redirects to `/login` as well.

The surface includes loading, invalid-credential, verification-required, rate-limited, expired-link,
unexpected-provider, signed-in, and signed-out presentations. Messages do not expose credentials or
raw provider responses. Sign-out is a server action scoped to the local browser session and reports
failure without pretending that the session ended.

The `MBV_LOCAL_GOLDEN_PREVIEW=1` behavior is unchanged: its existing
`NODE_ENV !== 'production'` return still precedes session lookup and redirect logic. No element in
the seven approved Studio screens changed, so the golden fixtures remain pixel-identical.

## 4. One typed client owns the REST transport

`createMustBeViralRestClient` accepts an async Supabase access-token provider and wraps `fetch` for
all 18 authenticated operations. Its generic request type requires each operation's path identifier
and body, requires `Idempotency-Key` only for real mutations, supplies `Authorization: Bearer` and
`X-Request-Id`, URL-encodes identifiers, and parses both success and error responses through the
operation's Zod schema. Missing sessions and invalid/non-JSON responses fail closed as typed client
errors.

The web package now exposes separate browser and server factories using the declared
`NEXT_PUBLIC_CORE_API_URL`. The server factory verifies claims before reading the session token; the
browser factory reads the current browser session. Neither factory is connected to a golden screen
in T3—that replacement sequence is T4.

## 5. Verification and boundaries

- `corepack.cmd pnpm agent:preflight` — pass before implementation.
- Contracts typecheck — pass; contracts unit lane — 6 files, 17 tests; contracts integration lane —
  1 file, 2 tests.
- Web typecheck — pass; web unit lane — 14 files, 64 tests; production build — pass with `/login`
  emitted as a dynamic SSR route.
- Core typecheck — pass; the unchanged Core unit lane — 21 files, 170 tests.
- The exact tracked T3 candidate passed Prettier, governance, governance tests, security, task graph,
  governance lint, all workspace lint, typecheck, unit, integration, and build gates.
- A literal `corepack.cmd pnpm verify` in the shared checkout stops before those gates because
  Prettier also scans the operator-owned untracked
  `apps/core/tools/approve-export-august-pack.ts`. The task expressly forbids touching that file.
  It remained byte-for-byte untouched; the candidate-only Prettier check passed, and every remaining
  command from `verify` passed without weakening a check.
- No secret, token, signed URL, customer media, or raw authentication response is recorded here.

## 6. Left open

- T4 must replace the seven fixture ports with the authenticated typed client in canvas-read,
  patch/validate, quote, run start/poll, approval, export, and receipt order. Provider spend remains
  disabled until the explicit quote/run boundary.
- Self-service sign-up and account enrollment are not enabled for the P0 invite-only evaluator
  cohort; this sign-in surface accepts operator-provisioned Supabase accounts.
- Signed artifact upload remains fail-closed in the Worker until its private exact-key signing path
  is implemented; T3 declares its response contract but does not invent a live caller.
- The operator-owned untracked `apps/core/tools/approve-export-august-pack.ts` remains untouched for
  operator disposition.
