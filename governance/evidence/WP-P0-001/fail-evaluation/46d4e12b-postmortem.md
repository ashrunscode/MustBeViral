# $0 post-mortem: why sanitized GB-02 master-2 still 422ed

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-18

No email, password, JWT, confirmation token, private object key, signed URL, raw provider payload,
or customer media is recorded. Prompts below are reconstructed from registered golden-brief fields
and `imageSafeText`. No fal result body was re-fetched.

Probe `46d4e12b` quoted 500,000 micros, captured 0, released 500,000. Stored code:
`content_policy_violation`. Worker `1c4b0b41`.

## What we compared

| Prompt                       | Outcome   | What it proves                               |
| ---------------------------- | --------- | -------------------------------------------- |
| GB-02 master-1 on `f5fa333f` | succeeded | Same product + packshot text can pass FLUX.2 |
| GB-02 master-2 on `46d4e12b` | 422       | After `imageSafeText`, isolation still fails |
| GB-12 T5 full pack           | succeeded | The route can complete a supplement brief    |

GB-12 T5 used the older master-2 direction that still said “medical staging.” So “medical” as a
negative is not a sufficient explanation. GB-02 master-1 already contains “Night Capsules” and
“two capsules,” so the product name alone is not a sufficient explanation either.

## Reconstructed `46d4e12b` master-2 prompt

Direction: `Material still life: bottle, capsules, carton, and readable packaging only. No lifestyle talent.`

```
Northstar Magnesium Glycinate Night Capsules.

Amber bottle with front/back Supplement Facts, two capsules beside the closed bottle, tamper seal, and carton; no lifestyle talent.

Material still life: bottle, capsules, carton, and readable packaging only. No lifestyle talent.

Product packaging only. Preserve supplied labels unaltered. No lifestyle talent.

Navy and mineral gray, compact grotesk type, and precise voice, diagram-led visuals, no moon-and-cloud fantasy scenes.

No logo-only open. No watermark. No letterbox. Do not render prices or legal paragraphs as type.
```

GB-02 master-1 is identical except the direction is packshot-as-hero (product fills the frame).
That is the only remaining difference that has a successful same-brief control.

## Official model notes (retrieved 2026-08-18)

- `fal-ai/flux-2-pro` input is still prompt-only. Our driver does not send `safety_tolerance`
  (fal default `"2"`) or disable `enable_safety_checker` (default true). Do not loosen those
  without an accepted catalog decision.
- Black Forest Labs prompting guide: FLUX.2 **does not support negative prompts**. Describe what
  to show, not what to hide
  (https://docs.bfl.ml/guides/prompting_guide_flux2). Our image tail still uses “No lifestyle
  talent / No watermark / Do not render…”. That is a **later** one-change if the next probe fails.
  It is not this change: master-1 already carries the same negatives and succeeded.

## One new mechanism

**master-2’s direction restates loose pills.** Combined with a magnesium night-capsule product,
that is the only line that differs from a same-brief success.

One change, and only this change:

Replace `SUPPLEMENT_MASTER_VISUAL_DIRECTIONS[1]` with a closed-packaging still life that does
**not** say capsules, pills, or night/sleep words:

`Material still life: closed bottle, carton, and readable label only.`

Do not also rewrite packshot text, product name, or the “No …” tail in the same deploy.

## What this is not

- Not a reason to confirm a $4.55 pack.
- Not a reason to probe master-3.
- Not a reason to pass `image_url` to `fal-ai/flux-2-pro`.
- Not enough to mark live GB-02 16/16, usable-pack cost, or P0 exit.

If a later $0.50 probe of this one change still 422s, retire live-GB-02-16/16. Harness 16/20
already passed. Demo on GB-04. Do not keep paying this brief.
