# Catalog v2 live quote verification

**Date:** 2026-07-29 · **Spend:** none (quote path only) · **Worker:** version
`ede5c7c7-157c-432f-ad83-2bd1871d44ac`, staging

## Result

**20/20 golden briefs quoted at exactly 4,550,000 micros ($4.55)** through the full Worker HTTP
path, against price catalog `p0-launch-2026-07-29-openrouter-copy` (v2), resolving copy through
`openrouter/chat-completions/copy` → `qwen/qwen3-30b-a3b-instruct-2507`.

Confirmed in the database rather than from harness output alone: 20 distinct quotes in the window,
min and max both 4,550,000, one catalog version referenced, and the OpenRouter route present in
every execution plan (320 plan rows = 20 quotes × 16 priced nodes).

The provider move did not change what a customer pays. Copy stays 150,000 micros per request; the
pack stays $4.55.

## What this run caught, and why the earlier check could not

An initial attempt returned **`QUOTE_STALE` on all 20 briefs — a 100% quote outage on staging**.

Root cause: `create_quote` hardcodes role → route_key in SQL. That is deliberate — the caller's
plan is only an idempotency input, so the RPC is the single authority on what a run costs — but it
meant the app-side launch-catalog change and the catalog v2 rows were not sufficient. Two strings
still named `moonshot/kimi-k2.6/chat-completions`: the catalog-completeness guard and the
`copy_set` branch. With v2 carrying no Moonshot price, no active catalog satisfied the guard.

Two faults of mine produced it:

1. **Arithmetic verification was structurally incapable of finding this.** Catalog v2's unit prices
   were checked against the pinned execution plan and the $4.55 total confirmed. That was correct
   about amounts and blind to the resolver. Calling the live quote a "precondition for spend"
   undersold it — it was the only check that could detect this class of defect.
2. **The migration was applied before the Worker was deployed**, so staging quoting was broken in
   the window between. A schema change and the code depending on it have to land together.

Fixed in `20260729020000_p0_create_quote_openrouter_copy_route.sql`, which reproduces the rest of
the function body byte-for-byte so it cannot quietly alter spend caps, idempotency,
revision-conflict handling, or the quote hash. Pinned by 5 pgTAP assertions in
`supabase/tests/database/00014_p0_create_quote_openrouter_copy_route.test.sql`.

## Remaining harness failures are the money guard working

All 20 briefs then failed at `start_run` with `INSUFFICIENT_BALANCE` (HTTP 402). This is correct:
the harness provisions a fresh disposable workspace per run, that workspace has no wallet balance,
and the barrier refuses to start a run it cannot pay for. The balance check fires **before** any
provider dispatch, which is the right ordering — nothing is submitted that cannot be settled.

The harness counts these as failures because it expects the provider-unavailable failure mode, but
`PROVIDER_RUNS_ENABLED=true` on staging, so the balance barrier is simply the first guard reached.
A funded workspace is a precondition of the pack run, not a defect to fix here.

## Operational note

The harness provisions a new disposable user per run and polls indefinitely for email confirmation,
so unattended runs need either `STAGING_TEST_EMAIL`/`STAGING_TEST_PASSWORD` pointed at the existing
`launch-pack-runner@staging-tests.erlvinc.com` service account, or operator-authorized confirmation
of the disposable account. This run used the latter, authorized explicitly before use. The former
is the better long-term fix and remains unconfigured.
