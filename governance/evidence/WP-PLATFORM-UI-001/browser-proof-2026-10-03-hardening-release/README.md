# D3 exact-source and live release proof

Run: codex-finish-20261002

Source c403b4c395b4c899f1b9562bbd66a50f972d0584; reviewed head 3beb428444d3226d1c2c52f99505d5c6faf31699. Packet WP-PLATFORM-UI-001 revision 3. release-public-hardening-2026-10-03.md is the release record. These observations do not prove authenticated production acceptance; primary-flows and release-smoke remain pending.

## Final accepted observations

| Evidence                                                                              | Proven scope                                                                            |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| d3-author-gates-retry-7-20261003.json                                                 | All seven author gates actually exited 0                                                |
| d3-fresh-3beb428-gates.json                                                           | Eleven exact-head fresh-clone commands actually exited 0                                |
| d3-connected-gate-3beb428.json                                                        | Seventeen local connected journeys passed, actual exit 0                                |
| d3-csp-source-equivalence-3beb428.json and d3-fresh-browser-source-match-3beb428.json | Precommit production-browser observation matches all three final repair source hashes   |
| d3-review-round-1.json                                                                | Completed independent C5 PASS, actual exit 0                                            |
| d3-merge-receipt.json and d3-deploy-root-receipt.json                                 | Normal merge and identical reviewed/deploy trees                                        |
| d3-staging-smoke-summary.json                                                         | Final staging HTTP/browser/media/cache-policy acceptance                                |
| d3-production-smoke-summary.json                                                      | Apex HTTP/browser/media/cache-policy acceptance                                         |
| d3-production-alias-smoke-summary.json                                                | Public production alias HTTP/browser/media acceptance                                   |
| staging/c8-d3-browser.json                                                            | 32 strict cold-context signed-out cells, all PASS                                       |
| production/c8-d3-browser.json                                                         | 32 strict cold-context signed-out cells, all PASS                                       |
| production-alias/c8-d3-browser.json                                                   | 32 strict cold-context signed-out cells, all PASS                                       |
| Each final folder's c8-s0-browser.json                                                | Actual playback/pause/reduced-motion, poster, disclosure and lab measurements           |
| d3-cache-policy-all-staging.json and d3-cache-policy-all-production.json              | Sixteen cold/warm policy-denial diagnostics each; intentional events counted separately |
| d3-production-headers.json                                                            | 22 paths and five real www 308 redirects passed                                         |
| d3-production-alias-receipt.json                                                      | All four aliases inspected on the current Ready deployment                              |
| d3-production-capture-inspection.json and d3-staging-capture-inspection.json          | Actual inspection or byte equality with inspected originals                             |

The three final folders contain fifteen captures. Three S0 images on each production origin exactly match their inspected staging counterparts. The four differing software captures were inspected directly at original resolution; moving-film frames differ. Existing software-film phone readability/internal-label defects remain with D4. No screenshot is evidence for customer or paid-provider acceptance.

## Retained failures and limits

staging-attempt-1/c8-d3-browser.json and d3-staging-smoke-summary-attempt-1.json preserve the initial 24-pass/eight-fail raw-header observation. They are failures, never final acceptance. incident-staging-cached-policy.md retains containment and diagnosis, including the initial unsuitable DevTools eval probe and its explicit no-bypass correction. The retained artifact was promoted only after fresh guarded readiness, then strict C8 passed with separate warm-cache policy coverage. Initial capture files remain separate.

The http-only summary copies and review-start receipt are historical pending snapshots. d3-deploy-root-receipt.json's NoDeploymentPerformed describes its pre-deploy check only. Final summaries, completed review and deploy receipts establish later state. The outside preliminary proof-copy manifest is intentionally not used as final release evidence.

d3-current-harness-console-3beb428.json is a development-mode observation: zero console errors do not make its cache result a production-cache claim. Production-build session privacy and CSP source equivalence are identified separately. No form was submitted to a live origin. No remote authentication occurred.

The first resumed reorientation parser incorrectly looked for an ok boolean in health, whose contract uses status. Its false diagnostic and corrected 200/status result remain separately retained; no live incident occurred. The preliminary filename ending 20261004 was written on October 3 and is retained under its original name; its CheckedUtc is authoritative. A later review-output read initially guessed a nonexistent suffix, then used the exact Out path in the completed receipt before copying the verdict. Neither event ran or crashed a repository validator.

A preliminary packet-evidence insertion helper failed PowerShell operand parsing before writing the packet. The corrected insertion preserved each existing indentation level and added only evidence references. The subsequent frozen-tree handoff passed at 2026-10-04T00:06:06.4028305Z; its receipt and output are retained separately. Required post-command formatting and projection generation also passed.

JSON observations retain complete parsed content; formatting may normalize whitespace before commit. PNG copies preserve original bytes. evidence-manifest.json records the final repository hashes, equality checks and retained-original sources. Earlier repository evidence, raw logs, clones, refs and diagnostics remain intact.
