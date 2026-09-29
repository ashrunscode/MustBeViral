# WP-P0-001 — P0 launch-pack pricing decision

Date: 2026-07-26. Packet step: `p0-005-golden-launch-pack-runs`. Decision owner: operator-delegated
pricing authority (recorded in session). This document is value-free (no credentials or secrets).
Its sha256 is the `source_hash` of the seeded `price_catalog_versions` row.

Status: **CONFIRMED.** Codex deep pricing research (independent, live-crawled fal/Kimi pages) was
audited against primary sources and **endorses the $4.55 ladder**; three material corrections
(below) are folded in. None changes the customer price or the seed.

## Scope and phase

P0 exercises the complete quote and semantic-ledger mechanism **without automated customer
charging** (per [execution-providers-billing](../../../docs/architecture/EXECUTION_PROVIDERS_AND_BILLING.md)).
These are therefore **validation / demonstration prices** that make the itemized-quote transparency
wedge real end-to-end and exercise the $8/run cap — not a binding P1a rate card. Real provider
generation stays fail-closed (separate provider credentials + retention clearance).

## Standard launch pack

3 master statics + 9 adaptations + 3 copy sets + 1 motion branch (8-second 9:16 clip) — the fixed
`LAUNCH_PACK_SHAPE`, identical across all 20 golden briefs.

## Provider (landed) cost — primary sources, retrieved 2026-07

| Role                | Model                    | Provider unit cost                                     | Per-pack               |
| ------------------- | ------------------------ | ------------------------------------------------------ | ---------------------- |
| master_static       | fal FLUX.2 [pro]         | $0.03 first MP + $0.015/add'l MP (1 MP master → $0.03) | 3 × $0.03 = $0.09      |
| adaptation          | fal FLUX.1 Kontext [pro] | $0.04 flat / image                                     | 9 × $0.04 = $0.36      |
| copy_set            | Moonshot kimi-k2.6       | $0.95 / $4.00 per 1M in/out tok (~$0.033 / set)        | 3 × ~$0.033 = ~$0.10   |
| motion_branch       | fal Seedance (720p, 8s)  | see correction below                                   | ~$0.17                 |
| **Inference total** |                          |                                                        | **~$0.64–0.71 / pack** |

**Correction (Codex research, audited; code fix 2026-07-28):** Seedance 1.0 Lite is **deprecated**.
The motion driver and DB `provider_model_id` now target Seedance 1.0 Pro Fast
(`fal-ai/bytedance/seedance/v1/pro/fast/image-to-video`, queue endpoint on
`queue.fal.run`). Live fal pricing (retrieved 2026-07-28): **$1.00 / 1M video tokens**; at 720p
24fps that is about **$0.022/s** (~$0.17 for 8s). One-pass provider cost is roughly
**$0.64–0.71**, not the earlier $0.86 estimate. This is _inference_ cost, not fully-landed cost —
retries, billable 422s, private-R2 storage, moderation, rejected variants, and operator QA belong
in landed cost. The catalog `route_key` remains `fal/seedance-1.0-lite/motion` so seeded
`create_quote` plans keep resolving; only the provider model/endpoint were repointed (migration
`20260728030000_p0_seedance_pro_fast_repoint.sql`). Submit path pins `resolution=720p` and
stringifies duration to match the Pro Fast OpenAPI enum.

### Margin guardrail (key finding)

At the $4.55 pack price, a 60% gross margin requires **fully-landed cost ≤ $1.82**; at $5 landed
cost the margin is *negative*. The packet's `usable-pack-landed-cost` ≤ $5 gate is therefore a loose
ceiling for this price — the real margin-protective threshold is **≤ $1.82**. Current inference cost
(~$0.70) clears it comfortably, so P0 economics are healthy, but P1a must enforce ≤ $1.82 fully-landed
(or a stated minimum contribution margin), not $5.

## Confirmed customer prices (metered, per unit)

| Role           | Catalog unit   | **Customer unit price**   | Qty/pack | Line                    | Route markup                      |
| -------------- | -------------- | ------------------------- | -------- | ----------------------- | --------------------------------- |
| copy_set       | `request`      | **$0.15** (150,000 µ)     | 3        | $0.45                   | ~4.5×                             |
| master_static  | `image`        | **$0.50** (500,000 µ)     | 3        | $1.50                   | ~16× (value-anchored: hero asset) |
| adaptation     | `image`        | **$0.20** (200,000 µ)     | 9        | $1.80                   | ~5×                               |
| motion_branch  | `video_second` | **$0.10 / s** (100,000 µ) | 8        | $0.80                   | ~2.6×                             |
| **Pack total** |                |                           |          | **$4.55 (4,550,000 µ)** | ~81% gross margin                 |

Rationale: value-anchored per operator directive ("most money we make"); mid of the approved $4–6
band; comfortably under the $8/run cap and clear of the $5 landed-cost-gate optics; markup varies by
route by value (a hero master is worth more than a derivative adaptation, independent of provider
cost). A full pack at $4.55 is credible-but-cheap versus agencies/freelancers ($200–2000/pack),
supporting the paid-pilot gate.

## Money-safety (how the price is enforced)

Quotes are created **only** by the hardened `create_quote` SECURITY DEFINER RPC, which is
**server-authoritative**: it rebuilds the quote from the pinned canvas graph (quantities from
`asset_role` / `duration_seconds`) and the server-selected active catalog version, looks up unit
prices from `model_route_prices`, and treats the client's plan as idempotency input only. `quotes`
grants `authenticated` SELECT only (no INSERT policy/grant), so a caller can never write or forge a
price. Catalog versions are immutable — a price change is an additive new `active` version, never an
edit.

## Known residual (P1a hardening)

`create_quote` derives quantities from the graph, closing the quantity-forgery vector. The broader
capture-time reconciliation (provider cost + pinned markup ≤ quote) is exercised only when real
charging lands at P1a; no loss is possible in P0 (no charging, `start_run` fail-closed).

## P1a reconciliation flag (governance)

This value-anchored P0 price is fatter than the documented P1a model, which is itself
mathematically inconsistent (cost + 25% is a 20% margin, not 60%; 60% needs cost × 2.5 ≈ $2.15). It
does not conflict today because P0 does not charge. **Before P1a real charging (required
decisions):**

- Revise the P1a doctrine to _value-anchored unit prices subject to a minimum fully-landed
  contribution margin_; setup/subscription/prepaid wallet fund platform access, not per-unit margin.
- **Do not bait-and-switch:** showing a pilot $4.55/pack then surprising them with $500 setup +
  $149/mo overwhelms the transparency wedge. Disclose the full anticipated commercial stack on the
  first quote; version every catalog; grandfather pilot unit rates (e.g. locked 6 months). The
  paid-pilot gate must test the **complete commercial bill**, not just whether $4.55 feels fair.
- Enforce the ≤ $1.82 fully-landed margin guardrail above.

Recorded here as required pre-P1a decisions, not silently overridden. (Codex research corroborated;
audited by the pricing-authority owner.)
