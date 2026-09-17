# W1 connected verification and independent review

Date: 2026-09-14. Packet `WP-PLATFORM-W1-002`, current step `w1b-004-journeys-and-successor`.
**Handoff, not completion.** `pnpm agent:finish` was not called. The W2-001 successor is prepared in evidence and remains inactive.

## Results

| Check                                                                                | Result                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Exact pinned frozen install and preflight                                            | Passed: Node 24.18.0, pnpm 11.12.0                |
| Connected browser, desktop Chromium and Pixel 7                                      | 8 passed, 0 skipped, 0 retries                    |
| Connected SQL identity journeys                                                      | 7 passed                                          |
| Connected SQL setup/lock journeys                                                    | 7 passed                                          |
| pgTAP with browser fixtures retained                                                 | 659 assertions, 44 files, passed                  |
| `pnpm agent:verify`                                                                  | Passed, exit 0, 10:56:59–11:00:43 America/Chicago |
| Packet database, governance, design, repository gates                                | All passed by `agent:verify`                      |
| Immutable packet authority, state except next action, tracked instructions/workflows | Unchanged from private import                     |

`connected-journeys-2026-09-14/verification-receipt.json` records exact runtime, timestamps, source hashes, log hashes and the separate Grok review session. `browser-receipt.json` and eight synthetic screenshots record the connected runs. Raw logs stay in the private task workspace outside Git because build output can include environment descriptions.

Verification formatted three workstation-generated local instruction adapters temporarily and restored their exact original bytes. Product files were checked normally. Existing non-fatal tool warnings remain; no hook or required check was bypassed. Core build commands are repository-defined dry runs, not deployments.

## Independent review and dispositions

A separate Grok 4.6 HIGH CLI session, `014370ed-8a48-4324-991a-cd7a72159ef4`, reviewed the diff, live test sources, packet, successor, and receipts read-only. This followed an earlier independent review whose harness and error-copy findings were repaired. The final reviewer reported:

- The queue example assignment changed Wrangler's generated literal types into strings and blocked typecheck. **Resolved:** document the local flag as comments, keep the local launcher's false setting, regenerate types, preserve the existing Core union. Core typecheck and full verification then passed. No queue configuration or runtime was enabled.
- Lifted invitation notice state preserves fail-closed access refresh and resets with selected studio identity. No further defect found.
- Workspace-scoped wallet/audit assertions and baseline-relative brand/studio counts preserve the database invariants with retained synthetic data. No further defect found.
- Read versus uncertain-mutation error copy is truthful. No further defect found.
- The unused local helper declaration and obsolete `.mjs` handoff reference were removed/corrected.
- Successor W2-001 is consistent with bounded capture, provenance and unapproved drafts, dependent on W1 completion and inactive.

The independent verdict was **handoff, do not finish**. Receipt hashes preserve the original review; this section records its disposition after the type repair.

## Remaining acceptance

All four aggregate acceptance statuses remain pending. The connected scenarios do not prove every clause:

1. Inject an interrupted in-flight save and uncertain retry, checking authoritative saved state and idempotency after reconnect. Unsaved leave is already tested. A client abort cannot guarantee rollback of an already committed server write; do not promise cancellation or add abort behavior solely to force a test outcome.
2. Delay an old-brand response through navigation and verify that it cannot replace the selected brand or revive denied actions. Exercise a successful mapped old link in the browser as well as existing recovery and SQL coverage.
3. Complete keyboard activation, screen-reader semantics and the accepted desktop/mobile visual comparison, including billing, loading/recovery, focus, contrast, zoom and reduced motion. Programmatic skip-link focus and screenshots are supporting evidence only.
4. Final acceptance mapping should cite the existing invitation handler/pgTAP cases for replay, expiry, exact recipient, stale role and escalation. The reviewer found those layers present; duplicating each in the browser is not required by the packet.

The next action is to coordinate the local database lane and close these proof gaps using the existing harness. No missing owner decision or production access is required for the currently identified synthetic checks.

## Preserved environment and private Git

Only the known task-owned launcher/application process tree was stopped. `pnpm supabase:stop` exited 0; `supabase_db_mustbeviral` remains preserved. Ports 3111/8789 were clear and Docker had no running containers when the lane was explicitly released to InvestInWash. Its later processes must not be stopped by MustBeViral.

The imported continuation and resulting commits remain local/private. No push, PR, force-push, workflow change, packet authority amendment, outreach, provider run, Stripe mutation, charging or production write occurred.
