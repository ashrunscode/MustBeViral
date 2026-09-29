# The operator self-session kit is ready on staging

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-11

## 1. Evaluator-zero boundary

This kit is for the operator's repeated staging self-sessions as "evaluator zero." Operator
self-sessions **do not count** toward the five-to-eight qualified evaluator sessions, the 80%
unassisted-completion gate, the 70% usable-concept gate, the three-of-five workflow-preference gate,
or any other P0 usability exit. They may expose friction and improve the later evaluator script, but
they never replace an independent qualified evaluator or a signed paid pilot.

The operator uses the real authenticated web product at
`https://mustbeviral-web-staging.vercel.app`. This is the isolated Vercel staging project, despite
Vercel naming its stable-alias target "production." It is not the MustBeViral production target and
does not touch legacy-v1.

## 2. Staging deploy record

### Core Worker

The pre-deploy rollback target was Cloudflare Worker version
`4ec9b483-3b42-411c-9c7e-bb5c446f47b2`, held at 100% by deployment
`9b9d5463-75c5-4402-a623-b36cc5889583`. Current committed HEAD was deployed with repository-pinned
Wrangler 4.110.0 from `apps/core/wrangler.jsonc --env staging`. Deployment
`75767a49-dccf-4415-a329-f4099a7fc1fd` now holds 100% of staging traffic on version
`66b8da78-f001-4077-a268-da6c7063c6ab`; the minute cron remained attached. The known staging
Hyperdrive warning is intentional because this environment uses the accepted Data API baseline.

At 2026-08-11 11:14:43.394 UTC, `GET /health` returned HTTP 200 with safe fields
`schema_version=2026-07-12`, `service=mustbeviral-core`,
`generation=viralgraph-cleanroom-v2`, `status=ok`, and request ID
`187913f7-de50-48d7-a78e-6a4bf5a849c6`.

The typed-client contract smoke completed at 2026-08-11 11:07:07.412 UTC. A real authenticated
`quote_run` response for canvas `c8c5c673-3f30-4652-bf23-24576a735ed7`, revision
`07c67e77-9886-40e4-b3f1-a3da56cfd2dc`, parsed through the operation-specific Zod response schema.
Quote `a544f30e-7865-49b3-977d-3ba83468bba1` named exactly 4,550,000 micros, the 8,000,000-micro run
cap and the 25,000,000-micro workspace/day cap. The confirmation token was discarded and no run was
started.

### Web staging

The previous Ready rollback target is Vercel deployment
`dpl_G95PFSALUNjqckzHjJQL1Xw6Zfrf` at
`https://mustbeviral-web-staging-aomb5vtd0-ernijsansons-projects.vercel.app`. A first build record,
`dpl_8pKG68cyD6z1B6ddhEL26MBahgdG`, failed before promotion because the older project defaulted to
pnpm 9. It never received the stable alias. The successful retry used Vercel's build-scoped
Corepack opt-in and the root `packageManager` pin, and built with pnpm 11.12.0.

Deployment `dpl_7x35GsZeUimUP1dkMwwk6MawdHTj` is Ready and the stable staging alias now resolves to
`https://mustbeviral-web-staging-68likjczs-ashrunscode-projects.vercel.app`. The upload was produced
from a clean `git archive` of committed HEAD. A dry run proved the upload contained 626 files and no
`.git`, `.scratch`, ignored credential, local environment, dependency, build-cache, Playwright, or
test-result artifact.

At 2026-08-11 11:13:38.635 UTC, Playwright opened the stable alias, rendered the `Sign in` heading,
signed in with the ignored operator credentials, followed the redirect-back URL, and observed HTTP
200 from `/api/core/v1/canvases/c8c5c673-3f30-4652-bf23-24576a735ed7`. The GB-02 master and motion
nodes rendered and zero run state appeared. This proves the real deployed sign-in and canvas read
path against the freshly deployed Worker; it did not submit provider work.

## 3. Dedicated identity, workspace, and wallet

The kit created one confirmed staging identity and recorded only its public identifier here:
`18ac74e8-a930-430e-a8a9-9938b944c83c`. Its dedicated workspace is
`098356b4-190c-4273-bac3-df637c92a3c8`.

At 2026-08-11 11:07:07.412 UTC, the privileged staging path called
`POST /rest/v1/rpc/record_ledger_movement` with both `apikey` and protected service-role bearer
headers. Transaction `7b84cc83-f711-4759-9459-4c897a4384da` credited exactly 22,750,000 micros and
reported `replayed=false`. That equals five 4,550,000-micro packs and fits below the unchanged
25,000,000-micro workspace/day cap; it leaves no same-day room for another full pack. Two packs per
day is the comfortable cadence when the operator also wants same-day headroom. Every successful
full-pack session captures exactly 4,550,000 micros.

The email and password exist only in
`C:/dev/MustBeViral/.scratch/self-session-kit-credentials.md`. `.gitignore` rule `.scratch/` ignores
the file, `git check-ignore` identifies that rule, `git status --untracked-files=all` does not list
it, and `git ls-files --error-unmatch` confirms it is not tracked. Do not copy either sign-in value
into a session record, issue, message, screenshot, or committed evidence.

## 4. Three registered brief shapes

Use these exact records from `docs/research/GOLDEN_BRIEFS.md`. The product value, including its final
punctuation, must match the registered `Product` line so the Brief screen replays the pre-seeded
project and canvas rather than creating an empty one.

| Brief | Product                                         | Why it belongs in evaluator-zero rotation                                                                                         | Seeded project                         | Seeded canvas                          |
| ----- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------- |
| GB-02 | `Northstar Magnesium Glycinate Night Capsules.` | $54 supplement subscription; problem-aware buyer; heavy claims and evidence boundary.                                             | `fa73dc36-cd6f-501e-a582-eea355d62fb7` | `c8c5c673-3f30-4652-bf23-24576a735ed7` |
| GB-04 | `Stillroom Countertop Compost Caddy.`           | $129 home bundle; solution-aware buyer; physical dimensions, arithmetic, odor, and sustainability truth under medium constraints. | `9c26e32f-d66e-5b7f-a679-2278771f0d05` | `7fb7573e-daa6-46a4-b5b7-754989a93bcd` |
| GB-10 | `Marrow Mini Crescent Bag.`                     | $95 seasonal accessory; product-aware buyer; luxury restraint plus explicit human-use and creator-usage-rights limits.            | `c89a017e-2caf-5404-a662-3806f9deed96` | `a2095cce-8b3a-48c0-ad3e-e497d9af1fea` |

The ignored credential file also contains direct canvas recovery links. Use them only if the normal
Brief-to-Canvas transition fails, and record that use as assisted completion and as friction.

## 5. Exact repeatable click path

For every session, first copy `self-sessions/TEMPLATE.md` to a dated file such as
`self-sessions/2026-08-12-GB-02-01.md`. Fill it during the session, not from memory afterward.

1. Open the `Sign-in and brief start` URL from the ignored credential file. Confirm the host is
   exactly `mustbeviral-web-staging.vercel.app`, enter the local staging email and password, select
   **Sign in**, and verify redirect-back lands at the dedicated workspace's Brief screen.
2. Open the chosen section in `docs/research/GOLDEN_BRIEFS.md`. Populate every Brief section from
   that registered record, using the exact `Product` line. Confirm product truth, brand kit,
   audience/awareness, offer and destination, claims/legal constraints, prohibited claims, source
   asset names, and rights. Select the required square-packshot and rights attestations only for the
   synthetic staging assets. Select **Save draft**, then **Validate brief**.
3. Verify the Canvas route contains the expected seeded canvas ID from section 4. Read the graph
   before spending: the full launch pack has 16 priced provider outputs (3 copy sets, 3 masters, 9
   adaptations, 1 motion branch) plus brief, brand, QA, and export context. No node may already show
   a run state. Select **Review $4.20 quote**; that locked Canvas label is a preview estimate, not
   permission to spend. The next screen's typed named price is authoritative.
4. On **Review this run before spending**, require a fresh, unexpired quote for the current canvas
   revision. Verify **Maximum charge $4.55**, run cap **$8.00**, workspace day cap **$25.00**, the
   expected 16 priced lines, and a non-expired countdown. Record wallet-before micros and the
   confirm-click timestamp. Select the acknowledgment that names the maximum $4.55 charge, then
   select **Confirm $4.55 run** exactly once. Never bypass a disabled button, change a cap, or
   double-click to recover a slow response.
5. On Run progress, capture the run ID. Watch queued, running, and per-node state advance. When
   **First reviewable output is ready** appears, immediately record its timestamp and select
   **Review available outputs**. Continue observing until the run is terminal; record that
   timestamp and require `succeeded` with all 16 priced nodes terminal-succeed. If the run stalls,
   strands money, or becomes `reconciliation_required`, stop the session and report it; do not
   start another run.
6. On Review outputs, inspect the artifacts and QA notes. Use comparison mode where it helps judge
   variants, then return to the named review. Select **Approve group** only for groups actually
   reviewed. A local rejection note is not a server-side rejection in P0 and must not be described
   as one. Require all 16 provider outputs approved before continuing.
7. Select **Export approved**. The Receipt screen will show **Creating immutable export** while Core
   creates the private deterministic bundle, then **Receipt verified**. Require a Ready export,
   quote 4,550,000 micros, actual 4,550,000 micros for a clean success, zero unexplained variance,
   the immutable run/revision identifiers, and complete cost/lineage rows. Record wallet-after
   micros and the usable-concept judgment.

To start a fresh run, finish and save the current capture file, return to the `Sign-in and brief
start` URL, hard-refresh the Brief screen, choose one of the three registered records, and repeat
from step 2. The exact product name replays its seeded canvas; opening the Quote screen creates a
new quote. Never reuse an expired quote or an earlier confirmation action. Do not top up the wallet
inside this five-pack kit.

## 6. Healthy screen and stop-state checklist

| Screen       | Healthy evidence                                                                                                              | Stop and record                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Sign-in      | `Sign in` loads, password submission redirects to the requested dedicated workspace.                                          | Bad-credential loop, wrong host, lost redirect, or an unexpected workspace.                            |
| Brief        | Registered fields are present, required attestations are explicit, Save draft acknowledges locally, Validate routes normally. | Missing mandatory field with no explanation, empty canvas, or use of a direct recovery link.           |
| Canvas       | Expected seeded canvas ID; 16 priced outputs and their dependency graph; no prior run state.                                  | Wrong canvas/revision, invalid graph, stale run state, or conflict that does not offer a safe reload.  |
| Quote        | Fresh 15-minute quote; $4.55 maximum; $8 run cap; $25 day cap; explicit acknowledgment; confirm disabled until acknowledged.  | Any other named maximum, expired quote without safe re-quote, cap error, or ambiguous confirmation.    |
| Run progress | Real run ID and advancing node counts; first-reviewable banner; terminal success across all 16 priced nodes.                  | No progress, unknown status, reconciliation-required, terminal failure, or nonzero unresolved nodes.   |
| Review       | Available artifacts, compare mode, QA notes, receipt-backed captured/quoted summary, explicit group approvals.                | Missing output, broken media, unsupported claim, unreviewed group, or approval conflict.               |
| Export       | Creating state resolves to Ready after all groups are approved.                                                               | Review-incomplete, provider-unavailable, missing export, or repeated creation with inconsistent truth. |
| Receipt      | Verified immutable record; run/revision; $4.55 quote and actual on success; provider/model/cost/lineage rows; zero residual.  | Missing lineage, unexplained micros, inconsistent identifiers, inaccessible receipt, or signed URL.    |

## 7. Per-run capture and judgment

The copied template records:

- UTC timestamps for confirm-click, first reviewable static, and run terminal, plus computed
  confirm-to-first-reviewable and confirm-to-terminal durations;
- every hesitation, retry, confusing label, workaround, assistance event, and recovery-link use;
- unassisted completion `yes` or `no`, where any procedural or product-operation help makes it
  `no`;
- usable concept as `none`, `one`, or `multiple`, using the registered rule: a concept is usable
  only when the operator would advance it in the current workflow without rebuilding its core
  idea;
- wallet before and after in integer micros, with quoted, reserved, captured, released, refunded,
  and residual amounts explained to the micro from the receipt; and
- run, quote, reservation, workspace, project, canvas, revision, export, and receipt identifiers,
  without credentials, tokens, private object keys, signed URLs, raw provider payloads, or customer
  media.

Start the first run at 22,750,000 wallet micros. For a clean 4,550,000-micro capture, subtract that
receipt's actual amount to obtain the next wallet balance. If a receipt shows any different
capture/release/refund combination, do not infer the balance: record the complete settlement and
stop for reconciliation.

## 8. Verification and mutation boundaries

- `corepack.cmd pnpm agent:preflight` passed before work and `git pull --ff-only` reported current.
- Repository `corepack.cmd pnpm verify` passed on committed provisioning code before its commit.
- Core typecheck and 175 unit tests passed; the web typecheck and 91 unit tests passed.
- The deployed browser proof passed one Playwright test against the stable Vercel URL. It read the
  ignored credential file internally and emitted only workspace/canvas identifiers and safe status.
- The staging wallet credit used privileged PostgREST, not direct SQL. The typed quote used customer
  REST with the Supabase session JWT. No credential or confirmation token is recorded.
- The agent did not confirm a run, submit provider work, approve an artifact, create an export, or
  spend any provider money. No production, legacy-v1, migration-history, cap, or destructive remote
  mutation occurred.

## 9. Left open

- The operator still has to execute and record the evaluator-zero self-sessions; this document
  proves readiness, not session completion or concept quality.
- The locked Canvas call-to-action still says `$4.20`; the operation-specific Quote screen is the
  authoritative $4.55 confirmation. Record the mismatch as friction in every session where it
  affects confidence.
- Qualified evaluator recruitment, five-to-eight independent sessions, the registered P0 usability
  gates, and the signed paid pilot remain open. Operator self-sessions never satisfy them.
