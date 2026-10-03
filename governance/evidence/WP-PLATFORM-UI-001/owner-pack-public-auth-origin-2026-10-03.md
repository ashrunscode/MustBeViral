# Owner pack: public Auth origin

Run: codex-finish-20261002

## Ready boundary

PR #67 made every public SEO URL use https://mustbeviral.com and made auth
callback redirects relative to the request origin. A4 changed exactly the
Production public-origin record on mustbeviral-web-production. The merged
source and staging/production signed-out smokes are recorded in
`release-public-origin-2026-10-03.md`.

This code release cannot establish Supabase Auth's Site URL or redirect
allow-list. Those settings remain owner-gated. They were not changed or claimed
correct here. No production identity was queried, no form submitted, no remote
sign-in or account creation attempted.

## One owner action

> Set Site URL to https://mustbeviral.com and add
> https://mustbeviral.com/auth/callback to the redirect allow-list on
> mustbeviral-prod.

Use the existing production Supabase project's Auth settings. Preserve other
allowed callback entries and record names/targets only. Do not copy a secret or
customer identity into evidence. The separate staging-isolation action must
precede any test that creates users or writes on staging; staging web currently
reads production services. A read-only founder smoke additionally needs its
named credential bundle and the production schema gate resolved.
