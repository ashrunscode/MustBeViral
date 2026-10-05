# Independent reviews: internal-access

Run: codex-finish-20261002.

Full original outputs copied after merge. This documentation PR receives its own review; its rounds are copied by the following documentation PR.

## Round 1, PR #84

Head: 986e83e89447888ccdb7f406a1491aff0cffa8c7. Base: 66a3ba4e7db6f597ecaa51f7a616fcde6e0712d4. Isolated Codex CLI, gpt-6.1-sol, xhigh, codex-cli 0.160.0. Actual exit 0. Interval 2026-10-05T18:43:11.2991833Z to 2026-10-05T18:47:49.9822261Z. Required flags retained: true.

```text
VERDICT: PASS

P3 apps/web/src/features/internal/internal-operations-panel.tsx:16 — The unavailable-state paragraph can exceed BRAND.md’s 70ch reading limit at wide widths because `PlatformEmptySection` has no prose-width cap. Fix: constrain its paragraphs to `max-width: 70ch`.

No P1/P2 findings. The complete diff removes the panel’s readers, subscriptions, workspace plumbing and reconciliation claims. It exposes no operations data or mutation path. Existing session boundaries, ordinary tenant authorization, safety RPCs and other workspace behavior remain unchanged. Recovery reaches the studio chooser.

No positive operator permission is proven. An unknown endpoint’s 404 contributes no authorization evidence. Permission/schema, shared handler and denial/revocation coverage remain carried to W6.1; `primary-flows` and `release-smoke` remain pending.

Evidence limits: I inspected tracked source and contracts only and ran no tests. Later C4/native results were supplied; I could not independently inspect their external receipts, captures, PR body or the author’s visual score. A3 requires evidence for all four conditions and grants no operator capability. Before ready merge/release, PR84 must retain complete exact-head C4 proof, this independent PASS, failed-attempt disclosures and incomplete gates. This PASS covers the bounded repair, not whole-platform completion or deployment.
```

## Round 2, PR #84

Head: 5056ce27a06444ca66099a4e223c278c420e75e8. Base: 66a3ba4e7db6f597ecaa51f7a616fcde6e0712d4. Isolated Codex CLI, gpt-6.1-sol, xhigh, codex-cli 0.160.0. Actual exit 0. Interval 2026-10-05T19:46:45.9039050Z to 2026-10-05T19:50:20.1052781Z. Required flags retained: true.

```text
VERDICT: PASS

No P1, P2 or P3 findings.

Reviewed the complete seven-file base-to-head diff and the round-two delta at `5056ce27a06444ca66099a4e223c278c420e75e8`.

The panel unconditionally renders unavailable content without operations readers, saved-campaign subscriptions, workspace plumbing or mutations. Existing session and tenant authorization boundaries remain intact. Recovery reaches studio choice, Operations labels agree, and the scoped 70ch rule addresses round one’s P3 without affecting other empty states. The regression checks computed and rendered widths after font settlement.

A3’s four conditions have evidence: source-confirmed existing tokens/primitives, author-reported score 96, author-reported zero axe violations, and this independent PASS.

Evidence limits: this was Git/blob inspection only. I did not execute tests, inspect captures or raw receipts, or access the PR body. Current-head C4/native results are author-supplied; earlier-head results were not treated as current proof. Field INP and actual browser zoom remain unproven.

Positive operator capability remains unproven and carried to W6.1; an unknown endpoint’s 404 establishes no permission. `primary-flows` and `release-smoke` remain pending. Ready merge/release requires the complete exact-head C4 command/exit records, accurate PR disclosure, and this independent PASS; this verdict does not establish whole-platform completion.
```
