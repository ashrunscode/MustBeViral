# WP-P3-008 production before/after inventory

Captured 2026-09-02 on branch `codex/viralgraph-cleanroom`. Values below are identifiers,
counts, or booleans only. No credential value was printed or persisted.

## Exact target allowlist

| Provider          | Exact production target                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| Supabase          | `jjgtlfblsfobdhmtngbz` (`mustbeviral-prod`, `us-east-1`, `ACTIVE_HEALTHY`) |
| Cloudflare R2     | `mustbeviral-v2-production-media`                                          |
| Cloudflare Worker | `mustbeviral-v2-production-core`                                           |
| Vercel            | `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj` in `ashrunscode-projects`               |

The legacy Vercel projects `must-be-viral` and `mustbeviral`, legacy Workers
`mustbeviral`, `mustbeviral-staging`, and `mustbeviral-production`, and the existing V2
staging resources were inventory-only and were not mutated.

## Before and after

| Boundary               | Before                                                                                                                                                               | After                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Git                    | Correct branch; local history was 74 commits ahead and 3 behind the same-named remote branch                                                                         | Correct branch; history is preserved and no rebase, squash, reset, or force-push was used                                          |
| Supabase migrations    | 38                                                                                                                                                                   | 39; last is `20260902154759_production_disabled_binding_hardening`                                                                 |
| Database kill switches | signup false; charging false; generation true; provider routes true                                                                                                  | signup false; charging false; generation false; provider routes false                                                              |
| Supabase Auth users    | 0                                                                                                                                                                    | 0                                                                                                                                  |
| Customer/work rows     | 0 workspaces, memberships, projects, quotes, runs, attempts, provider jobs, artifacts, reservations, ledger rows, outbox events, Stripe events, and billing profiles | Same zero counts                                                                                                                   |
| Storage rows           | 0                                                                                                                                                                    | 0                                                                                                                                  |
| Security Advisor       | 19 classified findings: 0 error, 17 intentional authenticated `SECURITY DEFINER` warnings, 2 webhook-table policy infos                                              | Same classified set; 0 errors                                                                                                      |
| Performance Advisor    | 66 infos: 32 uncovered foreign keys, 6 `auth_rls_initplan`, 27 unused indexes, 1 Auth connection setting                                                             | 60 infos: 59 unused indexes and 1 Auth connection setting; uncovered-FK and initplan classes are zero                              |
| Production Core        | Did not exist                                                                                                                                                        | Worker ID `90bbdf6c78094d779754a28ebb1ec019`; current version `b832cca9-3dea-46d2-8313-eba80854c1ca`; workers.dev only             |
| Production R2          | 0 objects, 0 B, no custom domain, r2.dev disabled                                                                                                                    | Unchanged: 0 objects, 0 B, no custom domain, r2.dev disabled                                                                       |
| Production queue       | None                                                                                                                                                                 | None; only `mustbeviral-v2-staging-outbox-dispatch` exists                                                                         |
| Vercel project         | Exact project existed with no deployment, no custom domains, framework/root unset                                                                                    | Next.js, root `apps/web`; current READY deployment `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`; no MustBeViral custom domain                |
| Web access             | No production V2 deployment                                                                                                                                          | Provider deployment and team-scoped alias redirect to Vercel SSO; the unprotected short provider alias was removed and returns 404 |
| Legacy traffic         | `mustbeviral.com` and `www.mustbeviral.com` remained on the legacy Cloudflare surface                                                                                | Both still return 200 from the legacy Cloudflare surface; `api.mustbeviral.com` remains NXDOMAIN                                   |

No DNS API mutation, Cloudflare route attachment, custom-domain attachment, public R2 action,
customer admission, provider invocation, queue binding, Stripe/Resend action, or charge command was
issued. The public-DNS conclusion is backed by the unchanged legacy HTTP surface plus the mutation
ledger; the available Cloudflare credential did not expose a machine-readable zone-route listing.

## Addendum, 2026-09-03: authorized email-delivery remediation

The capture above remains a correct point-in-time record of 2026-09-02. The following authorized
changes occurred afterwards, on 2026-09-03, while resolving
`BLOCKED_AUTH_EMAIL_DELIVERY_NOT_CONFIGURED`. They supersede two rows and one closing sentence of
that capture, which are left intact above as the historical record.

| Boundary            | 2026-09-02 capture                 | 2026-09-03 after remediation                                                                                                         |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Supabase Auth users | 0                                  | 1 — the approved production owner identity, invitation pending acceptance                                                            |
| Project SMTP        | None; default SMTP refused         | Custom SMTP enabled: `smtp.resend.com:465`, user `resend`, sender `Must Be Viral <hello@mustbeviral.com>`                            |
| Public DNS          | Google Workspace mail records only | Three Resend delivery records added to `mustbeviral.com`; see the verified enumeration in `smtp-delivery-verification-2026-09-03.md` |

### DNS delta and its exact boundary

Three Resend delivery records were added to the `mustbeviral.com` zone: `resend._domainkey` TXT
(DKIM), `send.mustbeviral.com` TXT (SPF), and `send.mustbeviral.com` MX (bounce Return-Path). An
earlier summary here said "five records: DKIM x2, SPF x2, DMARC"; reading the zone first-hand
showed that count wrongly absorbed pre-existing Google Workspace records. These are
mail-delivery records only. **No A record, CNAME, traffic route,
custom domain, or Cloudflare route was created, changed, or removed.** Legacy V1 traffic is
therefore unaffected: `mustbeviral.com` and `www.mustbeviral.com` continue to serve 200 from the
legacy Cloudflare surface, and `api.mustbeviral.com` remains NXDOMAIN.

The 2026-09-02 closing sentence "No DNS API mutation ... or Stripe/Resend action ... was issued"
was true as written on that date. It does not describe 2026-09-03: a DNS mail-record mutation and
a Resend email delivery both occurred, under the authorization recorded in
`smtp-delivery-verification-2026-09-03.md`. The packet's `no-legacy-or-dns-mutation` acceptance is
re-expressed there in the terms it was actually meant to protect — legacy traffic and routing —
rather than being silently left as an unqualified no-DNS-change claim.

### Boundaries that did not move

Signup, generation, provider routes, and customer charging remain disabled. R2 remains at 0 objects
and 0 bytes with no custom domain and r2.dev disabled. No queue, no Cloudflare route, no custom
domain attachment, no provider run, no charge, and no destructive remote action occurred. Zero
customer rows were created; the single new Auth row is the approved owner, not a customer.
