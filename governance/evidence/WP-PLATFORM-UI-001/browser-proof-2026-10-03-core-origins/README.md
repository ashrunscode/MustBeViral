# Core origin release: signed-out browser proof

Run: codex-finish-20261002

Playwright MCP C8 proof after PR #69's Core release, source
77892509133e2f58ba09cca300f4a615d254a376. Web rendering and layout were not
changed in that PR. No visual acceptance row advances here.

- staging.json: 2026-10-03T09:18:37.764Z, unchanged web deployment
  dpl_HWP8wh8sDzBNDZQijK9uXittJiZf, after direct staging Core smoke.
- production.json: 2026-10-03T09:22:25.913Z, unchanged web deployment
  dpl_CHf1B4RTTcHMRVpAkSvjKQPuQx9b, after direct and proxied production Core
  smoke.

Each used a newly created signed-out context and checked all 14 C8 routes at
375 and 1280, height 900: 28 cells. Every response was 200, contained the
expected served deployment marker, showed one main and one 28 px h1, and had
no horizontal overflow. Console errors and submitted forms were zero. The
owned browser contexts were closed. No sign-in or remote write occurred.

The first staging diagnostic failed before navigation because the Playwright
code sandbox does not expose the URL global. Using the fixed origin plus
fixed route repaired the diagnostic; the succeeding complete run is in the
staging record. This was not a deployed-route failure.

HTTP and Worker smoke, binding/runtime comparisons, identities, rollback
targets and earlier failures are recorded in
../release-core-origins-2026-10-03.md. Four-width UI-family states,
accessibility and new S0 media/LCP acceptance remain separate required work.
