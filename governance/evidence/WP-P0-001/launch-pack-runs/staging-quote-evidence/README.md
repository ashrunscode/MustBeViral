# WP-P0-001 p0-005 — staging launch-pack quote evidence

Real end-to-end launch-pack **quoting** proven against the isolated staging environment on
2026-07-26. Value-free: contains no credentials.

## Result

- **20 / 20 golden briefs (GB-01..GB-20) produced a real, persisted quote** at exactly
  **4,550,000 micros ($4.55)** each; aggregate $91.00. `succeeded_to_quote: 20`, `failures: []`.
- Every quote is at-or-below the $5 usable-pack gate and well under the $8/run cap.
- Database confirmation: 20 rows in `public.quotes`, one distinct `maximum_charge_micros`
  (4,550,000), all on price catalog version `0c000000-0000-4000-8000-000000000001`
  (`p0-launch-2026-07-26`), all with a valid `created_at + 15 minutes` expiry window.
- `start_run` correctly returned the documented fail-closed `MODEL_UNAVAILABLE` (HTTP 503) for all
  20 — real provider generation stays disabled.

## Environment

- Core Worker `mustbeviral-v2-staging-core`, version `329459d4-e293-40f5-9a83-b89103b336f0`.
- Supabase staging project `lqvigvzqumpwfjikcvws`; migration
  `20260726000000_p0_launch_catalog_and_create_quote` applied (catalog seed + `create_quote` RPC +
  `route_key` relax + one-active-version index).
- Quotes are created only by the server-authoritative `create_quote` SECURITY DEFINER RPC; `quotes`
  grants `authenticated` SELECT only, with **zero INSERT grants and zero INSERT policies** — the RPC
  is provably the sole write path, and it rebuilds the quote from the pinned canvas graph so a
  caller cannot forge quantity, unit, route, catalog version, or price.

## Scope boundary

This proves the quote / transparency / cap mechanism end-to-end. Real image/video/copy
**generation** (`start_run` → provider dispatch → private-R2 artifacts → receipts) remains a
separate milestone, fail-closed pending operator provider credentials (fal key + webhook secret;
Moonshot key + no-train DPA) and retention clearance.

## Files

`summary.json` (run summary) and `GB-01.json`..`GB-20.json` (per-brief records: workspace id,
revision hash, quote total, expiry, confirm result, latency).
