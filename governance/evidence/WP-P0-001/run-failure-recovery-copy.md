# Customer-safe run-failure recovery copy

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-18

No email, password, JWT, confirmation token, private object key, signed URL, raw provider payload,
prompt dump, or customer media is recorded. No GB-02 spend.

## Change

Failed runs now answer the experience-contract recovery questions: what failed, whether spend was
accepted, what was retained, and the single safest next action.

`get_run` nodes may include the already-persisted short `providerErrorCode`. The web maps
`content_policy_violation` to “Image blocked / no charge accepted / edit the brief / do not
resubmit the same prompt.” Other codes keep generic copy and point at the receipt.

Preview goldens stay on the locked Review Approval fixtures. This is live-run copy on the existing
run surface.

## What this is not

- Not a retry API
- Not a GB-02 probe
- Not a reason to pass usable-pack cost or P0 exit
