# WashBodega trial — copy model decision

**Date:** 2026-07-28 · **Authority:** lead (executive pricing/model authority) · **Spend:** $0.045919
**Supersedes:** the `openai/gpt-5.4` selection recorded in `../phase-e-step-1/` and `../phase-e-fair-retest/`.

## Mandate

Move copy off `openai/gpt-5.4` to a materially cheaper model, and off the OpenAI/Anthropic vendor
tier entirely. Trial against a real customer — WashBodega, a wash-and-fold laundromat in Houston
77035 — using its real brand rather than the synthetic golden briefs.

## Honesty note on blinding

The evaluation was **label-blinded in the artifacts but not in the console**: the harness printed
model IDs alongside labels as it streamed, so I saw the mapping before the qualitative read. The
blind claim therefore does **not** hold for the taste-based portion of this decision.

Mitigation, and why the result still stands: the separating evidence is mechanical and
identity-independent — structural field completeness, prohibited-claim regex hits, tagline
exactness, and invented-fact checks were computed from the sample files by label only. Every
disqualification below rests on a quotable defect in the artifact, not on my impression. The
harness has been corrected to write the answer key without echoing it.

## Slate and measured cost

Eight candidates × three WashBodega briefs (WB-01 Wash & Fold, WB-02 Wash & Go, WB-03 commercial),
`max_tokens` 2000, ZDR enforced. 24/24 responses returned usable content and stopped naturally.
`openai/gpt-5.4` was included as a blind quality anchor so "good enough" is measured, not asserted.

| Label | Model | $/call | vs anchor | Verdict |
|---|---|---|---|---|
| F | `qwen/qwen3.7-flash` | 0.000151 | 85× cheaper | **Disqualified** — 3 missing Hook fields; false compliance attestation |
| A | `mistralai/mistral-small-3.2-24b-instruct` | 0.000204 | 63× | Rejected — 3 near-identical angles, generic-AI hooks, output wrapped in a code fence |
| **G** | **`qwen/qwen3-30b-a3b-instruct-2507`** | **0.000232** | **55×** | **Selected** |
| B | `z-ai/glm-4.7-flash` | 0.000352 | 36× | Rejected — invented facts |
| H | `meta-llama/llama-3.3-70b-instruct` | 0.000357 | 36× | Rejected — thin copy, corporate-speak, boilerplate compliance notes |
| E | `deepseek/deepseek-v3.2` | 0.000537 | 24× | Runner-up — clean and competent, less distinctive than G |
| C | `nvidia/nemotron-3-super-120b-a12b` | 0.000672 | 19× | Not selected — most expensive of the slate, no craft advantage |
| D | `openai/gpt-5.4` (anchor) | 0.012802 | — | Cleanest output; excluded by the vendor-tier mandate |

## Why G

Best craft in the cheap slate, and the margin is visible in the artifacts. On WB-01 it opened
"Your favorite quilt. Your kid's duvet. That pile you've been avoiding since last weekend." — concrete,
neighborhood-voiced, and the opposite of the generic-AI register the brand sheet hard-rejects. On
WB-03 it produced three genuinely separate B2B angles and correctly refused to promise a turnaround,
writing "quoted per account" where weaker candidates invented an SLA.

Disqualifying defects in the rejected candidates were factual, not stylistic:

- **B** invented a competitor claim — "waiting three days for a return" — and placed the store in
  "West Houston" when it is Southwest Houston. Exactly the claims-discipline failure this brand
  forbids.
- **F** shipped three copy sets with no Hook, and its compliance notes assert "Updated Primary Text
  to end with: 'Your Neighborhood Laundry.'" — an update it never made.

## Cost is not the reason, and should not be presented as one

Copy is ~0.04% of pack cost. At the $4.55 pack price with ~$0.62 of fal spend, switching from the
anchor to G saves **$0.0126 per pack** — about 0.3% of the pack price. The margin guardrail
(landed ≤ $1.82) was already met before this change.

The real justification is the vendor-tier mandate and supply resilience, not economics. Because the
saving is immaterial, **quality remains the deciding axis**, and G was chosen as the best of the
cheap slate rather than the cheapest of it — F was 35% cheaper still and was disqualified on merit.

## Two controls this trial proved are mandatory

### 1. Jurisdiction needs a provider allowlist — ZDR does not supply it

Measured, not assumed. With `zdr: true` + `data_collection: deny` and no allowlist, the selected
model routed to **StreamLake** on 2 of 3 probes. ZDR constrains *retention*; it does not constrain
*where* inference happens. Adding `provider.only` pinned routing to CoreWeave/Nebius across 3 probes
with the model still available.

Critically, the control **fails closed**: an unsatisfiable allowlist returned HTTP 404
"No allowed providers are available for the selected model." rather than silently falling back to an
unapproved host. A control that fails open would be worse than no control, so this was verified
explicitly.

Observed hosts across the full slate: Alibaba, StreamLake, AtlasCloud, Novita, Nebius, DeepInfra,
CoreWeave, Cloudflare, DigitalOcean, Parasail, Mistral, OpenAI.

### 2. Model self-attestation is unreliable and must not be trusted

The compliance-notes field is model-authored, and two candidates (F and G) attested to constraints
they had not satisfied. **G is selected despite this, not because it is exempt** — on WB-03 it
claimed "Tagline used verbatim" in a set whose headline contains no tagline, and it introduced two
unapproved claims, "No shared machines" and a quote described as "(It's Free)".

Therefore the compliance notes are treated as a drafting aid with **no evidentiary weight**, and a
mechanical post-generation claims gate is required before copy reaches a customer. This applies to
every model on the slate including the anchor; it is a property of self-reporting, not of price.

Tagline exactness across the slate (verbatim, including the terminal period): D 3/3, F 3/3, B 2/3,
A 1/3, E 1/3, G 1/3, C 0/3, H 0/3. This is a prompt-and-validator problem rather than a capability
ceiling — the requirement is checkable with a string comparison — and the gate above is what closes it.

## Decision

1. Pin copy to **`qwen/qwen3-30b-a3b-instruct-2507`**, with `deepseek/deepseek-v3.2` as the
   documented fallback.
2. Send a **provider allowlist** on every copy request alongside the existing ZDR constant.
3. Ship a **mechanical claims gate** (prohibited-claim + verbatim-tagline validation) before any
   generated copy is exposed; do not rely on model compliance notes.
4. Retire the Moonshot direct route as planned. `openai/gpt-5.4` is retained in evidence only, as
   the quality anchor future slates are measured against.

Items 2 and 3 are gating: the copy route stays closed until both are implemented and tested.
