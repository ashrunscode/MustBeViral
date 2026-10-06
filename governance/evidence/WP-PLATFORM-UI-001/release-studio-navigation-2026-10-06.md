# Studio decision layout release

Run: codex-finish-20261002.

Populated attention cards lost their inset, and Tab autoscroll left the focus outline past the viewport edge. The first overview paint also shifted when a two-row loader became five attention rows. PR #88 restores the inset and explicit list roles, gives attention actions a 16px scroll margin, withholds the lower overview until the first brand, review, and invitation reads settle, and disables Add a brand until that form exists. Connected tests use the compact brand section below 768px and open the collapsed studio menu before rail links.

## Source, review and checks

Base `f239e2e7ec9282c24c0c56e3eb2de4cf520ea3a0`. Reviewed head `82db21c2b1e8df71e85e61c9a9f2008e58803f3f`. Merged and deployed source `cf64d3bd2616a2b18df01ee7727503aeaf17b4b3`. Merge actual exit 0. Reviewed and merged trees identical. Eleven web paths differ from the base. No contract, migration, dependency, or Worker config changed from the previous live source `dd4279f0061c19249a5653f4279be00009ff2b26`. See [the review rounds](merge-review-studio-navigation-2026-10-06.md). PR #87's evidence-only review is [copied separately](merge-review-mobile-shell-record-2026-10-06.md).

Round 1 and round 2 remain FAIL. Round 3 is PASS, actual process exit 0, no findings. Safari/VoiceOver was not executed.

On the bytes that became `7192b2d6c4da16b8d23b47b5a2b72c5dda9d4a03`, author migration list/up/list, parity, `agent:verify`, `packet:verify`, `format:check`, and `diff-scope:check` returned actual exit 0. Local migrations: 75 files, head `20260929017000`. `studio-sections.test.tsx` passed 16 tests. Focused Chromium passed the populated padding/outline test and the partial-visibility Tab test. A fresh clone passed install, preflight, governance check/test, format, verify, migration list/up/list, and `supabase:test`, all actual exit 0. Preview suites plus booking and internal access: 90 passed and 1 prescribed skip, actual exit 0. Connected platform and knowledge suites: 25 passed on desktop Chromium, actual exit 0, after one failed start in which the starter shell stopped Core. Providers and queues stayed off. Cleanup guards preserved synthetic users. No forced deletion.

The optimized production build of that same head returned actual exit 0 with preview bypass false. Native Chromium then ran 42 populated overview, approvals, and tasks cells. Focus outlines were complete, axe violations were zero, horizontal overflow was zero, and application errors were zero. Initial 375px overview CLS was 0.0018500777540504908. That measurement belongs to `7192b2d`, not to the later loading-control commit.

Commit `82db21c` disables Add a brand while the form is absent and updates the connected helpers. Its desktop proof is the billing and keyboard tests, both passed. Its mobile proof is the retried connected journeys, including billing and keyboard, all passed on mobile Chromium. `agent:verify` was not repeated on `82db21c`. These are local checks, not CI. Node 24.18.0, pnpm 11.12.0, Supabase CLI 2.109.1, Playwright 1.61.1, Vercel CLI 59.16.0.

## Guarded release and live smoke

Operator: local Grok, under renewed A1–A11 and ADR-0009. Clean deploy clone, frozen install actual exit 0, exact merged source, example env files only. `git diff` of both Worker configs from `dd4279f` to the merge was empty, so neither Worker was deployed.

Ship-day terms, read 2026-10-06 from [Higgsfield terms](https://higgsfield.ai/terms-of-use-agreement): last updated July 26, 2026. Section 4.4 still says the company does not claim ownership of inputs or outputs and does not restrict commercial use of outputs. No new generation or credit spend.

| Target                     | New deployment                   | Recorded rollback target         | Journal UTC                  |
| -------------------------- | -------------------------------- | -------------------------------- | ---------------------------- |
| mustbeviral-web-staging    | dpl_AbYCRCKJLa9xjj5tvkuY6acA4PMu | dpl_5T4DD199RBa1m1LtU5YF95QRTMVk | 2026-10-06T09:23:00.9697464Z |
| mustbeviral-web-production | dpl_FEoD9y2NR1Wu9j5vBd6n9sqttgF3 | dpl_2wmv2ChXF5a5d4tPVWA32ixYsp4i | 2026-10-06T09:24:24.2656582Z |

Both deploy commands returned actual exit 0. Staging smoke returned 200 for `/`, `/es`, `/pricing`, `/privacy`, `/terms`, `/advertising`, `/software`, `/software/pricing`, `/signup`, and `/llms.txt` before production started. Apex returned 200 for the same public pages except `/llms.txt` was checked on staging only. Apex HTML contains `$700`, `$3,500`, and `713-899-9346`. The software page HTML contains a poster. `www.mustbeviral.com` returned 308 to the apex. Production aliases observed on the deployment are apex, www, the public Vercel alias, and the project alias. No form was submitted and no remote database was written.

## Not crossed

No remote database write, production Auth query, founder sign-in, customer generation, charging, posting, DNS change, Worker setting change, secret disclosure, or deletion. Primary-flows stay pending. Release-smoke stays pending because the signed-in founder journey has no usable named bundle and no confirmed existing user. The public route smoke above is not that signed-in journey. No acceptance row was marked passed.

## Next action

Finish the remaining pre-transition quality pass on this released source, including current route inspection and the real local canvas proof, then carry unproven obligations into RENDER-001 under A2.
