# GB-02 image prompts will not re-send the words that 422ed

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-18

No email, password, JWT, confirmation token, private object key, signed URL, raw provider payload,
or customer media is recorded. No pack was confirmed.

## Why this exists

Live GB-02 `f5fa333f` failed master-2 and master-3 with fal `content_policy_violation` because the
image prompt _named_ doctor, sleep, bedroom, muscle, medical, white coats, and body transformation
as things not to show. fal treated the mention as the subject.

A same-UTC-day retry would spend another 4,550,000 micros after 2,350,000 already captured today.
This audit hardens the dispatch path so the next authorized confirm is not a blind repeat.

## What every prior GB-02 image prompt shared

| Attempt                 | Masters that 422ed | What the image prompt still named          |
| ----------------------- | ------------------ | ------------------------------------------ |
| `103e7b53` (harness)    | 1, 2, and 3        | offer, audience, rights list, brand kit    |
| `8d37f4f8` (2026-08-12) | 2 and 3            | rights list + benefit-still-life negatives |
| `a72b78e5`              | 1, 2, and 3        | worker draft still carried banned terms    |
| `9b6e0619`              | 2 only             | master-2 negatives                         |
| `f5fa333f`              | 2 and 3            | master-2 negatives + node rights paragraph |

master-1 on `f5fa333f` succeeded with the same product and packshots. The failure is prompt
material, not the FLUX.2 route.

`GB-12` (also supplements) completed on the same route during T5, so the category is runnable when
the prompt stays visual.

## Hole this change closes

Category detection (`Supplements` / `Supplements;…`) already skipped offer, audience, and rights
for tagged supplement briefs. That misses:

- a live form whose category is `Wellness capsules` or similar
- `brand_kit` / `prohibitedTreatments` that still say “no doctor imagery”
- a stale canvas node that still holds the old master-2 negative list

The dispatch builder now runs `imageSafeText` on every image fragment. A named prohibition list is
replaced with `PRODUCT_ONLY_VISUAL_RIGHTS`. Remaining banned tokens (`clinical` in the brand voice)
are stripped. Copy still receives the full claims and rights text.

## Reconstructed GB-02 master prompts after this change

These are the strings `buildProviderAttemptPayload` now emits for the registered GB-02 brief.
Duplicates are collapsed by `composePrompt`.

Shared tail on every master: `No logo-only open. No watermark. No letterbox. Do not render prices or
legal paragraphs as type.`

**master-1**

- Northstar Magnesium Glycinate Night Capsules
- Amber bottle with front/back Supplement Facts, two capsules beside the closed bottle, tamper
  seal, and carton; no lifestyle talent.
- Packshot-as-hero: product fills the frame, label readable, no logo-only open, no invented
  lifestyle talent.
- Product packaging only. Preserve supplied labels unaltered. No lifestyle talent.
- Navy and mineral gray, compact grotesk type, and precise voice, diagram-led visuals, no
  moon-and-cloud fantasy scenes.

**master-2**

Same product, packshots, rights, and brand line. Direction is `Material still life: bottle,
capsules, carton, and readable packaging only. No lifestyle talent.`

**master-3**

Same product, packshots, rights, and brand line. Direction is `Proof-forward composition: packaging
and approved visual evidence carry the frame. Do not render prices, phone numbers, or legal
paragraphs as type.`

None of those strings contain doctor, sleep, bedroom, muscle, medical, clinical, white coat, body
transformation, insomnia, or anxiety. Offer, audience, and the rights paragraph do not appear.

A mistyped category `Wellness capsules` that still carries the old “without sleep, bedroom, muscle,
doctor, or medical staging” direction now emits the product-only rights line instead of those words.

## What this does not prove

fal can still 422 a visual-only prompt. This file proves we will not resubmit the already-failed
word set. Only a new confirm after 2026-08-19 00:00 UTC can prove 16/16.

Staging Worker `mustbeviral-v2-staging-core` version `1c4b0b41` now holds this sanitizer. Rollback
target is `1d909c1f`. Web `87jj0310i` is unchanged; image prompts are built on the Worker.

Did not reuse `f5fa333f`, `9b6e0619`, `a72b78e5`, or `33f2e40e`. Did not pass `image_url` to
`fal-ai/flux-2-pro`.
