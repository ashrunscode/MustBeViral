# Public web release attempt — 2026-09-30

This records a failed staging release of the public pages. It does not accept
WP-PLATFORM-W3-001. No environment values are stored here.

## Git

- Pull request #52 merged as `08d09def6ae06172c7b50960267663bc719a064c`.
- Pull request #53 merged as `8e05406718cd0cb6719c1a08572765cfee3eb21b`.
- Owner sentence the same day: "all approve, push it live."

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

After the rollbacks, `https://mustbeviral-web-staging.vercel.app/` returned HTTP 200 and the previous page.

## Not done

- `mustbeviral-web-production` was not deployed.
- `mustbeviral.com`, DNS, and the legacy Vercel projects were not changed.
- No Worker, migration, secret, or project setting was changed.
