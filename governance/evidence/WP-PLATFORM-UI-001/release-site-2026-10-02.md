# Release record, public site, 2026-10-02

Packet `WP-PLATFORM-UI-001`, owner directive of 2026-10-02 (public site,
`owner-directive-2026-10-02c.md`), under `adr-0009-standing-release-authority`. No environment value
is stored here. The run record is `public-site-2026-10-02.md`; the review record is
`merge-review-site-2026-10-02.md`.

## Git

- Pull request ashrunscode/MustBeViral#63, branch `codex/public-site-finish`, base `e058983`.
- Commits, in order: `79134f9` (the legal pages, the footer, the Full Package lines, the pricing
  page, the one design system, the regenerated documents), `ba80956` (evidence), `043c133` (first
  review repair, one privacy sentence), `00e1991`, `e73f937` and `8c989a5` (evidence), `b58ec3c`
  (second review repair, one privacy sentence with its unit test).
- Reviewed head `b58ec3c4bdb726bc8488fcaa671e5b3c428e2c68`: round 1 on `ba80956` FAIL, repaired;
  round 2 on `8c989a5` FAIL, repaired; round 3 on `b58ec3c` PASS with one P3 on the run record's
  wording, corrected in the docs change that adds this record. GitHub reported the head mergeable
  and clean (GitGuardian success, CodeRabbit success, Cursor Bugbot neutral). Merged by the
  repository's normal merge as `1db863c7dac147da044a60b802e37f4f8415d819` at 2026-10-02T20:24:48Z.

## Gates

On the code heads `79134f9`, `043c133` and `b58ec3c`: `public-site-2026-10-02.md`, "Gates" (author
clone `agent:verify`; fresh single-worktree clones with frozen install, `pnpm verify` and
`pnpm supabase:test` all 0, 1181 database tests; web typecheck, lint and `pnpm verify` 0 on the
second repair; 356 web unit tests; 112 preview and 17 connected journeys).

## Staging

Rollback target before: `dpl_HK4J6VQAPKx8Hp8ymxjGUwsLfXbg`, still Ready. No other release to the
target was in progress.

`vercel deploy --prod --yes --scope ashrunscode-projects --project mustbeviral-web-staging` from the
clean clone root `C:\dev\mbv-deploy-1db863c` (a `--no-local` clone of GitHub at `1db863c`, branch
`main`, no change, `.env.example` and `.dev.vars.example` the only env-like files), operator account
`ernijsansons`, start 2026-10-02T20:25:15Z, end 20:25:59Z, exit 0:
`dpl_FP3cE5nNaBoAxiFCCeLvVjCJ8uJW`
(`https://mustbeviral-web-staging-jwsyuul3g-ashrunscode-projects.vercel.app`). The alias
`https://mustbeviral-web-staging.vercel.app` moved to it without a promote.

Smoke at 20:26:17Z, forty checks, all passing: `/`, `/es`, `/pricing`, `/software`,
`/software/pricing`, `/privacy`, `/terms`, `/advertising`, `/login`, `/signup`, `/forgot-password`,
`/verify-email`, `/maintenance` and `/unauthorized` HTTP 200 with their markers, the not-found page
404, `/sitemap.xml` listing `/advertising`, `/llms.txt` carrying the legal links, `/robots.txt`
disallowing `/studio`, `/studio` signed out 307 to `/login?next=`; on `/` the footer entity, the
unpublished street address, the privacy and pricing links, the full Full Package list and the six
rows, and no software link in the studio header; on `/es` the English note and the approved Spanish
Full Package sentence with no new Spanish; no studio link in the software header; the footer on
`/login`; `/privacy` carrying the unpublished street address and the repaired cookie sentence; no
`Set-Cookie` header on any of the eight public paths; `/api/core/health` HTTP 200; the served HTML
carrying `data-dpl-id="dpl_FP3cE5nNaBoAxiFCCeLvVjCJ8uJW"`. Browser pass on the ten public routes at
375 and 1280: twenty cells, none with horizontal scroll, each with one `main`, the h1 at 28px, the
footer entity and address and the three legal links; `/privacy` at 375 carries the repaired
sentence and not the old one; no console error.

## Production

Rollback target before, still Ready and not used: `dpl_Bw8Txy9Atvk8yoBocUxv3AEZW5EN`
(`https://mustbeviral-web-production-9trdq2f1z-ashrunscode-projects.vercel.app`).

`vercel deploy --prod --yes --scope ashrunscode-projects --project mustbeviral-web-production` from
the same clean clone root, start 2026-10-02T20:27:19Z, end 20:28:19Z, exit 0:
`dpl_96beiXaCW9ZCL4HxAa3EG7GqCpyC`
(`https://mustbeviral-web-production-j5338yfyq-ashrunscode-projects.vercel.app`). `vercel inspect`
lists its aliases as `https://mustbeviral.com`, `https://www.mustbeviral.com`,
`https://mustbeviral-web-production.vercel.app` and
`https://mustbeviral-web-production-ashrunscode-projects.vercel.app`; all four moved to it without
a promote.

Smoke at 20:28:38Z on `https://mustbeviral-web-production.vercel.app`: the same forty checks pass,
the served HTML carries `data-dpl-id="dpl_96beiXaCW9ZCL4HxAa3EG7GqCpyC"`, `/api/core/health` HTTP 200.

**mustbeviral.com serves the new deployment.** `https://mustbeviral.com` (20:28:54Z) and
`https://www.mustbeviral.com` (20:29:26Z) each pass the same forty checks and carry
`data-dpl-id="dpl_96beiXaCW9ZCL4HxAa3EG7GqCpyC"`; none of the eight public paths sets a cookie on
either host. Browser pass on `https://mustbeviral.com`, ten routes at 375 and 1280: twenty cells,
all HTTP 200 on their own URL, none with horizontal scroll, one `main`, h1 28px, the footer with
entity, address and the three legal links on each; no animation running on `/`, `/es` or
`/pricing`; the studio page's visible text is 2300 characters with and without reduced motion;
`/privacy` at 375 carries the repaired cookie sentence; no console error. The domain was already
attached to the production project; no domain, DNS, traffic or cutover setting was changed. The
alias `https://mustbeviral-web-production-ashrunscode-projects.vercel.app` sits behind Vercel's
deployment protection, so it was not smoked directly; `vercel inspect` confirms it points at the
same deployment.

## Workers

Not deployed. The Core Workers already run the sources of `20b6e1e` (`cutover-2026-10-02.md`), and
the diff from `20b6e1e` to `1db863c` over `apps/core` and the shared packages is empty, so the
pre-deploy check would show no change at all, not a compatibility-flag change alone. The next
action no longer lists a Worker blocker.

## Not crossed

No DNS, domain, traffic or cutover change; no new variable and no environment value copied or
printed; no production database write; no signup collection, generation, charging, posting or
provider spend; no email sent and no form added; no Higgsfield call, no spend and no film (neither a
Higgsfield MCP tool nor the `mustbeviral-higgsfield` vault bundle exists on this workstation, and
the vault inbox holds no `HF_API_KEY_ID` or `HF_API_KEY_SECRET`); no signed-in smoke (the grant
names founder@mustbeviral.com, and the vault holds no credential for it); no deletion of data,
branches, backups or another session's work; nothing under `briefs/` or `.playwright-mcp/`
committed.
