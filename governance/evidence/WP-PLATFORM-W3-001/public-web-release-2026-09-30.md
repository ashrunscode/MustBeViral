# Public web release — 2026-09-30

This records the public-page release. It does not accept WP-PLATFORM-W3-001.
No environment values are stored here.

## Git

- Pull request #52 merged as `08d09def6ae06172c7b50960267663bc719a064c`.
- Pull request #53 merged as `8e05406718cd0cb6719c1a08572765cfee3eb21b`.
- That merge commit's tree is `2e7814904d2c7ab477803e9d661524adc0e5ad33`, the same tree as `2413dad545729f0039e04cd18b7cc61d0ce9ba0b`.
- Owner sentences the same day: "all approve, push it live." and "deploy 8e05406 to production".

## Gates

Clean clone, branch named `main`, frozen install.

- `pnpm verify` exit 0 on `5c964301e6957eb70485f7617d7434c9ece96132`.
- `pnpm supabase:test` exit 0 after `supabase start` in that clone. 61 files, 1180 tests.
- `pnpm verify` exit 0 and `pnpm supabase:test` exit 0 on `2413dad545729f0039e04cd18b7cc61d0ce9ba0b`.

## Staging

Rollback target before the attempt: `dpl_7RSv8TA8tzmY9MFc2Vgj7wwLQZCm`.

- `dpl_6kvCejNKn6LnkrN4MFse6VvTt9f2` from `08d09de` was promoted, returned HTTP 500 on `/`, `/es`, `/software`, `/software/pricing`, and `/signup`, and was rolled back.
- `dpl_AFArmav1uwv5biaqDLGVqSYc8vw3` from `8e05406` did the same and was rolled back.
- `dpl_EXGy9faj7nmT7sPAkpMyqmunC3Tc` was a cache-bypassed rebuild of `8e05406`. Authenticated fetch of its deployment URL returned `Internal Server Error`. It was not promoted.

The runtime error was a Zod failure: `NEXT_PUBLIC_APP_ORIGIN`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_CORE_API_URL` were undefined. `vercel env ls` for `mustbeviral-web-staging` shows those four names are absent. `mustbeviral-web-production` already has those four names. No variable was added, copied, or printed.

After the rollbacks, `https://mustbeviral-web-staging.vercel.app/` returned HTTP 200 and the previous page. It still did after the production deploy below.

## Production

Rollback target before the deploy, still Ready and not used: `dpl_3JzLZTGBaHPuiaFFWZneNxWgabs2` (`https://mustbeviral-web-production-jmz30ncwx-ashrunscode-projects.vercel.app`), aliased to `https://mustbeviral-web-production.vercel.app`.

Command, from a clean checkout of `8e05406718cd0cb6719c1a08572765cfee3eb21b` at the repository root. No `--cwd`, `--env`, `--build-env`, or project-setting change:

`vercel deploy --prod --yes --scope ashrunscode-projects --project mustbeviral-web-production`

- Operator account: `ernijsansons`.
- Start: `2026-09-30T12:27:54Z`. End: `2026-09-30T12:28:53Z`. Exit 0.
- Deployment: `dpl_21tfmmiva1M8Ju4AuX8hC6MAdbMk`.
- URL: `https://mustbeviral-web-production-n5l637c93-ashrunscode-projects.vercel.app`.
- Aliases: `https://mustbeviral-web-production.vercel.app` and `https://mustbeviral-web-production-ashrunscode-projects.vercel.app`.
- Migrations: none. Workers were not deployed. No secret, environment variable, project setting, DNS record, or custom domain was changed.

Smoke of `https://mustbeviral-web-production.vercel.app` after the alias moved:

- `/` HTTP 200, title "Must Be Viral". "We film Houston.", Test Shoot $700 one time, Full Package $3,500 a month, and two "Book a test shoot." links to `tel:+17138999346`. "Request access", "MustBeViral Studio", and "$500" are absent.
- `/es` HTTP 200. "Filmamos Houston." and two "Agende un test shoot." links to `tel:+17138999346`.
- `/software` HTTP 200. "You brief. Agents produce. You approve every dollar." The film loads `/software/p0-software-hero.mp4` (HTTP 200, `video/mp4`, 171771 bytes) and plays at 1920×1080.
- `/software/pricing` HTTP 200. "Software plans", $49, $149, and $399. No buy control.
- `/signup` HTTP 200. "Enrollment is closed" and "This screen collects nothing." No input, textarea, select, or form.
- `/login` renders the sign-in form.
- At a 390px viewport, `/`, `/es`, `/software`, `/software/pricing`, and `/signup` do not scroll horizontally.

`https://mustbeviral.com` stayed HTTP 200 with title MustBeViral.

## Not done

- Staging still lacks the four public environment names, so this build is not aliased there.
- `mustbeviral.com`, DNS, and the legacy Vercel projects were not changed.
- No Worker, migration, secret, or project setting was changed.
- The Spanish page text was owner-accepted. The brand registry still has no named fluent reviewer, so that registry entry stays draft.
- WP-PLATFORM-W3-001 is not accepted.
