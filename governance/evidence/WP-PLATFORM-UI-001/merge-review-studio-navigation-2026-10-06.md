# Independent reviews: studio decision layout

Run: codex-finish-20261002.

PR #88. Base `f239e2e7ec9282c24c0c56e3eb2de4cf520ea3a0`. Isolated read-only Codex CLI 0.160.0, gpt-6.1-sol, xhigh. Every prescribed isolation flag was retained. No development-spend entry. Safari/VoiceOver was not executed. Earlier rounds stay as recorded; they are not rewritten.

## Round 1

Exact head `f9040fab60ce8a4abe000df99fef7cae39493986`. Session `01a10ee2-5ace-72e1-a8e2-6b8959ed1578`. Actual process exit 0. Interval 2026-10-06T01:44:35.4580444Z to 2026-10-06T01:48:47.1447641Z.

```text
VERDICT: FAIL

P2 apps/web/src/features/platform/platform.css:767 — `padding: 0` overrides the earlier `.platform-pad` rule on populated Approvals and Tasks cards at widths ≥768px (`studio-sections.tsx:534,564,647,670`). Rows lose their 24px inset; actions reach the card’s clipping edge, cutting off part of the keyboard focus outline. Fix: restrict the padding reset to lists without `.platform-pad` and add populated tablet/desktop layout and focus regressions.

P2 apps/web/src/features/platform/platform.css:768 — The shared `list-style: none` reset removes list semantics in Safari/VoiceOver for consumers lacking an explicit list role. Only the overview list receives `role="list"`; failure, approval, task and invitation lists remain unprotected. Fix: add `role="list"` to every affected list and verify populated states with Safari/VoiceOver.

Reviewed the complete seven-file diff at `f9040fab60ce8a4abe000df99fef7cae39493986` against `f239e2e7ec9282c24c0c56e3eb2de4cf520ea3a0`, relevant tracked authorities, and surrounding routing, permissions, draft recovery, contracts and CSS. No additional security, tenancy, money or copy findings.

Source-only review: no tests or browser execution; author-supplied C4 receipts, measurements, scores and captures were not independently verified.
```

Commit `37be948f9ae4f577a0d6fed2b954ec88cd14d6c0` repaired those two findings in source. This round remains FAIL.

## Round 2

Exact head `7192b2d6c4da16b8d23b47b5a2b72c5dda9d4a03`. Session `01a11046-a5b3-74e1-ad3b-38b3a44b4aa0`. Actual process exit 0. The runner started at 2026-10-06T08:13:37.5179414Z and reported duration 540.40s.

```text
VERDICT: FAIL

P2 apps/web/src/features/platform/studio-sections.tsx:349 Initial pending reads unmount `#new-brand`, while “Add a brand” remains enabled and points to that absent target. Fix: disable the action until the form mounts, or provide a working destination; cover activation during delayed reads.

P2 apps/web/src/features/platform/platform.css:981 Hiding brand tabs below 768px breaks connected `mobile-chromium` cases that still click Settings/Billing links, plus `openBrandDraft`. Fix: make those tests and helpers use the compact “Brand section” control on mobile, then verify both projects.

A3’s four conditions are confirmed: existing tokens/primitives, ≥90 per touched route, zero serious/critical axe violations, and independent review.

Tests were not executed: dependencies are absent in this read-only clone. The author’s matrix and Safari/VoiceOver remain independently unverified.
```

## Round 3

Exact head `82db21c2b1e8df71e85e61c9a9f2008e58803f3f`. Session `01a1107e-599b-7ff2-bd5c-ba5f60e5b6b1`. Actual process exit 0. The runner reported duration 304.15s. The merge journal line at 2026-10-06T09:20:36.5916799Z follows this verdict.

```text
VERDICT: PASS
No findings.

A3 confirms four conditions: existing tokens/primitives, scores ≥90 on every touched route, zero serious/critical axe violations, and independent review.

Static review only. Tests were not rerun: dependencies are absent and connected checks write fixture data. Safari/VoiceOver remains unverified.
```

Reviewed and merged trees of `82db21c2b1e8df71e85e61c9a9f2008e58803f3f` and `cf64d3bd2616a2b18df01ee7727503aeaf17b4b3` were identical. A source review does not independently reproduce browser or provider evidence. The PASS does not complete primary-flows, signed-in release-smoke, or the platform.
