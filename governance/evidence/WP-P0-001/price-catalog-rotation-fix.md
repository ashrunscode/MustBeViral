# Price catalog rotation was impossible — guard narrowed under operator authorization

**Date:** 2026-07-29 · **Authority:** operator-approved (asked and granted before any change) ·
**Migrations:** `20260729000000_p0_price_catalog_retirement_transition.sql`,
`20260729010000_p0_openrouter_copy_catalog_v2.sql`

## The defect

`price_catalog_versions` carried two controls that were individually reasonable and jointly fatal:

- `price_catalog_versions_immutable` — a trigger calling `app_private.reject_immutable_mutation()`,
  which raises unconditionally on **any** UPDATE or DELETE.
- `price_catalog_versions_one_active_idx` — `UNIQUE (status) WHERE status = 'active'`.

Together, a successor version could never be activated: the incumbent could never leave `active`,
and the unique index refused a second `active` row. Prices were not immutable in the append-only
sense, they were **frozen for the life of the database** — no repricing, no model repoint, no new
catalog version, ever.

The schema already contained the evidence that this was unintended. `price_catalog_versions_check`
requires `retired_at IS NOT NULL` whenever `status = 'retired'`, but no code path could ever set
`status = 'retired'`. That constraint was unreachable — retirement was designed and then made
impossible.

This was discovered because the OpenRouter copy repoint needed catalog v2; it would have blocked
every future price change equally.

## The fix

`app_private.reject_price_catalog_version_mutation()` replaces the blanket reject on this table
only. It permits exactly one transition — `active → retired` with `retired_at` set — and rejects
everything else, including any change to pricing identity while retiring.

`model_route_prices` keeps the original blanket guard, so the amounts a quote was built from remain
fully immutable. That is the property that actually protects issued quotes; the version lifecycle
does not need to be frozen to guarantee it.

## Verification

Adversarial probes run live against staging before the fix was used, then committed as
`supabase/tests/database/00013_p0_price_catalog_retirement_transition.test.sql` (11 assertions) so
the relaxation cannot silently widen later:

| Attempt                                          | Result        |
| ------------------------------------------------ | ------------- |
| `DELETE` a catalog version                       | blocked       |
| edit `source_hash` on the active version         | blocked       |
| edit `source_ref`                                | blocked       |
| rename `version`                                 | blocked       |
| back-date `effective_at`                         | blocked       |
| `active → draft` (un-activate)                   | blocked       |
| retire while also editing `source_hash`          | blocked       |
| retire without setting `retired_at`              | blocked       |
| reactivate a retired version                     | blocked       |
| edit `unit_price_micros` in `model_route_prices` | blocked       |
| `active → retired` with `retired_at`             | **permitted** |

## Catalog v2 outcome

- v1 `p0-launch-2026-07-26` retired with `retired_at`; its four price rows are byte-unchanged.
- v2 `p0-launch-2026-07-29-openrouter-copy` active, adding route
  `openrouter/chat-completions/copy` → `qwen/qwen3-30b-a3b-instruct-2507`.
- All 22 previously issued quotes still resolve against retired v1 through their pinned
  `price_catalog_version_id`. This is the append-only design working, not a side effect.
- Customer prices are unchanged, so the launch pack still quotes **4,550,000 micros**
  (3 copy x 150,000 + 3 masters x 500,000 + 9 adaptations x 200,000 + 8 video seconds x 100,000).

## Rejected alternative, and why

`model_route_prices` permits INSERT, so the OpenRouter route could have been priced under the
existing active v1 with no guard change at all. That was rejected: v1 pins `source_hash` to
`pricing-decision.md`, and adding a route priced from different evidence would leave that hash no
longer covering all of the version's rows. It would have traded a visible schema defect for a
silent falsehood in the pricing audit trail.

## Limitation

The `$4.55` total under v2 is verified arithmetically from the pinned execution plan, not from a
live quote: `create_quote` correctly refuses an unauthenticated caller (`28000 UNAUTHENTICATED`),
so it cannot be exercised over the admin SQL connection. A real quote through the Worker with a
caller JWT is required before any spend, and is a precondition of the next spend step.
