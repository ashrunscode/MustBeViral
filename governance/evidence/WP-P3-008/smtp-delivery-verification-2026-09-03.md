# WP-P3-008 owner email delivery verification, 2026-09-03

Resolves `BLOCKED_AUTH_EMAIL_DELIVERY_NOT_CONFIGURED`. Identifiers, hosts, ports, statuses, and
booleans only. No SMTP password, Resend API key, Supabase key, session token, or signed URL is
recorded here or was printed while producing this evidence.

## What was authorized and done

The operator configured a zero-spend custom SMTP provider on Supabase project
`jjgtlfblsfobdhmtngbz` and then sent the one authorized owner invitation. The packet's original
`next_action` asked for SMTP configuration _without_ sending a test email; the operator instead
sent the single authorized invitation itself, which is the one email the packet already
authorized. No additional or throwaway test message was sent.

## Independently verified in this session

Read back from the Supabase Management API (`GET /v1/projects/jjgtlfblsfobdhmtngbz/config/auth`):

| Setting              | Value                                                                |
| -------------------- | -------------------------------------------------------------------- |
| `smtp_host`          | `smtp.resend.com`                                                    |
| `smtp_port`          | `465`                                                                |
| `smtp_user`          | `resend`                                                             |
| `smtp_sender_name`   | `Must Be Viral`                                                      |
| `smtp_admin_email`   | `hello@mustbeviral.com`                                              |
| `disable_signup`     | `true`                                                               |
| `mailer_autoconfirm` | `false`                                                              |
| `site_url`           | `https://mustbeviral-web-production-ashrunscode-projects.vercel.app` |

Enrollment therefore remains closed and unconfirmed-by-default, and the site URL still names only
the SSO-protected provider alias. No custom domain appears in Auth configuration.

## Operator-reported, not independently verified in this session

The following come from the operator's Supabase and Resend consoles. They are recorded as reported
and are **not** corroborated by a query run from this session:

- Supabase auth log at `16:37:02Z`: `POST /invite` returned `200` with an empty `error` field,
  creating user `574eaf95-316b-4cf1-bea1-70bd199292f3`. No `535` credential failure.
- Resend reports the "You've been invited" message to `hello@mustbeviral.com` as **Delivered**,
  meaning the receiving Google Workspace tenant accepted delivery rather than merely accepting the
  message for sending.
- Resend domain `mustbeviral.com` is verified in `us-east-1` with link tracking disabled.
- DNS on `mustbeviral.com` carries DKIM x2, SPF x2, and DMARC `p=none`, live and aligned.
- `auth.users` holds exactly one row, `hello@mustbeviral.com`, invitation pending acceptance.

**Why the gap:** the `supabase` MCP server available in this session is bound to project
`gqnpqnlpybjeesahqmkj`, a different product's database. Querying `auth.users` on
`jjgtlfblsfobdhmtngbz` requires either the service-role key, which lives only in Worker secrets, or
the database password, which is not present in this environment. Neither was retrieved, and no
query was run against the wrong project. Closing this gap needs a sanitized count run by the
operator or by a session holding those credentials.

## The one new Auth row is the owner, not a customer

`disable_signup` is `true`, so no self-service enrollment occurred or is possible. The row was
created by an explicitly authorized admin invitation to the approved owner address recorded in the
2026-09-02 pre-send gate. Generation, provider routes, queues, and customer charging all remain
disabled, and no workspace, membership, project, quote, run, attempt, provider job, artifact,
reservation, ledger row, outbox event, Stripe event, or billing profile was created.

## `no-legacy-or-dns-mutation`, re-expressed honestly

That acceptance criterion was recorded `passed` on 2026-09-02 against a before/after inventory
proving no legacy resource, custom domain, DNS record, route, customer row, provider run, or charge
had changed. Five mail-authentication DNS records have since been added to `mustbeviral.com`.

The criterion exists to protect legacy V1 traffic and routing from being disturbed before an
authorized cutover. That protection is intact and is what remains proven: no A record, CNAME,
route, or custom-domain attachment changed; `mustbeviral.com` and `www.mustbeviral.com` still serve
the legacy Cloudflare surface; `api.mustbeviral.com` is still NXDOMAIN.

The literal wording is nevertheless now broader than the truth. Per `AGENTS.md`, re-expressing an
already-accepted criterion is not something this packet decides on its own, so it is recorded here
and carried in the packet handoff as a pending decision rather than silently rewritten.

## Effect on the packet

The email-delivery blocker is cleared. It is replaced by a narrower and different precondition: the
invitation is **pending acceptance**, so production Auth still has no signed-in session. The
packet's authenticated database/RLS smoke therefore remains unproven. See
`production-binding-and-smoke-2026-09-02.md`, section "Status update, 2026-09-03".
