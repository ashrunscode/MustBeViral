# Max-level finish plan: buyer-ready P0 without wasting money

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-18

This is the operative queue for finishing MustBeViral Studio / ViralGraph V2 to the accepted P0
bar. It does not replace `PROJECT_STATE.yaml`, the active packet, or `docs/delivery/QUALITY_GATES.md`.
Where this plan and an authority disagree, the authority wins.

No email, password, JWT, confirmation token, private object key, signed URL, raw provider payload,
or customer media is recorded.

## What “finished / perfect” actually is

P0 is finished only when every required gate in `docs/delivery/QUALITY_GATES.md` is proven:

| Gate                                              | Current truth                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 16 of 20 launch packs technically complete        | Harness 16/20 passed. Live GB-02 16/16 is **not** proven.                                              |
| Median first-reviewable ≤10 min; p90 ≤15 min      | Harness evidence exists.                                                                               |
| Caps $8 / $25 / $100, no duplicate money          | Passed.                                                                                                |
| Private artifacts, no public URL, lineage receipt | Passed.                                                                                                |
| Canvas 55 FPS / 500-node / production Web Vitals  | Canvas lab passed. Production-segment Web Vitals **unmeasurable** (no V2 production).                  |
| Private MCP 5-op REST parity                      | Passed.                                                                                                |
| Landed cost ≤ $5 per **usable** pack              | Pending. Catalog 4,550,000 micros is the customer charge, not a fal invoice. No qualified usable vote. |
| 80% unassisted completion                         | Pending. Operator self-sessions do not count.                                                          |
| 70% usable concepts                               | Pending. Same people gate.                                                                             |
| 3 of 5 prefer the workflow                        | Pending.                                                                                               |
| One paid pilot                                    | Pending. P1a work.                                                                                     |
| Operator go/no-go                                 | Pending. Silence is not approval.                                                                      |

`pnpm agent:finish` is forbidden until those are proven. Agent authority cannot invent Stripe,
admin, production Web Vitals, or a usable-pack vote.

## Hard constraints that stay in force

- DTC / e-commerce first. Agency workflows stay deferred.
- Next.js / Vercel, Supabase, one Core Worker, private R2, fal-first.
- Do not revive V1 (React Router, D1-auth, marketing-autopilot, multi-brand posting, System DNA).
- Do not invent P0 APIs (no Reject API, no Stripe, no settings admin).
- SuperDesign preview goldens stay locked.
- `fal-ai/flux-2-pro` is prompt-only. Do not send `image_url`.
- Do not route images through consumer Grok / Gemini / Codex subscriptions.
- Do not loosen fal `safety_tolerance` or disable the safety checker without an accepted catalog decision.
- Do not reuse runs `f5fa333f`, `9b6e0619`, `a72b78e5`, `33f2e40e`, or `46d4e12b`.
- Staging-only spend. Caps remain $8/run, $25/workspace/day, $100/global/day.
- After an image policy fail, the next paid confirm is a 500,000-micro one-master probe, never a $4.55 pack.

## Cost control

| Spend                              | When it is allowed                                                                                                        | When it is forbidden                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| $0 reconstruction / tests / deploy | Always, for a named change                                                                                                | —                                                                     |
| One $0.50 image probe              | Fail-evaluation exists, one change is **deployed**, banned words are gone, `launchPackRetryDecision` is `evaluated_retry` | Blind retry of the same prompt                                        |
| $4.55 full pack                    | Image probe on the failed node **succeeded** and caps allow it                                                            | After any open image-policy fail                                      |
| Second probe of the same brief     | Only after a **new** one-change is named and deployed                                                                     | Same change, same prompt                                              |
| GB-02 after this probe 422s        | Never again in P0                                                                                                         | Retire live-GB-02-16/16. Harness 16/20 already counts. Demo on GB-04. |

## Track A — agent-executable now (this session)

### A1. Deploy the one named change

Replace `SUPPLEMENT_MASTER_VISUAL_DIRECTIONS[1]` with
`Material still life: closed bottle, carton, and readable label only.`

Do not also rewrite packshot text, product name, or the “No …” tail in the same deploy.

Unit tests already prove the new direction and reject `bottle, capsules, carton`.

Deploy staging Worker `mustbeviral-v2-staging-core`. Rollback target after this deploy is
`1c4b0b41`. Web `87jj0310i` is unchanged; image prompts are built on the Worker.

Mark `46d4e12b.md` `changeDeployed: true` only after the new version ID is live.

### A2. One $0.50 GB-02 master-2 probe

Command shape:

`pnpm --filter @mustbeviral/core canary:single-image -- --staging --brief GB-02 --master 2 --out governance/evidence/WP-P0-001/image-probes/gb02-master-2-closed-packaging`

Cap check is inside the canary. Quoted 500,000 micros. Do not confirm a full pack.

### A3. Branch on the probe

- **Succeeded:** record `imageProbeSucceeded: true`. Do **not** immediately confirm a $4.55 GB-02 pack. Next paid spend is a separate decision after receipt inspection. Demo path stays GB-04 for last-mile.
- **422 / content_policy_violation:** retire live-GB-02-16/16. Do not pay this brief again. Write a new fail-evaluation with `retryDecision: stop`. Later one-change (BFL “no negative prompts” tail) is a **different** packet action, not a same-deploy mix-in.

### A4. Failure recovery copy (separate change, no spend)

The experience contract requires the buyer to see what failed and how to recover. Run-progress already has a failed state. After A3, a later step may tighten customer-safe copy for `content_policy_violation` without exposing provider payloads. That is not this deploy.

### A5. Honesty gates stay pending

Do not mark `usable-pack-landed-cost` or production Web Vitals passed. Keep the landed-cost inventory as the authority.

### A6. Handoff, not fake finish

Run `pnpm agent:verify` and `pnpm agent:handoff`. Leave exactly one next action.

## Track B — operator-owned people work (cannot be coded away)

1. Recruit 5–8 qualified evaluators per `docs/research/EVALUATOR_RECRUITMENT.md` ($200 / 90 min).
2. Run them on the live staging product (GB-04 is the demo brief if GB-02 is retired).
3. Record unassisted completion, usable-concept votes, and preference.
4. Close one paid pilot (P1a charging; P0 records the commitment only).
5. Operator records an explicit go/no-go.

Agent work on this track is limited to kit, protocol, and sanitized evidence. Self-sessions do not count.

## Track C — explicitly not this packet

- Stripe, wallet, entitlements, production deploy: WP-P1A-001.
- Consumer LLM image routing: rejected.
- Packshot bytes on `fal-ai/flux-2-pro`: official input has no `image_url`.
- Staging migration HISTORY rename: frozen for the rest of P0.
- Production-segment Web Vitals: require a V2 production segment.

## Execution order for this session

1. Tests for the named direction (done: 17 contracts + 44 core unit tests green).
2. Deploy staging Worker `872ac183`. Rollback target `1c4b0b41`.
3. Amend fail-evaluation `46d4e12b` to `changeDeployed: true` / then `retryDecision: retry`.
4. One $0.50 master-2 probe: run `17145ccd`, terminal `failed` in 53.056 s, stored code `content_policy_violation`, captured 0, released 500,000.
5. Named change falsified. Live-GB-02-16/16 retired. No further GB-02 spend.
6. Verify + handoff. One next action: customer-safe failed-run recovery copy. No GB-02 spend.

That is the maximum honest finish from here. Anything else is either a people gate, a later packet, or a spend we already decided not to burn.
