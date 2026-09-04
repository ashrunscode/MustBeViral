# p3i-001 — Owner identity authorization (2026-09-04)

## Authorization

On 2026-09-04 the owner answered "yes on all 4" to a list that included "WP-P3-009 step one: the
owner sign-in that starts the 72-hour window". That is the fresh explicit authorization this step
requires. It names exactly one production owner identity:

- Email: `hello@mustbeviral.com` (an alias of the owner's `info@ashleyansons.com` mailbox; mail from
  the platform arrives from the sender name "Must Be Viral" and has been landing in Spam)
- Supabase Auth user id: `574eaf95-316b-4cf1-bea1-70bd199292f3` (project `jjgtlfblsfobdhmtngbz`)
- Surface: the SSO-protected Vercel alias
  `https://mustbeviral-web-production-ashrunscode-projects.vercel.app` (project
  `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team `ashrunscode-projects`), Core Worker on `workers.dev`.

No other identity is authorized. Signups remain disabled.

## Production Auth state before the session (Management API read, 2026-09-04)

| Field                                                | Value                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `site_url`                                           | `https://mustbeviral-web-production-ashrunscode-projects.vercel.app`                          |
| `uri_allow_list`                                     | `https://mustbeviral-web-production-ashrunscode-projects.vercel.app/auth/callback` (1 entry)  |
| `disable_signup`                                     | true                                                                                          |
| `mailer_autoconfirm`                                 | false                                                                                         |
| `security_captcha_enabled`                           | false                                                                                         |
| SMTP                                                 | `smtp.resend.com`, sender "Must Be Viral", admin `hello@mustbeviral.com`                      |
| Owner user                                           | created and invited 2026-09-03 16:37 UTC; `email_confirmed_at` empty; `last_sign_in_at` empty |
| `auth.sessions` / `auth.refresh_tokens`              | 0 / 0                                                                                         |
| `public.workspaces` / `public.workspace_memberships` | 0 / 0                                                                                         |

The 2026-09-03 invitation was never accepted (the one callback the owner reached ran on
`localhost:3000`, and no production session resulted). The redirect allowlist already contains the
alias callback, so no Auth configuration change is needed for the sign-in.

## Credential path chosen for p3i-002

A magic link (one-time email link) sent to the authorized identity with `redirect_to` set to the
allowlisted alias callback. The agent never sets or enters a password; the owner's own browser
session completes the exchange at `/auth/callback`, which expects a `?code=` PKCE parameter. The
Vercel SSO gate on the alias must already be satisfied in that browser; the agent does not sign in
to Vercel.

## Not done in this step

No provider run, quote, charge, signup, DNS, Worker, Vercel or database mutation. The only production
side effect of this step is one transactional email to the authorized owner mailbox.
