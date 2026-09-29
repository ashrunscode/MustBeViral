# Price-accuracy re-test — corrected WashBodega briefs

**Date:** 2026-07-29 · **Spend:** $0.002960 · **Briefs:** WB-01/02/03 as corrected on 2026-07-29

## Why this re-test exists

The original trial briefs asserted that WashBodega's prices were posted in-store only and must never
be stated. **That was factually wrong.** https://washbodega.com/pricing publishes owner-confirmed
prices, reviewed 2026-07-27:

| Service | Published price | Condition |
| --- | --- | --- |
| Self-service wash | from $3.25 | machine size sets the final vend; dryer prices posted in store |
| Wash, Dry & Fold (next day) | $1.29 / lb | 15 lb minimum |
| Same-day Wash & Fold | $2.29 / lb | 15 lb minimum, intake cutoff confirmed at the store |
| Wash, Dry & Go | $1.09 / lb | Friday-Sunday only, priced by actual weight |
| Comforters, specialty, pickup/delivery, commercial | quote-only | — |

The original slate therefore tested the *easy* failure — inventing a price from nothing — which every
candidate passed. It never tested the failure that actually costs a customer money: quoting a real
price against the wrong service, dropping a stated minimum, or omitting the Friday-Sunday window.
The briefs were corrected and the leading candidates re-run against them.

This does not invalidate the model selection. Every disqualification in `../decision.md` rested on a
defect independent of the price premise — missing Hook fields, an invented three-day turnaround, a
"West Houston" geography error, three near-identical angles. It does mean the selection was made on
a weaker test than it should have been, which this re-test repairs.

## Result

| Candidate | Model | Pricing errors | Notes |
| --- | --- | --- | --- |
| selected | `qwen/qwen3-30b-a3b-instruct-2507` | **0** | correct figure, tier and minimum in every set |
| fallback | `deepseek/deepseek-v3.2` | 0 hard, 2 soft | prices correct; frames tier choice as "save" twice |
| anchor | `openai/gpt-5.4` | not measurable | HTTP 404 under the shipped provider allowlist |

### The anchor can no longer be measured, and that is the control working

All three anchor requests returned `404 No allowed providers are available for the selected model.`
`gpt-5.4` is served only by OpenAI, which is not a cleared host in
`OPENROUTER_PROVIDER_ALLOWLIST`. The jurisdiction control fails closed exactly as designed, and a
consequence is that the former quality anchor is unreachable while that allowlist stands. Its zero
error count in the raw checker output is **vacuous** — the sample files are 404 stubs containing no
copy — and must not be read as a pass.

### Two checker false positives, one of which the model got righter than the checker

`savings_claim` fired on `WB-02-selected`, which had written:

> "Next-day Wash & Fold is $1.29 per pound because it includes folding. Wash & Go is $1.09 per pound
> because you fold at home. This is not a discount—it's a different tier, and it's real."

Naming both published prices side by side is explicitly permitted; computing a saving is not. The
model did the former and then explicitly refused the latter. The regex matched only on the word
"discount". Recorded because it is the second time in this trial that a naive checker produced a
false positive against correct output — the first being compliance-notes text being scored as
customer-facing claims.

The `deepseek` hits are softer but real as tone: "Or save with next-day service" and a "You Fold &
Save" headline both lean on saving without stating a figure. Prices themselves were correct.

## Residual defects in the selected model's output

Pricing was clean; these are not:

- **Hours compressed.** Sets 1 and 3 say "Saturday until 1:00 AM". The store is open late on
  **Friday and Saturday**. Set 2 states it correctly. Not false, but incomplete in a way that could
  send a Friday-night customer away.
- **Unapproved amenity claim.** Set 3 adds "No wait times", which is not an approved fact and is the
  kind of operational promise the brief forbids.
- **Off-brand vocabulary.** Set 3 uses "launderette"; the brand uses "laundromat" and "washateria".

These are exactly the class of defect the mechanical claims gate exists to catch, and they argue for
extending it with an hours-accuracy rule before copy reaches a customer. They are not grounds to
change the model: no candidate in the slate was free of this class, and the selected model was the
only one with zero pricing errors on the corrected briefs.

## Conclusion

The selection of `qwen/qwen3-30b-a3b-instruct-2507` stands, now on a materially harder test. Real
published pricing is reproduced accurately, attached to the correct service, with its conditions
intact — including refusing the savings framing unprompted.
