# Render feasibility preflight

Classification: prerequisite inventory and proposed measurement protocol. No render benchmark,
hosted invocation, media transfer, architecture acceptance or customer capability is proven here.
Readbacks were taken September 29, 2026. W3-001 acceptance remains pending.

Merged source base: `bdbdfe7d84e5226b23786d0fe842f85fe0001dd0`, tree `1cef0ec19a7c679e6c61390cfb6421b878073e22`.
Author checkout: `C:\dev\mbv-a`, local `main`, Node 24.18.0, pnpm 11.12.0.
Preflight exited 0 on this clean merged base before edits. This evidence records prerequisite
discovery; all render acceptance and packet quality gates remain pending.

## Existing implementation and authority

- `packages/artifacts/src/index.ts` owns private artifact measurements, hashes, object keys,
  lineage and deterministic exports. Extend this library; do not create another media library.
- `packages/artifacts/src/access-token.ts` provides expiring object-specific access capabilities.
  These tokens alone do not prove tenant-scoped render authorization or one-time job admission.
- `packages/provider/src/fal.ts` is the implemented fal transport. `packages/providers` contains
  older interfaces and is not the implementation to extend. Current W3 allowed paths include
  the plural directory only. Correct that path through a separate reviewed authority amendment
  before changing the existing driver; preserve steps, acceptance and external-effect restrictions.
- The existing fal normalizer accepts `url`, `video.url` or `images[0].url`; compose documents
  `video_url` and `thumbnail_url`. An explicit compose driver and output adapter are needed.
- Core's `artifact-access`, `artifact-storage`, `artifact-machine`, `fal-ingest` and provider-outbox
  composition retain permissions, durable job/attempt identity, accounting and private R2 ingest.
- sharp 0.34.5 is present through the frozen Next.js dependency graph, with local libvips 8.17.3.
  A supported direct package dependency would also change `pnpm-lock.yaml`, outside this packet's
  current paths. Include that exact file in the same authority correction if needed; do not
  import a private pnpm store path in production or create another executor to avoid the guard.
- Shared catalog search found no `architect-prime` skill and no exact `think` skill. The build
  skill requires both before an irreversible architecture decision. Resolve their guidance through
  restoration or a separately reviewed instruction amendment before that decision. Inventory is
  not a substitute for their required review. No build/release rule is changed by this report.

## Fixture inventory

The byte hashes in `fixture-inventory.json` match W0's approved local design walkthrough.
The W0 design review explicitly leaves publication rights and production font approval open.
Do not infer broader permission from their public-site origin.

| Available reference         | Measured metadata                | Missing benchmark evidence                                                           |
| --------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| W0 WashBodega original logo | WebP, 640 by 491, 187876 bytes   | Permitted benchmark/provider use                                                     |
| W0 WashBodega storefront    | WebP, 1448 by 1086, 190086 bytes | Capture authenticity and permitted benchmark/provider use; phone orientation fixture |
| W0 UnPile website hero      | WebP, 1440 by 810, 34540 bytes   | Original production method and real-premises identity not established                |
| W0 UnPile display font      | WOFF2, 37776 bytes               | License and approved benchmark typography                                            |

No real-footage clip, audio rights/release record, approved literal offer or complete benchmark font
record exists in these references. The operator has been asked for an existing private local folder
and permitted use. Do not manufacture an offer, replace a missing real scene with generated imagery,
or treat synthetic assets as real-media acceptance. Store any newly supplied originals and outputs
outside Git; retain only hashes, bounded metadata and safe measurements in evidence.

### Additional bounded media discovery

A subsequent bounded search of the existing WashBodega and UnPile public media found additional
video files. WashBodega's `docs/REAL_PHOTO_SHOT_LIST.md` classifies the family hero videos as
generated brand video. Its `scripts/polish-equipment-media.mjs` identifies a camera source for the
processed dryer-wall clip, but that original file is absent at its recorded local location. The
script trims a silent 1.9-second derivative with privacy treatment. The existing vertical derivative
has SHA-256 `ef9489a5a613c5c6a876b915b9a5f80ae6939e78d05a576b21db24e4cbbd99dd` and 1535966 bytes.
This is a candidate reference, not a complete approved real-footage/audio benchmark input set.
No external upload or processing was performed, and generated scenes were not reclassified as real.

## Read-only hosted target verification

The existing `mustbeviral-web-staging` project is `prj_SVRV9Oh6J3lAi3muIbK9Mrtkvv6V`, owned by
`team_A11dbY2xnTWzGL63IRBTWmLo` (`ashrunscode-projects`). Readback confirms Next.js, root `apps/web`,
Node `24.x`, Fluid Compute, region `iad1`, and SSO protection on provider URLs. The team has an active
Pro plan. The current staging-project production-target deployment is
`dpl_7RSv8TA8tzmY9MFc2Vgj7wwLQZCm`. It is a rollback candidate, not a verified rollback rehearsal;
its Git source identity was absent from the selected metadata. This is the staging project, not
the separate MustBeViral production service. Both Vercel projects have no linked Git repository.

The connector's project tool failed because its advertised `projectId` schema disagrees with the
server's `idOrName` requirement. The pinned Vercel 55.0.0 CLI succeeded using project inspect and
GET-only project/team reads. Saved readbacks whitelist metadata and exclude environment values.
No project setting, environment variable, deployment or provider job was changed.

The release runbook still has no approved first Vercel deployment invocation. Prepare its exact
existing-project-scoped invocation, source, configuration comparison, rollback and smoke evidence
after the benchmark implementation is reviewable. Obtain that named approval at the final step;
do not deploy from this preflight or infer it from the $100 spending limit.

## Proposed measurement protocol, to seal before implementation

The following thresholds are engineering acceptance choices, not measured results. Complete the
fixture and authority prerequisites, then commit the exact manifest and protocol before code.

| Dimension      | Predeclared check                                                                                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static outputs | 1080 by 1350 and 1080 by 1080 PNG; actual photo and exact original logo, approved font, literal reviewed offer and CTA                                                                                                             |
| Samples        | For each size: 10 fresh-process local samples and 10 warm-process local samples, 40 total; preserve every failure; hosted cold-start observations are separate                                                                     |
| Determinism    | Identical output hash for identical inputs/composition within each pinned runtime; compare fidelity separately across Windows and hosted Linux                                                                                     |
| Latency        | Warm p95 at most 5 seconds, cold p95 at most 10 seconds, each job at most 60 seconds including transfer                                                                                                                            |
| Memory         | Peak process RSS at most 512 MiB; record configured host memory and concurrency from the actual invocation before interpreting headroom                                                                                            |
| Input bounds   | At most 20 MiB and 25 million decoded pixels per photo; at most 64 MiB aggregate source bytes and 40 million aggregate decoded pixels, eight raster layers and sixteen text overlays before decode; one job at a time for baseline |
| Transfer       | Capability/composition request and result metadata at most 32 KiB each; media uses verified private storage transfer, not HTTP request/response bodies                                                                             |
| Static cost    | At most 10000 integer USD micros per successful job; separately record failures, transfer and storage costs, with receipt coverage                                                                                                 |
| Reel           | Actual 15–30 second footage, 1080 by 1920, readable exact-font captions/graphics, rights-cleared audio and checked cover; measure video separately                                                                                 |
| Fal admission  | Obtain current endpoint pricing and an exact bounded quote before submission; never infer a quote from the schema or silently switch models                                                                                        |

For each observation record immutable composition/source/output hashes, runtime and dependency
versions, hardware/environment, sample class, wall/CPU time, peak RSS, byte sizes, status, actual
command exit, provider request identity where applicable, and integer USD micros. Pin crop and text
coordinates; preserve orientation and protected logo/person/product regions. Wrong hash, MIME,
oversized input, missing font, external URL/SSRF, invalid capability and cancellation fail closed.

The current documented Vercel Pro Fluid bounds include default 2 GB memory (maximum 4 GB),
300-second default duration (800-second standard maximum), a 250 MB uncompressed function bundle,
and 4.5 MB HTTP payload limit. Readback does not establish the exact benchmark invocation's memory
or patch runtime. These must be captured before acceptance. Avoid optional beta limits. Source:
[Vercel function limits](https://vercel.com/docs/functions/limitations).

In `iad1`, published Fluid rates are $0.128 per active CPU hour and $0.0106 per provisioned GB-hour,
plus $0.60 per million invocations. Compute a conservative ceiling in integer micros, including
separate transfer/storage costs; published rates are estimates until actual usage is reconciled.
Source: [Vercel pricing](https://vercel.com/docs/functions/usage-and-pricing).

sharp supports exact font-file text composition and EXIF-aware orientation; its availability does
not prove the output. Escape Pango markup in literal customer text and pin font bytes. Do not
claim HEIC support from the installed library alone. Source:
[sharp composite API](https://sharp.pixelplumbing.com/api-composite/).

## Connected privacy and recovery proof

Use Core-issued job capabilities bound to exact workspace, brand, job, composition hash, inputs,
output contract and expiry. Core atomically admits an attempt and rechecks current permission;
the stateless render function cannot become replay or billing authority. Prove forged tenant,
expired/replayed capability, changed source, revocation and cancel/complete races. Core verifies
output hashes, MIME, dimensions/duration and size before registering private R2 lineage. Public
response data must omit credentials and transient URLs.

fal compose exposes timed image/video/audio tracks and returns video/thumbnail URLs, but its
schema does not prove the complete caption/font/overlay workflow. Test that workflow and preserve
the actual request and outcome identity. Source:
[fal compose API](https://fal.ai/models/fal-ai/ffmpeg-api/compose/api).

The current driver retains delivery files for an hour and documents an older restrictive-ACL
failure. Current fal documentation instead describes CDN v3 ACLs with a separate short-lived CDN
Bearer token; `FAL_KEY` is not the restricted-file download token. Prove anonymous denial and Core
authenticated ingest before using customer media. Do not relax ACLs to get a passing benchmark.
Source: [fal file access controls](https://fal.ai/docs/documentation/model-apis/file-access-controls).
Retention and request-payload settings are distinct; suppressing JSON history does not make media
private. Source: [fal retention](https://fal.ai/docs/documentation/model-apis/media-expiration).

Test cancellation both queued and running. A cancellation request can race with completion and
does not prove execution stopped; reconcile the final result and cost. Source:
[fal queue lifecycle](https://fal.ai/docs/documentation/model-apis/inference/queue).

## Budget and disposition

Existing cumulative conservative review reservations are 41443313 USD micros, leaving 58556687
under the owner's 100000000-micro ceiling. New external-service spending in this preflight is zero;
no benchmark amount is reserved or charged. Reconcile a current quote and proposed experiment cap
against the same ledger before any paid admission. Daily application caps are unrelated.

W3-001 remains unaccepted. Next action: complete the exact fixture/rights manifest, then commit
the separate scope/guidance correction and sealed protocol before benchmark implementation.
Hosted activation and final human source-fidelity acceptance remain later named gates. This report
does not authorize them or establish a passing architecture decision.

## Resume inputs and review boundaries

The accompanying `prerequisite-manifest.json` is a pending template, not an accepted fixture
manifest. The owner must identify actual media and permitted use; the implementation agent can
then populate hashes, brand identity, releases, approved font and literal current offer. Do not
store customer bytes, private paths, provider credentials or signed URLs in committed evidence.

Before code, separately commit and review the scoped packet correction for `packages/provider/**`
and `pnpm-lock.yaml`. Resolve `architect-prime` and `think` by restoring their actual sources or a
separately authorized guidance amendment that retains independent architecture review. Neither
change is applied here; this handoff preserves the ready specification, every acceptance criterion,
the existing external-effects policy and all release restrictions. No successor work begins.

The only product-state change is the official preflight handoff. Do not use the W2 passing gates
as W3 render acceptance. Documentation merge checks for this handoff will identify their own
exact candidate head in the pull request and external verification receipt.
