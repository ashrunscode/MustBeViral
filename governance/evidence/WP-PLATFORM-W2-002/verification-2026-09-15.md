# WP-PLATFORM-W2-002 verification

Packet: `WP-PLATFORM-W2-002`. Frozen review base: `f49bd5b22fd839ec900b270cb4a0063b6735d059`. Starting checkpoint: `16f7f325f83f12d649633bae460759dac4f7b6f7`. Branch: `codex/viralgraph-cleanroom`. Runtime: Node 24.18.0, pnpm 11.12.0.

This packet implements W2.2–W2.4 on W2.1 captures. It is not Wave 2 exit. Independent Dispatch reviews must PASS the same anchored source before `pnpm agent:finish`.

## Checks

| Check                        | Result                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm agent:preflight`       | Passed; active packet WP-PLATFORM-W2-002                                                                                                                                          |
| Additive local migrations    | `20260915010000` applied, then repairs `20260915020000` and `20260915030000` on existing `supabase_db_mustbeviral` volume. 20260914 migrations were not edited. Volume not reset. |
| `pnpm supabase:test`         | 46 files, 759 assertions, Result: PASS                                                                                                                                            |
| Connected knowledge SQL      | `verify-platform-knowledge-connected.mjs` 8 passed                                                                                                                                |
| Fixture probe                | `verify-platform-knowledge-fixtures.mjs` passed, including WashBodega, UnPile, Harbor Press, and Riverside Coffee samples                                                         |
| Domain unit tests            | 38 passed                                                                                                                                                                         |
| Contracts unit tests         | 130 passed                                                                                                                                                                        |
| Core unit tests              | 450 passed                                                                                                                                                                        |
| Platform web unit tests      | 18 passed                                                                                                                                                                         |
| Connected knowledge journeys | 10 passed (5 desktop Chromium, 5 mobile Chromium), 0 skipped/flaky                                                                                                                |
| W1 connected regression      | 14 passed, 0 skipped/flaky                                                                                                                                                        |
| Successor                    | `successor-WP-PLATFORM-W2-003.yaml` schema-valid; W2.5 change detection, expiry lifecycle, contradiction/catalog import only                                                      |

## Acceptance mapping

### Representative extraction

Deterministic extractors persist typed offerings, locations, facts, offers, visual candidates, and language from W2.1 HTML/plaintext/Markdown plus WashBodega, UnPile, Harbor Press, and Riverside Coffee fixtures. Unknowns stay unknown. Visual candidates stay `reusable=false`. UnPile fixtures cannot produce WashBodega facts. Prompt-injection text is skipped, not stored as knowledge or a permission change. No PDF/DOCX parser, live public crawl, or paid inference.

### Labeled voice, audience, and positioning

Proposals store evidence keys, confidence, and status. Missing audience stays unknown, not a demographic stereotype. Inferred personas stay labeled until `approve_brand_version`. Proposal generation does not start a provider run, send outreach, or spend.

### Owner-approved immutable versions

An authorized operator command against an exact `draft_hash` creates an immutable `brand_version`. Later correction appends a new assertion and does not mutate the pinned snapshot. Approve refuses `EXPIRED_OFFER` and `CONTRADICTORY_KNOWLEDGE`. Direct table writes are denied. Forced RLS, forged parent/child IDs, revoked grants, and stale browser responses are covered. Manual/no-website brands reach the same unapproved-then-approved path. This is not W2.5 change detection, expiry lifecycle, or catalog import.

### Two-brand journeys

Desktop and mobile WashBodega and UnPile journeys cover capture or manual draft, extraction, proposals, correction, targeted questions, and operator approval with persisted Core/RPC/Postgres/private local storage. UI remains on the September 9 Lightfield studio direction. No outreach, charging, provider run, or production remote write.

## Limitations

- Synthetic `*.mbv-source.test` hosts are the only substituted outbound HTTP boundary.
- Synthetic user cleanup can be blocked by local auth constraints; those users are synthetic and unused for production.
- Independent Codex/high and Claude/high reviews are required on the same commit, frozen base, and fingerprint. This worker does not close the packet.

## Next action

Dispatch independent reviews of this W2-002 source. Do not run `pnpm agent:finish` until both reviewers PASS.
