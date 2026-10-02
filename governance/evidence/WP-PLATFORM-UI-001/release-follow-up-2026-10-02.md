# Release record, follow-up of 2026-10-02

Packet `WP-PLATFORM-UI-001`, owner directive of 2026-10-02 ("finish what is already live"). This
records the follow-up merge and its guarded web release under `adr-0009-standing-release-authority`.
No environment value is stored here. The first release of the day is in `release-2026-10-02.md`.

## Git

- Pull request ashrunscode/MustBeViral#58, branch `codex/platform-ui-002`, base `00d6c49`.
- Commits, in order: `9d100da` (authority-only amendment admitting the barrier database test),
  `8f79e58` (studio frame, quiet empties, checkpoint repair), `69a03f7` (barrier test fix),
  `175fd9a` (acceptance evidence), `ce50f0d` (review repairs), `1b7c6a9` (gate record).
- Reviewed head `1b7c6a921e41226abebb188c4e511a01dbb68eb0`, merged by the repository's normal merge
  as `0b9f5785e39b03088bbf8158113c39e63fa8f49f` at 2026-10-02T14:08:53Z.
- Independent review, read-only Codex on the exact sha, isolated as the directive prescribes:

| Review | Sha       | Verdict                                                                                                   |
| ------ | --------- | --------------------------------------------------------------------------------------------------------- |
| 1      | `175fd9a` | FAIL: a prematurely passed acceptance row and a save message that overclaimed; both repaired in `ce50f0d` |
| 2      | `ce50f0d` | PASS, one non-blocking note on an evidence sentence, corrected in `1b7c6a9`                               |
| 3      | `1b7c6a9` | PASS, "no findings"; the docs-only delta carries the PASS                                                 |

GitHub checks on `1b7c6a9`: GitGuardian success, CodeRabbit success, Cursor Bugbot neutral.

## Gates

On the code head `ce50f0d`: `follow-up-2026-10-02.md`, "Gates on this candidate" (agent:verify 0;
fresh clone install, verify and supabase:test 0; 337 web unit tests; 112 preview and 17 connected
journeys).

On the merge commit `0b9f578`, in a fresh single-worktree clone (`C:\dev\mbv-deploy-0b9f578`,
branch `main`, `.env.example` and `.dev.vars.example` the only env-like files), against the local
database that holds this session's canvases and was not reset:

| Gate                                      | Exit                    |
| ----------------------------------------- | ----------------------- |
| `corepack pnpm install --frozen-lockfile` | 0                       |
| `pnpm verify`                             | 0                       |
| `pnpm supabase:test`                      | 0, 61 files, 1181 tests |

## Staging

Rollback target before: `dpl_2ebacK4izKJh79BBFdXBgFh3Dkt1`. The newest staging deployment was three
hours old; no other release to the target was in progress.

`vercel deploy --prod --yes --scope ashrunscode-projects --project mustbeviral-web-staging` from the
clean clone root of `0b9f578`, operator account `ernijsansons`, start 2026-10-02T14:09:22Z, end
14:10:15Z, exit 0: `dpl_5skrFZb2nnZSog6DYhCd82pB7phL`
(`https://mustbeviral-web-staging-isrjhs4vg-ashrunscode-projects.vercel.app`). The alias
`https://mustbeviral-web-staging.vercel.app` moved to it without a promote.

Smoke at 14:10:41Z: `/`, `/es`, `/software`, `/software/pricing`, `/login`, `/signup`,
`/forgot-password`, `/verify-email`, `/maintenance` and `/unauthorized` HTTP 200, the not-found page
404, `/studio` signed out 307 to `/login?next=`, the build markers present, the served HTML carrying
`data-dpl-id="dpl_5skrFZb2nnZSog6DYhCd82pB7phL"`, the new frame present on `/` and `/es` with the
old well and panel absent, prices $700 and $3,500 only, `/api/core/health` HTTP 200 status ok.
Browser pass at 375, 1280 and 1920: no horizontal scroll, one `main`, h1 28px, the frame one column
on a phone and two from 1280, no console error, no input on `/signup`.

## Production

Rollback target before, still Ready and not used: `dpl_54BQjPtj67Zfm2ew4nNzEoFWaW2j`
(`https://mustbeviral-web-production-n9xa48ydp-ashrunscode-projects.vercel.app`).

`vercel deploy --prod --yes --scope ashrunscode-projects --project mustbeviral-web-production` from
the same clean clone root, start 2026-10-02T14:11:38Z, end 14:12:42Z, exit 0:
`dpl_3atvTZx8YU5ioq4rkvskGyKvxoVj`
(`https://mustbeviral-web-production-9vei4p1qm-ashrunscode-projects.vercel.app`). The aliases
`https://mustbeviral-web-production.vercel.app` and
`https://mustbeviral-web-production-ashrunscode-projects.vercel.app` moved to it without a promote.

Smoke at 14:12:44Z: the same twelve checks all pass, the served HTML carries
`data-dpl-id="dpl_3atvTZx8YU5ioq4rkvskGyKvxoVj"`, the new frame is present with the old well and
panel absent, prices on `/` are $700 and $3,500 and on `/software/pricing` $49, $149 and $399,
`/api/core/health` HTTP 200 status ok. Browser pass at 375, 1280 and 1920 on eight routes: no
horizontal scroll, one `main`, h1 28px, four `tel:` links on `/` and `/es`, no console error, the
signed-out studio entry lands on `/login?next=`. `https://mustbeviral.com` was not touched and
answers HTTP 200. Captures: `browser-proof-2026-10-02b/production-home-w1920.jpg` and
`production-home-m375.jpg`.

Production serves `0b9f578`.

## Not deployed

The Workers stay as they are: `apps/core/wrangler.jsonc` still differs from the last deployed
sources by `global_fetch_strictly_public`, and the web build tolerates the older Core.

## Still open

- One signed-in journey on staging and on production was not run. They share one Supabase project,
  the repository documents no loader that holds a founder login, and creating a user or entering a
  person's credentials is outside what this session may do. The journey was proven on the local
  connected harness instead (`follow-up-2026-10-02.md`). The sentence that closes it: "Use
  founder@mustbeviral.com for the production and staging signed-in smoke."
- The studio frame ships without footage because no rights-cleared studio still or clip exists in
  the repository; the frame is composed to hold the decision on its own. The missing studio footage
  is the single asset blocker for the poster-frame LCP criterion.

## Not crossed

No DNS, domain, traffic or cutover change; no Worker setting; no new variable and the four staging
names untouched, not copied, not printed; no production database write; no signup collection,
generation, charging, posting or spend; no new Spanish; the locked lines and prices unchanged; no
deletion of data, branches, backups or another session's work.
