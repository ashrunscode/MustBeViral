# Operator decisions of 2026-08-18: evaluate fails, do not wait on the clock

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs. Recorded 2026-08-18.

The operator replaced the same-UTC-day wait. Midnight does not change prompts, fal, or the live
Worker. Waiting only delayed the next measured attempt.

## 1. Clock wait is retired

Decision: do not block a new confirm solely because another pack already ran on this UTC day.

Consequence: workspace-day ($25) and global-day ($100) caps remain the only day-window controls.
A 4,550,000-micro quote that fits those caps may be confirmed the same day as a prior pack.

## 2. Fail evaluation is the retry gate

Decision: after a failed or partial pack, a new confirm is allowed only when a fail-evaluation
record exists and `launchPackRetryDecision` returns `evaluated_retry`.

The record must name one cause, one change being proven, whether that change is deployed, and
whether banned image-prompt words would still be sent. Blind retry of the same prompt stays
forbidden. Mixing a second variable into the retry (new model, master `image_url`, unrelated brief
rewrite) stays forbidden.

After an image policy fail, the next paid confirm is a one-master probe (catalog 500,000 micros),
not the $4.55 launch pack. `create_quote` already prices a one-`master_static` graph. A full pack
is allowed only after that probe succeeds.

Consequence: agents write
`governance/evidence/WP-P0-001/fail-evaluation/<run-prefix>.md` from
`governance/evidence/WP-P0-001/fail-evaluation/TEMPLATE.md` before the next confirm. The helper
lives in `packages/contracts/src/fail-evaluation.ts`.

## 3. f5fa333f is evaluated and may be retried

Decision: the GB-02 fail on `f5fa333f` is `content_policy_violation` from naming doctor, sleep,
bedroom, muscle, medical, white coats, and body transformation in the image prompt. The one change
is `imageSafeText` on Worker `1c4b0b41`. Reconstructed GB-02 image prompts no longer contain those
words.

Consequence: the UTC-day wait in the packet next action is removed. The next action is a cap check
then one new GB-02 on Worker `1c4b0b41`. Do not reuse `f5fa333f`, `9b6e0619`, `a72b78e5`, or
`33f2e40e`.
