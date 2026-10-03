# Public-origin release browser proof

Run: codex-finish-20261002

These Playwright MCP records are the signed-out C8 release proof for PR #67,
merge `658cd50cc48906262bf24ec08e84b7d768cce481`. This metadata/auth boundary
change introduces no visual layout or copy change. Full UI-family state,
accessibility and four-width acceptance remains governed separately by C4;
this record does not advance those rows.

- `staging.json`: October 3 at 07:04:59.574Z, staging deployment
  `dpl_HWP8wh8sDzBNDZQijK9uXittJiZf`.
- `production.json`: October 3 at 07:09:13.566Z, apex deployment
  `dpl_CHf1B4RTTcHMRVpAkSvjKQPuQx9b`.

Each record contains 28 actual route/width cells: all 14 C8 routes at 375 and
1280, viewport height 900. Each returned 200, showed one main landmark and a
28 px h1, had no horizontal overflow and carried the exact deployment marker
in its navigation response HTML. Console errors were zero. No form was
submitted and no sign-in occurred.

The initial staging diagnostic expected a marker in the hydrated DOM and
failed that diagnostic assumption. The corrected diagnostic reads the served
HTML, as C8 specifies; both outcomes are retained in the release record.
HTTP metadata, image, redirect and health checks on staging, apex, www and the
public production alias are recorded in `../release-public-origin-2026-10-03.md`.
