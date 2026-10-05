# Independent merge reviews for PR #78

Run: codex-finish-20261002

Base 4268e9b24b605879dbbda81d88ca8cc4d720c2d9; final reviewed head 53ee31f18bc41f70a991b0d19e4d3b43b5474319; normal merge 50556e252eb5d65128bc9599d06b03b85ff22475. Three completed rounds are copied verbatim only after merge. Round 1 failed; its two P2 findings were repaired. Round 2 passed with one cheap mono-font P3, repaired and retested before round 3. No validators or remote calls ran in these reviews.

## Round 1

Exact head b7fb3c39a0fc1556e77ca616550fb4a6cb9e12ac; model gpt-6.1-sol; effort xhigh; session 01a10907-953d-7072-a1dc-4f72853bcb54. Actual process exit 0, 2026-10-04T22:27:33.4773485Z to 2026-10-04T22:42:01.5489815Z. Required flags retained: true.

```text
VERDICT: FAIL

P2 apps/web/app/(en)/studio/[workspace]/(workflow)/quote/quote-flow.tsx:439 — Re-quote focus recovery misses timer expiry. If the quote expires without a confirmation attempt, `result` remains `null`; successful re-quote also sets it to `null`, so the `[result]` effect never runs when the inline recovery button disappears. Fix: request heading focus after successful re-quote independently of confirmation-result changes, and cover expiry without confirming in the regression test.

P2 apps/web/app/(en)/studio/[workspace]/(workflow)/quote/run-progress.module.css:153 — The newly focusable summary inherits an outward focus outline that the surrounding frame clips. Actual original-resolution inspection of `run-production-final-2-short-text-only-200-emulated.png` shows only the left edge; top, right and bottom are hidden. Quote’s focusable impact panel has the same styling gap. This violates EXPERIENCE_CONTRACT.md:63’s explicit requirement for all four edges. Fix: apply `outline-offset: -2px` on both regions’ `:focus-visible` states and verify complete outline visibility.

Reviewed exact head `b7fb3c39a0fc1556e77ca616550fb4a6cb9e12ac` against the specified base. No validators were rerun. Primary-flows and release-smoke remain pending; this review does not approve the unchanged Software film.
```

## Round 2

Exact head b6f022d2c2531ebd499c104ce6c9b5bcf8357428; model gpt-6.1-sol; effort xhigh; session 01a109f1-4da5-76e2-9f13-21ea530fe859. Actual process exit 0, 2026-10-05T02:42:50.4590678Z to 2026-10-05T02:55:54.5734801Z. Required flags retained: true.

```text
VERDICT: PASS

P3 [apps/web/app/(en)/studio/[workspace]/(workflow)/canvas/canvas-flow.tsx:997](<C:/dev/worktrees/mustbeviral/review-b6f022d/apps/web/app/(en)/studio/[workspace]/(workflow)/canvas/canvas-flow.tsx:997>) — The new “Reference” value renders model identifiers in the body font. Source and original Canvas pixels confirm this; BRAND.md:79 requires mono identifiers. Fix: apply the existing `--font-mono` token specifically to this value, preserving wrapping.

Reviewed head `b6f022d2c2531ebd499c104ce6c9b5bcf8357428` against base `4268e9b24b605879dbbda81d88ca8cc4d720c2d9`. No P1/P2 findings.

Both round-1 P2 findings are resolved. Successful timer-only re-quote directly focuses the mounted heading and resets acknowledgment. Inset outlines, bounded summaries and document flow preserve four focus edges; regressions and inspected originals support keyboard reachability and complete monetary values. All thirteen source hashes match the recorded current checkpoint.

Validators were assessed from records, without rerunning or starting processes. Native evidence establishes local layout mechanics; enlargement is emulated, field INP and actual assistive technology remain unmeasured, and contrast-incomplete entries are not numerical passes. The failed native Canvas FPS diagnostic remains distinct from passing prescribed local Chromium results.

Older route/Canvas proof retains its recorded source scope. Staging/production acceptance, primary-flows, release-smoke, unchanged Software film acceptance and broader packet completion remain pending. No files were modified.
```

## Round 3

Exact head 53ee31f18bc41f70a991b0d19e4d3b43b5474319; model gpt-6.1-sol; effort xhigh; session 01a10a8c-2f04-7161-9318-78b2e12e468c. Actual process exit 0, 2026-10-05T05:31:58.6636091Z to 2026-10-05T05:50:35.7371132Z. Required flags retained: true.

```text
VERDICT: PASS

No P1, P2 or P3 findings.

Reviewed `53ee31f18bc41f70a991b0d19e4d3b43b5474319` against `4268e9b24b605879dbbda81d88ca8cc4d720c2d9`, including the complete application/test diff and relevant control flow in all thirteen paths.

Both round-1 P2 findings remain resolved: timer-only re-quote directly focuses the mounted heading and resets acknowledgment; bounded summaries preserve inset focus outlines and keyboard access. Wrapping contains long Quote values. The round-2 P3 is resolved: Canvas Reference uses the existing mono token and retains complete-value and doubled-text assertions.

All thirteen current hashes match the checkpoint. Only CanvasFlow, Canvas CSS and final-ui tests differ from b6. Capture hashes and normalized regression-log hashes match their records. Source, regressions and inspected originals support the bounded repair. No new correctness, security, tenancy, money, copy or scope defect was identified. A3’s four conditions are evidenced for this change.

Recorded validators were assessed without rerunning them. Browser proof establishes local mechanics using synthetic inputs, with Core writes blocked. Enlargement is emulated; actual assistive technology, field INP and incomplete numerical contrast remain unmeasured. The failed native 32-FPS diagnostic remains separate from passing prescribed Chromium results.

Staging/production acceptance, primary-flows, release-smoke, Software film acceptance and broader packet completion remain pending. Adopted A1–A11 governs; A12 remains unadopted.

No files were modified.
```

The record PR's own review stays in its body and is copied by the next documentation PR.
