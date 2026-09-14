# W1 completion verification and independent review

Packet: `WP-PLATFORM-W1-002`. Step: `w1b-004-journeys-and-successor`. Date: 2026-09-14.

The remaining W1 acceptance clauses are proven by the connected runs below. This evidence supersedes the gaps in `verification-and-review-2026-09-14.md`; that earlier handoff remains a truthful historical record. The governed finish transition, rather than an offline verification result, closes W1 and activates the prepared successor.

## Final checks

| Check                                   | Result                                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Runtime / import                        | Node 24.18.0, pnpm 11.12.0; verified private continuation and frozen install from the earlier import receipt     |
| Connected desktop Chromium + Pixel 7    | 14 passed; 0 skipped, 0 retries, 0 flaky; final5, source unchanged during the run                                |
| Connected SQL identity checks           | 7 passed                                                                                                         |
| Connected SQL saved-setup / lock checks | 7 passed                                                                                                         |
| Full pgTAP                              | 659 assertions in 44 files, passed with retained synthetic data                                                  |
| `pnpm agent:verify`                     | Passed on final source, including database, governance, design and repository gates                              |
| Repository gate                         | Format, governance tests, generated contracts, task graph, lint, types, unit/integration tests and builds passed |
| Independent review                      | Separate Grok 4.6 HIGH CLI session; no required source defects in final review                                   |

`completion-2026-09-14/verification-receipt.json` records runtime, timestamps, complete case results, source SHA-256 and normalized Git blob identities, raw-log hashes, axe details, clock readiness and the independent review receipt. The transition receipt binds the committed predecessor. Raw logs stay outside Git because build output can contain environment descriptions. No auth storage state, video or trace was recorded.

## Acceptance mapping

### Saved two-brand onboarding

The browser suite creates a studio and separate WashBodega/UnPile records through the actual UI and Core handlers. Separate descriptions survive reload, fresh authenticated connections, back/forward and conflicting edits. Unsaved leave can be canceled. A committed PATCH with its response deliberately lost remains uncertain; the exact retry reuses body/key and returns the same authoritative version. A delayed committed UnPile response cannot replace WashBodega after navigation, and returning to UnPile shows its actual saved value.

Successful focus revalidation retains unsaved current-brand fields. During a held access response the form is hidden, inert and disabled; fresh query results own permissions. Denial unmounts the form and clears the retained snapshot. Changing the resource key resets its component state. No browser storage is a draft or permission authority. Website entry stores an address and makes no analysis/approval claim.

### Tenant resource navigation

Desktop/mobile checks cover brand switches, direct scoped URLs, back/forward, archived/missing/forged resources, an actual durable project-to-brand mapping, and wrong-parent recovery. Held onboarding responses are released in cleanup and awaited through browser response completion plus render turns. A real recipient loses access after owner revocation before its earlier draft response is released; recovery remains and controls do not return.

Billing studio chrome requires an authenticated, paginated studio directory association with the exact workspace. An unrelated but accessible studio cannot supply its name or owner actions; direct billing has generic studio navigation. No sentinel, name matching or workspace-as-studio fallback is used.

### Invitations and permissions

UI creation, pending receipt, exact-recipient acceptance and owner revocation use local synthetic identities without outreach. The remaining lifecycle proof is in the authoritative handler/database layers, not a claim that the browser duplicates every SQL case:

- `packages/contracts/src/platform-setup.test.ts`: normalized recipients, rejected owner invitation and arbitrary target-user injection.
- `packages/contracts/src/platform.test.ts`: authenticated context, idempotency and preserved errors.
- `apps/core/test/unit/platform-parity.test.ts` and `platform-port.test.ts`: operation denial parity, caller JWT and no service-role fallback.
- `supabase/tests/database/00038_platform_operations.test.sql` and `00039_platform_saved_setup.test.sql`: actual SQL command/query authorization, invitation replay, stale versions, wrong/expired/unverified recipient, escalation and revocation/no resurrection.
- `verify-platform-setup-connected.mjs`: concurrent acceptance and revoke/save lock races through independent connections.

### Truthful billing and accessibility

The local ledger seed is integer `250000000` micros; both wallet and available ledger display `$250.00`, with actual seeded subscription state and `$0.00` usage. Missing profile, absent subscription, unavailable read and denied identity remain distinct. Charging is explicitly disabled; no balance is invented from a disabled charging flag.

The final browser suite exercises actual Tab/Enter focus, explicitly verifies typed keyboard text and saved version 2, then performs another Enter-activated save at 200% CSS zoom. It asserts landmarks/labels, current navigation, hidden controls while access revalidates, no horizontal document overflow, vertical reachability, reduced-motion durations and forced-color control distinctions. The twelve WCAG-tagged axe scans have zero violations. All remaining incomplete items concern the decorative `aria-hidden` wordmark glyph containing non-text characters; the adjacent same-color text passes. Mobile navigation now wraps, so the earlier clipped-link incomplete items are gone. No axe rule was suppressed.

Parent visual review compared the approved W0 desktop/mobile brand captures with the final signed-in screenshots. Paper/ink colors, restrained blue controls, type, card hierarchy, sidebar/mobile adaptation and brand context follow the accepted direction. Actual saved operator fields replace prototype-only future findings/media. Final forced-color screenshots have readable active links and disabled Save labels; the unfocused skip link is clipped at normal and 200% scale. CSS zoom and ARIA snapshots are the stated automated scope, not a claim of native assistive-technology certification or production performance measurement.

## Review and repairs

Implementation and repair work used Grok 4.6 HIGH CLI. Independent review used fresh session `48f549e9-654f-48a5-9d8b-25f2c72063f6`, with a separate final delta review. It found no required source defects, subject to the final gates and evidence bind. Parent additionally fixed issues exposed by runtime/visual checks: unreliable navigation waits, strict typing, response-completion assertions, billing association, forced-color text backplates, skip clipping, and a keyboard test that could pass without typing. The last change strengthened focus/value/version assertions only; the final full suite proves that stricter case.

The reviewer confirmed that fresh access owns permissions, a retained current-resource form cannot enable actions while pending, denial clears/unmounts it, and the bounded synthetic-clock gate does not weaken auth. Optional follow-ups remain non-blocking: generic billing chrome on unavailable studio-directory metadata, defensive repeated-cursor handling, and removal of an unused legacy billing view stub. They do not change amounts, identity authority or mutation permissions.

## Local environment and private continuation

The canonical branch remains `codex/viralgraph-cleanroom`. The import was verified against public base `966006beb9bc163019f6c04a564d820b577e1a6d`, private continuation `3ca1620c37796f611dc55ecad329a4843b998cd5`, tree `fbf8efd8686c063039485e09caa3dd124bbdc281`, and 43 private continuation commits. Work in this session started clean at `38a779372a9f1b27e0c0cfa98691f3fec0862b17`. The immutable W1 authority and workflow/instruction sources are unchanged; only permitted product, tests, progress and evidence fields change before the audited finish transition.

Only MustBeViral's local Supabase stack and verified app processes used the coordinated lane. A repository build invalidated the running Next development cache; the known app tree was restarted successfully without deleting the cache or stopping Supabase. The volume and FK-protected synthetic fixtures were preserved. The stack-stop receipt records final shutdown and lane release readiness.

Diagnostics identified a fractional WSL/Windows clock mismatch: fresh local tokens could be issued one second ahead and were rejected as `JwtTokenIssuedAt` by both the actual Node verifier and Core. A one-off VM RTC synchronization succeeded, but fractional skew recurred while Ubuntu's separate time synchronization was active. The final synthetic harness waits for the token's real issue time before forwarding the unchanged Core request, fails above three seconds of skew, and bounds the condition wait to five seconds. It records only numeric waits; final5's maximum was one second. No JWT verification code, service configuration, token claims or API response was altered. This is consistent with the clock synchronization interaction described in [Ubuntu's WSL documentation](https://ubuntu.com/wsl/docs/stable/explanation/time-sync/).

Three workstation-generated local instruction adapters were temporarily formatted for the repository format check and restored byte for byte. Product files were checked normally; no hook or required check was bypassed. Core builds are repository-defined dry runs.

No public push/PR, force-push, workflow edit, production write, provider run, Stripe mutation, charge, invitation email or other outreach occurred. Private commits and evidence stay local.

## Successor

`successor-WP-PLATFORM-W2-001.yaml` is ready, depends on W1, and defines bounded safe website/document capture, extraction provenance and unapproved knowledge drafts. It preserves tenant, billing, invitation and external-effects controls; all W2 steps and checks remain unproved. After the W1 finish transition, the next action is W2 preflight and bounded ingestion contracts. It does not authorize outreach, charging or provider execution.
