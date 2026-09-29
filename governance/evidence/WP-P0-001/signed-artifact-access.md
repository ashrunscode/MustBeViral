# Signed artifact access: capability tokens, and whether fal will follow one

Work packet: `WP-P0-001`, step `p0-005-golden-launch-pack-runs`. Track B of the completion plan.
Recorded 2026-07-30.

## 1. Why this exists

fal requires a fetchable `image_url` for adaptation and image-to-video, which is 10 of the launch
pack's 16 priced nodes. Nothing in the repository could produce one for a private R2 object, and the
same gap blocked all customer delivery: `GET /v1/artifacts/:id` returned the database row only.

**R2 presigned URLs were rejected.** Presigning requires a bucket-wide R2 credential inside the
Worker. If that credential leaked it would read every tenant's objects for the life of the token,
with no per-fetch authorization hook and no revocation short of rotation — strictly worse than the
prior state, where only the Worker could read R2 at all.

**Chosen instead:** a Worker-mediated HMAC capability. The bucket keeps zero external readers; the
Worker remains the only reader and serves bytes only against a valid capability. The signed payload
is canonical pipe-delimited rather than JSON, so there is no field-reorder ambiguity:

```
v1|purpose|artifactId|objectKey|contentHash|byteSize|mimeType|exp
```

The object key is _inside_ the signature, so exact-object binding is structural: a token minted for
artifact X cannot be replayed to yield object Y. `provider_input` verifies crypto and expiry only,
with no database round trip — a Supabase blip during fal's fetch would otherwise waste the paid
master that produced the input. `customer_download` additionally checks artifact availability and run
state, buying revocability where latency does not matter. TTLs are 3600s and 300s respectively.

`ARTIFACT_ACCESS_SIGNING_KEY` is optional and fail-closed: absent, nothing can be minted or verified,
so no bytes can leave the bucket. `docs/architecture/DATA_AUTH_AND_TENANCY.md` was amended to admit
this as a fourth unauthenticated category rather than letting it in unwritten.

## 2. Zero-spend gate — PASS

Run 2026-07-30 by anonymous `curl`/`fetch` from outside Cloudflare against the already-proven staging
artifact `472bf385-02c8-4abd-a33c-dc6df69f5232`.

The staging `ARTIFACT_ACCESS_SIGNING_KEY` was re-aligned to the local `.dev.vars` value immediately
before this run, because the two had drifted and the deployed Worker refused tokens minted from the
local copy (`401`, logged as `core.artifact_access.refused`). The gate below was therefore re-run in
full against the currently deployed secret; the earlier passing run used the prior key and proves
nothing about the live Worker.

| Case                                                                     | Expected            | Observed                                                                                        |
| ------------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------- |
| Valid `provider_input` token                                             | `200` + exact bytes | `200`, 107,176 bytes, `sha256=1a7faf1d120b42956e2796f24b6460f25de4de2d641caf54912ec7de428f3fdc` |
| Expired token                                                            | `410`               | `410`                                                                                           |
| Token signed for a _different_ object, presented at this artifact's path | `401`               | `401`                                                                                           |
| Tampered signature                                                       | `401`               | `401`                                                                                           |
| No token                                                                 | `401`               | `401`                                                                                           |
| 5 repeat fetches of the valid token                                      | `200` × 5           | `200` × 5                                                                                       |

The served digest equals the `artifacts` row's registered `content_hash` byte for byte. Response
headers derive `Content-Type` from the **signed claims, never R2 metadata**, and carry
`cache-control: no-store`, `x-content-type-options: nosniff`, `referrer-policy: no-referrer`.

The `401` body is deliberately opaque (`"The artifact access token is invalid."`) and does not
disclose whether the failure was malformed, signature, or unconfigured. Structured logs record
`core.artifact_access.served` / `.refused` and never contain the token.

## 3. The $0.04 question code cannot answer — PASS

_Will fal's image fetcher actually retrieve a query-authenticated capability URL from our Worker and
use it as an edit input?_ One Kontext adaptation, ~$0.04, submitted 2026-07-30.

```
SELF-CHECK HTTP 200 image/jpeg 107176 bytes
SUBMIT    HTTP 200 request_id=019fb17d-c40f-7540-9cc2-00429dcaeeec
TERMINAL  COMPLETED after ~15s
RESULT    HTTP 200
IMAGE     1184x880 image/jpeg host=v3b.fal.media
```

Attribution from `wrangler tail` on `mustbeviral-v2-staging-core`, correlating each request to the
`/content` route with its client:

| Client IP                          | User agent            | Outcome                                         |
| ---------------------------------- | --------------------- | ----------------------------------------------- |
| `72.220.108.98` (this workstation) | `node`                | `401`, `401` (pre-alignment), then `200`, `200` |
| **`169.150.224.222`**              | non-`node` browser UA | **`200`**                                       |

That fifth request is fal's fetcher: a different address and a different user agent from anything this
workstation issued, logged as `core.artifact_access.served` with `purpose: provider_input` and
`byte_size: 107176`. **fal follows a query-authenticated capability URL served by our Worker.** The
Option B design stands; no R2 presigned credential is required.

Corroborating: 15 seconds of wall clock and a 1184×880 output constitute a real edit. Contrast the
invalid attempts in §4, which terminalized in ~26ms with no image.

## 4. Two defects this probe uncovered

The first two attempts at this probe returned `COMPLETED` in ~26ms with no `images` array, and the
tail captured **no** `artifact_access` events at all. The URL was never fetched. Diagnosing that
found two independent bugs, neither of which any amount of code reading would have surfaced.

### 4.1 The pinned Kontext application does not exist

fal's queue accepts _any_ submit body with `200 IN_QUEUE` and validates only at execution, so a wrong
application id looks healthy at submit time. Probed with empty bodies, which costs nothing because
validation fails before generation:

| Submitted                       | Result read-back                             |
| ------------------------------- | -------------------------------------------- |
| `POST /fal-ai/flux-kontext/pro` | `404 {"detail":"Path /pro not found"}`       |
| `POST /fal-ai/flux-pro/kontext` | `422` naming required `prompt` + `image_url` |
| `POST /fal-ai/flux-2-pro`       | `422` naming required `prompt`               |

A `422` naming the documented fields proves the application resolves; the `404` proves it does not.
`fal-ai/flux-kontext/pro` — the id pinned in the catalog and seeded into `model_routes` — is not a fal
application. **All 9 launch-pack adaptation nodes would have failed, after real money was spent on the
3 masters they depend on.**

Repointed to `fal-ai/flux-pro/kontext` in `packages/provider/src/catalog.ts` and in
`supabase/migrations/20260730050000_p0_flux_kontext_pro_repoint.sql`, mirroring the Seedance repoint:
the historical `route_key` stays so seeded `create_quote` plans and issued quotes keep resolving, and
only the provider model identity moves. Published price is unchanged at $0.04 flat per image, verified
live — the active catalog still prices the pack at exactly 4,550,000 micros
(3×500,000 + 9×200,000 + 8×100,000 + 3×150,000).

### 4.2 Queue status and result URLs were constructed wrongly for 2 of 3 fal routes

fal namespaces queue status/result under the _application_ — the first two path segments — and treats
anything deeper as a path within it. The driver appended `/requests/{id}` to the full submit endpoint.
Confirmed live across every route we call:

| Submit path                                             | fal's returned result path         | What the driver built |
| ------------------------------------------------------- | ---------------------------------- | --------------------- |
| `/fal-ai/flux-2-pro`                                    | `/fal-ai/flux-2-pro/requests/{id}` | correct               |
| `/fal-ai/flux-pro/kontext`                              | `/fal-ai/flux-pro/requests/{id}`   | `405`                 |
| `/fal-ai/bytedance/seedance/v1/pro/fast/image-to-video` | `/fal-ai/bytedance/requests/{id}`  | `405`                 |

flux-2-pro is the only route where the application and the submit path coincide, which is why this
appeared to work: it is also the only route ever exercised, and Phase D proved it through the
**webhook**, not polling. The polling path had never run live.

`FalQueueDriver.status` is the sole caller, and the reconciler is its sole consumer, so the failure
mode was: a paid Kontext or Seedance artifact observed as succeeded by fal, never ingested, never
captured, retried until the job aged out. Fixed by deriving the base in `falQueueRequestsBase`, with
`packages/provider/src/provider.test.ts` pinning the live-verified literal path for all three
descriptors rather than restating the helper.

## 5. Scope this does not cover

- Maximum queue-to-fetch latency is still unmeasured. The 3600s `provider_input` TTL is an accepted
  risk pending real measurement, on the same reasoning recorded in `FAL_OUTPUT_LIFECYCLE_PREFERENCE`:
  fal fetches when the job _executes_, and queue depth is not ours to control.
- Whether fal follows HTTP redirects on a capability URL is untested; nothing in the current design
  emits one.
- `customer_download` verification was exercised only in unit tests, not against staging. Its
  additional database checks land with the approval/export work in Track E.
