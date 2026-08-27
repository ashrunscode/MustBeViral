# Fail evaluation — [brief] / [run]

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded [YYYY-MM-DD]

Copy this file to `<run-prefix>.md` before any new confirm after a failed or partial pack. Do not
edit the template in place. Never record an email, password, JWT, confirmation token, private
object key, signed URL, raw provider payload, prompt dump, or customer media.

UTC day is not a gate. Caps still apply. Blind retry of the same prompt is forbidden.

## Machine record

Fill every field. `launchPackRetryDecision` must return `evaluated_retry` before confirm.

- failedRunId:
- kind: `[content_policy_violation / http_422 / fal_webhook_failed / timeout / ambiguous / other]`
- cause:
- oneChange:
- changeDeployed: `[true / false]`
- bannedConceptStillInImagePrompt: `[true / false]`
- imageProbeSucceeded: `[true / false]`
- nextSpend: `[failed_image_probe / full_pack]`
- retryDecision: `[retry / stop]`
- helperReason: `[evaluated_retry / full_pack_blocked_until_image_probe / …]`

After an image policy fail, the next paid confirm is a one-master probe (500,000 micros), not a
full launch pack. A full pack is allowed only after `imageProbeSucceeded` is true.

## What failed

- Failed nodes:
- Stored provider_error_code:
- Fal machine type / HTTP:
- Succeeded nodes retained:
- Captured / released / residual micros:

## One cause

Name the single mechanism. Do not list hunches. If two causes remain, stop.

## One change being proven

The next confirm may prove only this change. Do not mix a second variable (new model, packshot
`image_url`, brief rewrite) into the same run.

## Falsifier

If the next pack fails the same way, the change is insufficient. Stop and write a new evaluation.

## Cap check before confirm

- UTC day:
- Global remaining micros:
- Workspace-day remaining micros:
- Safe for one 4,550,000-micro quote: `[yes / no]`
