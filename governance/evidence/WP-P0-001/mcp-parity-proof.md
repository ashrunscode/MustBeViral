# The exact five private MCP operations have REST-semantic parity

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-11

## 1. Claim and execution boundary

The staging Core Worker exposed exactly five authenticated MCP tools and all five were exercised
through the official MCP Inspector plus two distinct official SDK clients. Fourteen committed
contract vectors compare the resulting MCP envelopes with the real REST route envelopes over the
same shared handler graph. The proof completed at 2026-08-11 14:49:50.845 UTC.

The proof-bearing disposable staging resources were:

| Field              | Identifier                             |
| ------------------ | -------------------------------------- |
| User               | `2f6bfbd9-9b6c-410f-beaa-28ba32e07cf1` |
| Workspace          | `3b57132f-8f06-4e2c-89e3-a82338b1d639` |
| Project            | `a423d4f1-0415-5c5f-90a0-fc6d6a9e5da6` |
| Primary canvas     | `dd75aedc-430e-418b-bc10-22b100a5672e` |
| Free quote         | `4099656b-b3e0-428b-9c3d-eb2ded902c4c` |
| Prior terminal run | `44b3197f-7119-4724-954a-ce9308090ef8` |

The Worker health response was `service=mustbeviral-core`,
`generation=viralgraph-cleanroom-v2`, `status=ok`. The harness credited 0 micros, created no run
row, submitted no valid confirmation token, and made no provider submission. It made twelve
`start_run` refusal calls across REST and the three MCP clients: confirmed omitted, invalid token,
and expired quote. Every call stopped before reservation and provider execution.

## 2. Inspector and client identities

| Driver                      | Version  | How it was exercised                                               |
| --------------------------- | -------- | ------------------------------------------------------------------ |
| Official MCP Inspector CLI  | `2.1.0`  | Inspector launcher in `--cli`, Streamable HTTP mode                |
| Official TypeScript MCP SDK | `1.30.0` | `Client` plus `StreamableHTTPClientTransport` under Node `24.18.0` |
| Official Python MCP SDK     | `1.29.0` | `mcp.client.streamable_http` through pinned `uv 0.9.24`            |

All three connected to the Worker's staging `/mcp` endpoint with a disposable Supabase session
JWT. The Inspector and TypeScript versions are exact repository dependencies; the Python client is
installed into an isolated `uv run --no-project --with mcp==1.29.0` environment on every execution.
No global unpinned MCP client was substituted.

On Windows, Inspector prints a valid `isError: true` tool result and normally exits 5. Its launcher
can then hit a libuv shutdown assertion. The harness accepts a nonzero Inspector process exit only
when stdout already parsed as a valid MCP result with `isError: true`; an abnormal exit without that
result remains fatal. The regression test pins this fail-closed behavior.

## 3. `tools/list` exposes no broader P0 surface

Authenticated `tools/list` returned the same ordered names through all three clients:

1. `get_canvas_context`
2. `apply_canvas_patch`
3. `quote_run`
4. `start_run`
5. `get_run`

The count was exactly five. No sixth tool, resource, prompt, paid helper, administrative operation,
or legacy-v1 operation appeared. A direct unauthenticated discovery request returned HTTP 401 with
the safe `UNAUTHENTICATED` envelope, and all three clients refused unauthenticated discovery.

## 4. Vector-by-vector REST parity

Except for the four independent patch-success identifiers described below, every row produced one
identical redacted SHA-256 semantic fingerprint across REST, Inspector, TypeScript, and Python.
`request_id` is intentionally normalized before comparison; error code, message, retryability, safe
details, and operation data are not normalized away.

| Vector                              | Operation            | Environment | REST result             | Inspector / TS / Python result | Verdict |
| ----------------------------------- | -------------------- | ----------- | ----------------------- | ------------------------------ | ------- |
| Canvas read success                 | `get_canvas_context` | staging     | HTTP 200                | same success envelope          | pass    |
| Patch success                       | `apply_canvas_patch` | staging     | HTTP 200                | same success shape             | pass    |
| Quote success and replay            | `quote_run`          | staging     | HTTP 200                | same quote replay              | pass    |
| Validation failure                  | `apply_canvas_patch` | staging     | `VALIDATION_FAILED`     | same safe error                | pass    |
| Revision conflict                   | `apply_canvas_patch` | staging     | `REVISION_CONFLICT`     | same actual head and error     | pass    |
| Explicit confirmation omitted       | `start_run`          | staging     | `VALIDATION_FAILED`     | same safe error                | pass    |
| Invalid confirmation token          | `start_run`          | staging     | `FORBIDDEN`             | same safe error                | pass    |
| Cross-tenant authorization failure  | `get_run`            | staging     | `FORBIDDEN`             | same tenant-safe error         | pass    |
| Terminal run read                   | `get_run`            | staging     | HTTP 200                | same run and node states       | pass    |
| Quote expiry                        | `start_run`          | staging     | `QUOTE_EXPIRED`         | same expiry details            | pass    |
| Rate limit                          | `get_run`            | exact route | `RATE_LIMITED`          | same retryable error           | pass    |
| Provider ambiguity                  | `start_run`          | exact route | `PROVIDER_AMBIGUOUS`    | same recovery state            | pass    |
| Thrown internal error               | `get_run`            | exact route | opaque `INTERNAL_ERROR` | same opaque error              | pass    |
| Valid confirmation, dry-run success | `start_run`          | exact route | HTTP 201                | same queued-run shape          | pass    |

For patch success, REST and each MCP client applied the registered `GB-01` graph exactly once to an
equivalent fresh disposable canvas. Canvas and revision IDs therefore differ by design. All four
responses had the exact success schema, the same empty affected-descendant set, and canonical hash
`773add0f163d02ce4a0010f93d450a46b58008349f92f9e807a1cd976785c520`.

The free quote replay used one idempotency key across REST and all MCP clients. Every response
returned quote `4099656b-b3e0-428b-9c3d-eb2ded902c4c`, maximum charge 4,550,000 micros, the same
expiry, and the same semantic fingerprint. The confirmation token was parsed to validate the
contract, then redacted; it was never recorded or submitted.

The terminal `get_run` success read the pre-existing disposable golden run through every customer
transport. All four returned `succeeded` with 16 succeeded nodes. The owner/run relationship was
bounded through privileged PostgREST RPC `get_run_execution_audit` at
2026-08-11 14:49:27.847788 UTC before the customer-path reads.

## 5. Safe fixture vectors and the paid boundary

The rate-limit, provider-ambiguity, internal-error, and valid-confirmation-success states cannot be
induced safely and deterministically on staging in this task:

- the staging Worker has no deterministic rate-limit trigger, so flooding it would not be a bounded
  parity test;
- creating a real provider-ambiguous acceptance or submitting a valid confirmation token would
  violate the no-spend boundary.

Those four rows therefore run the exact `createCoreApp` REST and MCP routes over one deterministic
local handler fixture. Inspector and both real SDK clients still connect over Streamable HTTP; the
fixture changes only the shared handler result needed to select the otherwise unreachable semantic
branch. It proves the adapters emit identical REST/MCP taxonomy and safe envelopes, not that a live
rate limit or ambiguous provider event occurred.

The live paid boundary is separately proven on staging. An unexpired quote with `confirmed: true`
and an invalid token returned `FORBIDDEN` identically over REST and all clients. A request with
`confirmed` omitted returned `VALIDATION_FAILED`, and the prior expired quote returned
`QUOTE_EXPIRED` before token verification. The valid-token success shape was fixture-only. No
staging run row, reservation, capture, release, or provider attempt was created.

## 6. Repeatable capture and redaction

The repeatable command is:

```text
corepack.cmd pnpm --filter @mustbeviral/core mcp:parity:staging
```

`apps/core/tools/mcp-parity-staging.ts` drives REST and all three MCP clients, validates every
envelope against the operation-specific Zod response schema, compares normalized semantic
fingerprints, and writes
`governance/evidence/WP-P0-001/mcp-parity-vectors.json`. That machine-readable file contains the
redacted request and response excerpt for every client on every vector, transport status, semantic
fingerprint, safe identifiers, tools/list results, and the paid-path boundary counters.

Bearer credentials, Supabase keys, confirmation tokens, private object keys, signed URLs, customer
media, and provider payloads are absent. The harness passes process arguments without shell
interpolation; the Python helper receives its ephemeral token only through process environment and
redacts failure output.

## 7. Packet status and staging residue

The packet acceptance entry `private-mcp-rest-semantic-parity` is passed with this document and the
machine-readable vector capture as evidence. This is cross-step p0-006 evidence only:
`p0-005-golden-launch-pack-runs` remains the current step and
`p0-006-private-mcp-proof` remains pending in the step ledger until p0-005's completion criterion is
resolved. No forced transition, migration, Worker deploy, production mutation, legacy-v1 touch, or
remote destructive action occurred.

The final proof invocation created only the disposable resources in section 1. Four auth-only client
reconnaissance identities and five earlier no-spend harness-development identities were also left
isolated in staging because destructive cleanup was not authorized:

- auth-only: `18244e7f-82a8-44a0-b6dc-c16163c39569`,
  `5418f0cb-75f8-41ad-991c-6b0850726bf0`, `5732ae8a-0e3e-4a19-bb9d-cba5cad86249`, and
  `3210d914-86eb-484b-bddd-a6f9b32ae449`;
- no-spend harness iterations: `f01a370b-e2b1-415b-a9e5-6480cac2e923`,
  `3b3cf677-ebbc-4d4b-ba32-04e90523c5f2`, `cf1a22dc-b687-4956-9010-fdaf1ab0d9ef`,
  `782bac8e-7475-4969-86ab-d9f1e2f56584`, and `45d82bcd-f9ad-426a-a40d-9c67ba85e491`.

None received wallet credit or submitted a paid run. Their existence is staging test residue, not a
qualified evaluator session, product user, or acceptance sample.

## 8. Left open

- A valid confirmation token has not been submitted against staging. The next paid remediation run
  remains operator-gated and must not be inferred from the fixture success vector.
- Live rate-limit and provider-ambiguity state induction remains intentionally unperformed; only the
  shared route/handler envelope parity for those branches is claimed.
- The p0-006 step-ledger transition remains blocked on completion of current step p0-005, even though
  this acceptance criterion is now evidenced.
