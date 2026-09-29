# Connected W1 journeys on the new PC

Packet `WP-PLATFORM-W1-002`, step `w1b-004-journeys-and-successor`, remains current. This is partial acceptance evidence, not a completion receipt.

## Environment and provenance

Canonical checkout: `C:/dev/projects/ashrunscode/MustBeViral`, branch `codex/viralgraph-cleanroom`. Import verified at private HEAD `3ca1620c37796f611dc55ecad329a4843b998cd5`, tree `fbf8efd8686c063039485e09caa3dd124bbdc281`, 43 private commits after public base `966006beb9bc163019f6c04a564d820b577e1a6d`. Frozen installation and preflight passed on Node 24.18.0 and pnpm 11.12.0. No GitHub write or publication occurred.

NXTSpin and InvestInWash released their development database lane before this project's stack started. Checks used only MustBeViral Supabase, web `127.0.0.1:3111`, and Core `127.0.0.1:8789`, launched by `packages/db/scripts/start-platform-local.mjs`. The database helper checks the `supabase_db_mustbeviral` container, its named volume, and loopback database port 54322 before fixture operations. Unknown processes and existing volumes were preserved.

Synthetic auth users were created confirmed through the local admin API. Invitations persist through application commands. No invitation delivery, email, provider run, Stripe mutation, charging, or production write occurred. Cleanup targets only user IDs created by the current test run; foreign-key blocks leave synthetic data intact. No database reset was used.

## Executed connected checks

- Desktop Chromium and mobile Chromium: **8 passed, 0 skipped, 0 retries**, recorded in `connected-journeys-2026-09-14/browser-receipt.json` with timestamps and source hashes.
- `node packages/db/scripts/verify-platform-connected.mjs`: **7 passed**.
- `node packages/db/scripts/verify-platform-setup-connected.mjs`: **7 passed**.
- `pnpm supabase:test`: **659 assertions in 44 files passed**, including a rerun with browser fixtures retained. Three pre-existing tests were made independent of unrelated data; no tenant rows or immutable ledger entries were removed.

The browser command is in the receipt. It requires `MBV_PLATFORM_CONNECTED=1`, `MBV_PLAYWRIGHT_EXTERNAL=1`, and `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3111`. Without those flags, it skips and cannot count as acceptance. Golden preview is excluded. Authentication traces and video are disabled; eight saved captures contain synthetic signed-in screens only.

## Acceptance map and limits

| Criterion                          | Evidence executed                                                                                                                                 | Remaining proof                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saved two-brand onboarding         | Separate WashBodega/UnPile save, reload, new-context sign-in, concurrent revision conflict, cancelled and confirmed unsaved leave                 | Interrupted in-flight save and uncertain retry through the connected browser; unsaved leave is not equivalent                                                                             |
| Tenant resource navigation         | Desktop/mobile switch, back/forward, forged IDs, unmapped old-link recovery, archive filtering, recipient access, revoked access                  | Delayed stale-response behavior in the connected UI and successful mapped old-link navigation; SQL and pure query-state unit tests are supporting evidence                                |
| Invitations and permissions        | Browser create/pending/accept/revoke without delivery; handler and pgTAP suite, connected lock/acceptance checks                                  | Final criterion-level review must map every replay, expiry, exact recipient, stale role and escalation assertion before marking passed                                                    |
| Truthful billing and accessibility | Missing profile, saved $250.00 from 250000000 integer micros, active subscription, unavailable response, outsider concealment, focused skip links | Real keyboard activation, screen-reader semantics, contrast/zoom/reduced-motion and accepted desktop/mobile design comparison; programmatic focus and screenshots alone do not prove this |

The billing outage is injected at the browser boundary after real seeded billing reads; it does not prove infrastructure outage recovery. Captures retain the current billing shell and studio navigation for review. The September 9 owner approval remains the accepted visual direction; this run does not infer a new approval or complete accessibility pass.

## Successor and skills

`successor-WP-PLATFORM-W2-001.yaml` prepares bounded website/document sourcing, provenance, and unapproved reviewable drafts. It depends on W1 completion and has not been activated.

The repository `build-mustbeviral` skill and governing packet documents were used. Exact named specialists absent from the local catalog were reported rather than invented. Grok 4.6 HIGH CLI performed implementation, diagnosis, and a separate independent review. Codex applied proposed repairs and executed checks when headless CLI permissions cancelled file/shell operations.
