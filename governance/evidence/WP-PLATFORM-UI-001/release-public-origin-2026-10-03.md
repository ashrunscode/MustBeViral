# Public origin release, October 3, 2026

Run: codex-finish-20261002

Packet `WP-PLATFORM-UI-001`, specification revision 3. Authority is the original
adopted A1–A11 record in `owner-directive-2026-10-02d.md`, merged through PR #65;
the later disk-only A12 is not adopted. This release exercises only A4 and the
existing guarded V2 web release. It advances no product acceptance row.

## Source and gates

PR [#67](https://github.com/ashrunscode/MustBeViral/pull/67), base
`485e7287e21b7f6656fef0647fcbabf5fc92651f`, reviewed head
`4ca8264c2ad4a1cf7ef61e32753ca179be9c259c`, merged normally at
2026-10-03T06:58:41Z as `658cd50cc48906262bf24ec08e84b7d768cce481`.
`merge-review-public-origin-2026-10-03.md` preserves both independent reviews
and the earlier failures. GitGuardian passed; CodeRabbit reported success with
its draft-review skip. The isolated local review supplies the independent review.

Node 24.18.0; pnpm 11.12.0 through corepack; Codex CLI 0.160.0; Vercel CLI
59.16.0; Wrangler 4.110.0; Supabase CLI 2.109.1; Playwright 1.61.1.
GitHub Actions remained off. These are local checks, not CI.

| Environment                                                                | Command                                                                                                       | Actual result                                                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Author, exact reviewed tree                                                | `agent:verify` with the pinned pnpm shim                                                                      | Exit 0, including all packet gates and 61 database files / 1181 assertions           |
| Author                                                                     | `packet:verify`, `format:check`, `diff-scope:check --base origin/main --head HEAD`                            | Each exit 0; ten admitted changed files                                              |
| Author before merge                                                        | `agent:preflight`                                                                                             | Exit 0; source remained clean                                                        |
| Fresh `C:/dev/mbv-verify-4ca8264`, local main                              | Frozen installation, `agent:preflight`, `governance:check`, `governance:test`, `format:check`, `verify`       | Each exit 0; 176 governance tests passed                                             |
| Same fresh clone                                                           | Local migration up/list and corrected diagnostic parity guard                                                 | CLI commands exit 0; all 75 file/local/applied versions agree, newest 20260929017000 |
| Same fresh clone                                                           | `supabase:test`                                                                                               | Exit 0; 61 files, 1181 assertions passed                                             |
| Same fresh clone, port 3113, deliberately wrong process-only public origin | `public-origin.spec.ts`, desktop Chromium                                                                     | Exit 0; nine rendered-output tests passed                                            |
| Same fresh clone, port 3113                                                | C4 final-ui, campaign-resume-recovery, cleanroom, operator-self-session, canvas-stress and canvas-perf suites | Exit 0; 57 passed, one guarded deployed-staging operator case skipped                |
| Same fresh clone, local complete harness, ports 3111/8789                  | C4 platform-connected and platform-knowledge-connected suites                                                 | Exit 0; all 17 passed in 7.1 minutes; providers and queues off                       |

The 100-node canvas measured 60.32 FPS against 55; the 500-node canvas measured
60.26 FPS against its unchanged 30 threshold. The verification clone retained
the four screenshot/FPS report outputs emitted by those suites. They were not
author source changes or assertion-baseline updates; no golden or threshold was
changed. The connected cleanup retained 18 synthetic users because deletion is
blocked. The owned process tree was stopped and both ports were confirmed free.

The fresh database pre-step first encountered two outside-Git parser failures:
one expected a table when the CLI emitted JSON, and the other expected JSON when
the explicit output option emitted a backtick-quoted table. Both were retained,
and no database test had run in those failed guards. Parsing both observed
formats established exact parity before the successful database test.

## Deploy checkout and schema boundary

Clean new clone `C:/dev/mbv-deploy-658cd50`, local main at the full merge SHA,
one worktree; frozen installation exit 0. Only `.env.example` and
`.dev.vars.example` files existed, including the Worker examples. The first
environment-file diagnostic failed on Windows path separators; normalization
confirmed that only those allowed examples existed before any deploy.
`git diff --quiet` between reviewed head and merge exited 0, so C4 checks cover
the byte-identical merged tree. No build-time override or environment pull.

From live web source `1db863c7dac147da044a60b802e37f4f8415d819`, the runtime diff
changes public metadata and request-relative auth callbacks, plus local-only
test harness code and tests. Core, collaboration, shared runtime contracts and
migrations are unchanged. This web release adds no dependency on an unapplied
remote table, column, function, policy or RPC. Workers were not deployed.

At the pre-release read, staging and production were still Ready on the prior
web source, with no recent competing deployment. Their fresh rollback targets
were recorded before this release: staging `dpl_FP3cE5nNaBoAxiFCCeLvVjCJ8uJW`,
production `dpl_96beiXaCW9ZCL4HxAa3EG7GqCpyC`. Neither was used.

## Staging

`vercel deploy --prod --yes --scope ashrunscode-projects --project
mustbeviral-web-staging`, from the clean merge checkout, start
2026-10-03T07:01:46.3185870Z, end 2026-10-03T07:02:37.1254566Z, exit 0:
`dpl_HWP8wh8sDzBNDZQijK9uXittJiZf`. Both staging aliases moved automatically.
Vercel metadata independently reports source
`658cd50cc48906262bf24ec08e84b7d768cce481` and Ready state.

Signed-out read-only C8 smoke at 07:04:01.723Z passed all 14 routes, the eight
indexed routes' exact canonical and social/hreflang URLs, JSON-LD identifiers,
social images returning PNG, sitemap, robots and llms links, expired reset and
studio redirects, request-origin callback, not-found 404 and Core health 200 ok.
No public response set a cookie. Served HTML identified the new deployment.

Browser proof at 07:04:59.574Z: all 28 route/width cells at 375 and 1280 passed,
one main, h1 28 px, no horizontal scroll, no console errors and no form submitted.
The initial browser diagnostic incorrectly looked for the deployment marker as
a hydrated DOM attribute; the marker belongs to served HTML. The corrected
diagnostic checked the navigation response HTML and retained the original
failure. This was a diagnostic error, not a deployed route failure.

## A4 public environment record

Names/targets-only listing found exactly one `NEXT_PUBLIC_APP_ORIGIN` record,
targeting Production only, at 07:01:12.1383605Z and again just before the update.
The authorized command was exactly:

`vercel env update NEXT_PUBLIC_APP_ORIGIN production --project
mustbeviral-web-production --scope ashrunscode-projects --value
https://mustbeviral.com --yes`

Start 07:05:49.9059005Z, end 07:05:52.1278539Z, exit 0. The immediate journal
entry names this one record and PR #67. The names/targets-only relist at
07:05:53.6509652Z again found one record, Production only. No other variable was
changed. This public value is the only environment value recorded here.

## Production

The same merge commit and clean checkout were deployed with
`vercel deploy --prod --yes --scope ashrunscode-projects --project
mustbeviral-web-production`, start 2026-10-03T07:06:36.3104954Z, end
2026-10-03T07:07:27.0375121Z, exit 0: `dpl_CHf1B4RTTcHMRVpAkSvjKQPuQx9b`.
Vercel metadata reports the exact source and Ready state. `vercel inspect`
confirmed all four aliases moved without promotion: apex, www, the public
production Vercel alias and the protected long production alias. The protected
alias was inspected only.

The same full signed-out C8 smoke passed on apex at 07:09:04.750Z, www at
07:09:10.304Z and the public production Vercel alias at 07:09:14.658Z. Each
served the expected deployment and all 14 routes. Public SEO URLs use the apex;
auth redirects use the request origin. Browser proof on apex at 07:09:13.566Z
passed all 28 route/width cells at 375 and 1280, with one main, h1 28 px, no
horizontal scroll, zero console errors and no form submission.

## Migration state and unfinished acceptance

Read-only Supabase migration lists on October 3 show staging with 50 recorded
entries, newest `20260917223105`, and production with 39, newest
`20260902154759`. Main and the local lane contain 75 migrations through
`20260929017000`. The first production-list read had a connector connection
failure; its single retry succeeded. Matching names or counts alone do not prove
staging schema parity. D6's classified migration release pack remains required.
No remote migration or SQL write occurred.

`public-surfaces` remains pending until A6 and D2, including poster-LCP evidence.
`primary-flows` remains pending. `release-smoke` has two stops, so its single-stop
alternative is not satisfied: the founder credential input and the production
schema lag. No Auth identity was queried and no remote sign-in was attempted.
The earlier SQL test 00043 assertion 52 failure remains unexplained; current
passing runs do not establish a repair. Its scope-limited proposal is prepared
in `owner-pack-knowledge-fixture-2026-10-03.md`.

## Not crossed

No remote database write, sign-in, user creation, queue/provider run, generation,
charge, signup collection, email, posting, CRM action, DNS, domain setting,
Worker setting, new resource, new visitor-facing Spanish, secret load or
disclosure, deletion, rollback, force-push, history rewrite or hook/ruleset
bypass. PR #1 was untouched. The canonical checkout remained read-only.

## Owner queue

- Founder smoke: the prepared `owner-pack-founder-smoke-2026-10-03.md` still
  needs its one named bundle input and confirmation that the founder exists.
- Public Auth configuration: `owner-pack-public-auth-origin-2026-10-03.md`
  prepares the owner action: Set Site URL to https://mustbeviral.com and add
  https://mustbeviral.com/auth/callback to the redirect allow-list on
  mustbeviral-prod.
- SQL fixture scope: `owner-pack-knowledge-fixture-2026-10-03.md` prepares the
  one exact path amendment. Its question is pending; no approval was inferred.

The remote schema lag, connected-staging spend, legal/Spanish/brand inputs and
feature enablement remain carried obligations. Their complete owner packs and
exact clearing inputs are still to be assembled under the brief; this release
does not claim those packs or their acceptance finished.

## Parked

None. The unamended SQL fixture is an owner-scope item, not a repaired or parked
defect. No acceptance row is advanced.

Next action: release the two authorized production Core origin additions under A6.
