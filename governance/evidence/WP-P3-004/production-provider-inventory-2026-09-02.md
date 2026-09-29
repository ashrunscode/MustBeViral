# V2 production provider inventory — WP-P3-004

Recorded: 2026-09-02  
Mode: authenticated read-only inspection; no remote mutation

## Inventory

| Surface                             | Source status  | Current fact                                                                                                                                       | Release consequence                                                                                                                                      |
| ----------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase organization               | LIVE           | `cwsipbaunvifcpgoygsc`, region policy `us-east-1`                                                                                                  | Exact organization is known.                                                                                                                             |
| Supabase V2 staging                 | LIVE           | `mustbeviral-staging`, ref `lqvigvzqumpwfjikcvws`, `ACTIVE_HEALTHY`                                                                                | Staging only; it is not production.                                                                                                                      |
| Supabase V2 production              | NOT CONFIGURED | No project named `mustbeviral-prod` exists                                                                                                         | Production data/auth cannot deploy. Project creation has a separate cost-confirmation gate.                                                              |
| Supabase migration history          | BLOCKED        | Linked staging has 37 local-only and 40 remote-only migration versions, with zero matching versions                                                | Never promote or repurpose staging. A fresh production project must apply the accepted local chain and prove RLS independently.                          |
| Cloudflare production R2            | NOT CONFIGURED | `mustbeviral-v2-production-media` does not exist                                                                                                   | Core production deployment remains blocked.                                                                                                              |
| Cloudflare production Core          | NOT CONFIGURED | `mustbeviral-v2-production-core` returns API code 10007                                                                                            | No V2 production API exists.                                                                                                                             |
| Cloudflare production collaboration | NOT CONFIGURED | `mustbeviral-v2-production-collaboration` returns API code 10007                                                                                   | No production collaboration Worker exists.                                                                                                               |
| Cloudflare staging collaboration    | LIVE           | version `92255439-310e-4803-a2ac-864008053882`                                                                                                     | Staging remediation is independently verified.                                                                                                           |
| Cloudflare staging queue            | LIVE           | `mustbeviral-v2-staging-outbox-dispatch`, ID `30827c486e304b09b1cdbbdcaf22a37f`                                                                    | Staging only; no production queue exists.                                                                                                                |
| Vercel V2 staging                   | LIVE           | `mustbeviral-web-staging`, project `prj_SVRV9Oh6J3lAi3muIbK9Mrtkvv6V`, team `team_A11dbY2xnTWzGL63IRBTWmLo`                                        | Staging only.                                                                                                                                            |
| Vercel V2 production                | NOT CONFIGURED | `mustbeviral-web-production` does not exist                                                                                                        | Production web deployment remains blocked.                                                                                                               |
| Public DNS                          | BLOCKED        | `mustbeviral.com`, `www.mustbeviral.com`, and `api.mustbeviral.com` returned no A, AAAA, or CNAME records                                          | No custom-domain cutover is permitted.                                                                                                                   |
| Production runtime secrets          | NOT CONFIGURED | Approved loader has no Stripe, Resend, Sentry, fal, Moonshot, OpenRouter, Vercel-token, or Cloudflare-token values                                 | Charging, email, telemetry, generation, and Core deployment remain fail-closed. OAuth-based Cloudflare and Vercel sessions are authenticated separately. |
| Git delivery branch                 | BLOCKED        | Local branch is ahead of and two commits behind its remote; open PR 2 carries stale P0 recruiting evidence; `main` has no GitHub branch protection | Reconcile without rewriting history before publishing or merging.                                                                                        |

Legacy D1/R2/Vercel resources remain present and untouched. Their existence is
rollback context, not V2 readiness.

## Release decision

`NO-GO` for production deployment or traffic. Repository verification can be
green while all rows above remain operationally incomplete; missing sources are
not converted to passes.
