# Release record, films program, 2026-10-02

Packet `WP-PLATFORM-UI-001`, owner directive of 2026-10-02 (films program), under
`adr-0009-standing-release-authority`. No environment value is stored here. The run record is
`films-program-2026-10-02.md`; the review record is `merge-review-films-2026-10-02.md`.

## Git

- Pull request ashrunscode/MustBeViral#61, branch `codex/platform-ui-003`, base `20b6e1e`.
- Commits, in order: `a3c977e` (the public pages, the search surfaces, the signed-in instrument),
  `95cacc6` (two preview goldens kept byte-identical to main), `80e57cb` (evidence), `76245d1`
  (review repair), `82b9c0d` (evidence).
- Reviewed head `82b9c0d0176760b45c3eb5238cfeef0c5df2b563`: round 1 on `80e57cb` FAIL, repaired;
  round 2 PASS with no findings. Merged by the repository's normal merge as
  `95deda541197c01379228dd633a6166c0fc67fbf` at 2026-10-02T18:05:39Z.

## Gates

On the code head `76245d1` and on `95cacc6`: `films-program-2026-10-02.md`, "Gates" (author clone
`agent:verify` 0; fresh single-worktree clones with frozen install, `pnpm verify` and
`pnpm supabase:test` all 0, 1181 database tests; 349 web unit tests; 112 preview and 17 connected
journeys).

## Staging

Rollback target before: `dpl_5skrFZb2nnZSog6DYhCd82pB7phL`. No other release to the target was in
progress.

`vercel deploy --prod --yes --scope ashrunscode-projects --project mustbeviral-web-staging` from the
clean clone root `C:\dev\mbv-deploy-95deda5` (a `--no-local` clone of GitHub at `95deda5`, branch
`main`, no change, `.env.example` and `.dev.vars.example` the only env-like files), operator account
`ernijsansons`, start 2026-10-02T18:06:02Z, end 18:06:45Z, exit 0:
`dpl_HK4J6VQAPKx8Hp8ymxjGUwsLfXbg`
(`https://mustbeviral-web-staging-qym8jfnur-ashrunscode-projects.vercel.app`). The alias
`https://mustbeviral-web-staging.vercel.app` moved to it without a promote.

Smoke at 18:07:02Z: the twelve route checks pass (`/`, `/es`, `/software`, `/software/pricing`,
`/login`, `/signup`, `/forgot-password`, `/verify-email`, `/maintenance` and `/unauthorized` HTTP
200, the not-found page 404, `/studio` signed out 307 to `/login?next=`); the eighteen build markers
pass (the six kinds and the owner sentence on `/`, the `LocalBusiness` JSON-LD with no address, the
`x-default` hreflang and `og:image`, no new Spanish on `/es`, the beats beside the film and the mail
link on `/software` with the studio line absent, charging named as off and no buy button on the
pricing page, `/llms.txt`, `/robots.txt` and `/sitemap.xml` served, the social card 1200 by 630);
the served HTML carries `data-dpl-id="dpl_HK4J6VQAPKx8Hp8ymxjGUwsLfXbg"`; `/api/core/health` HTTP
200 status ok. Browser pass at 375, 1280 and 1920 on the four public pages: no horizontal scroll,
one `main`, h1 28px, the studio action and price in the first fold, six kinds on `/` and none on
`/es`, JSON-LD and `og:image` present, four `tel:` links; the film starts muted with the first beat
marked and choosing the fourth beat seeks it to 13s; no console error. Captures
`browser-proof-2026-10-02c/staging-*.jpg`.

## Production

Rollback target before, still Ready and not used: `dpl_3atvTZx8YU5ioq4rkvskGyKvxoVj`
(`https://mustbeviral-web-production-9vei4p1qm-ashrunscode-projects.vercel.app`).

`vercel deploy --prod --yes --scope ashrunscode-projects --project mustbeviral-web-production` from
the same clean clone root, start 2026-10-02T18:07:50Z, end 18:08:47Z, exit 0:
`dpl_Bw8Txy9Atvk8yoBocUxv3AEZW5EN`
(`https://mustbeviral-web-production-9trdq2f1z-ashrunscode-projects.vercel.app`). `vercel inspect`
lists its aliases as `https://mustbeviral.com`, `https://www.mustbeviral.com`,
`https://mustbeviral-web-production.vercel.app` and
`https://mustbeviral-web-production-ashrunscode-projects.vercel.app`; all four moved to it without
a promote.

Smoke at 18:09:05Z on `https://mustbeviral-web-production.vercel.app`: the same twelve route checks
and eighteen markers pass, the served HTML carries `data-dpl-id="dpl_Bw8Txy9Atvk8yoBocUxv3AEZW5EN"`,
`/api/core/health` HTTP 200 status ok. Browser pass at 375, 1280 and 1920 on the four public pages
with the same results as staging; choosing the second beat seeks the film to 4s; under reduced
motion no video mounts and no animation runs; the signed-out studio entry answers 307 to
`/login?next=`; no console error. Captures `browser-proof-2026-10-02c/production-*.jpg`.

**mustbeviral.com serves the new deployment.** `https://mustbeviral.com/` and
`https://www.mustbeviral.com/` answer HTTP 200 with
`data-dpl-id="dpl_Bw8Txy9Atvk8yoBocUxv3AEZW5EN"`, pass the twelve route checks and the eighteen
markers. The domain was already attached to the production project when this release ran; no
domain, DNS, traffic or cutover setting was changed by this session. The alias
`https://mustbeviral-web-production-ashrunscode-projects.vercel.app` sits behind Vercel's
deployment protection (302 to the Vercel sign-in), so it was not smoked directly; `vercel inspect`
confirms it points at the same deployment.

Production serves `95deda5`.

## Not deployed

The Workers stay as they are: `apps/core/wrangler.jsonc` still differs from the last deployed
sources by `global_fetch_strictly_public`, and the web build tolerates the older Core.

## Still open

- The Higgsfield films. No credential exists in this environment; the pipeline waits in the owner's
  brief folder. The sentence that clears it: save `HF_API_KEY_ID` and `HF_API_KEY_SECRET` into
  `%USERPROFILE%\.agent-secrets\inbox\` (one secret per file) and ingest them.
- The studio hero poster, which needs a rights-cleared studio still or clip (or the S0 master).
- One signed-in journey on staging and on production: "Use founder@mustbeviral.com for the
  production and staging signed-in smoke."

## Not crossed

No Higgsfield call, no spend, no key printed, no customer file uploaded; no DNS, domain, traffic or
cutover change; no project created; no Worker setting; no new variable and no environment value
copied or printed; no production database write; no signup collection, generation, charging,
posting or provider spend; no new Spanish; the locked lines and prices unchanged; no deletion of
data, branches, backups or another session's work; nothing under `briefs/` or `.playwright-mcp/`
committed.
