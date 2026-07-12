---
doc_id: local-env-secrets
---

# Local environment and secrets

## Supported workstation

The supported local path is Windows 11 with Git for Windows, PowerShell, nvm-windows, Node 24.18.0, Corepack/pnpm 11.12.0, GitHub CLI, Docker Desktop using WSL2 for local Supabase, and Stripe CLI. JavaScript platform CLIs are exact root development dependencies and run through `pnpm`; do not install competing global copies.

## First-time setup

1. Clone the repository and switch to the active packet branch reported by project state.
2. Install/activate Node 24.18.0 and enable Corepack.
3. Run `pnpm install --frozen-lockfile`.
4. Run `pnpm agent:preflight`; do not begin if it reports conflicting state, a blocker, or an out-of-scope working tree.
5. Start Docker Desktop only for local Supabase work.
6. Create ignored local environment files from generated environment documentation; never copy production values into local or preview environments.
7. Run the packet’s checks before and after work.

## Environment isolation

| Environment | Data/providers                                                          | Allowed purpose                                |
| ----------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| Local/test  | local Supabase, fake or provider sandbox credentials                    | development and automated tests                |
| Preview     | isolated non-production Supabase and disabled/strictly capped providers | pull-request review                            |
| Staging     | `mustbeviral-staging`, staging Worker/R2, test Stripe                   | migrations, integration, performance, rollback |
| Production  | `mustbeviral-prod`, production Worker/R2, live Stripe                   | approved customer traffic only                 |

No database, bucket, webhook signing secret, provider key, auth redirect, email identity, telemetry environment, or Stripe mode is shared between staging and production.

## Secret rules

- Never place secrets in chat, Markdown, YAML state, source, fixtures, logs, screenshots, command history, generated docs, or Git.
- Authenticate through provider CLI/browser flows or ignored local files. A secret pasted into chat is not assumed to exist in the shell.
- Validate environment variables through typed schemas at process start; missing or malformed values fail closed.
- Use least-privilege scoped identities, short lifetimes where possible, and separate machine/user roles.
- GitHub agents cannot receive repository-admin, workflow-admin, production-deploy, or delete-repository credentials.
- Production secret reads and rotations require an audited operator action. Rotation updates staging first, verifies dual-key overlap when supported, promotes production, and revokes the old value.
- Error reporting and traces redact authorization, cookies, signed URLs, prompts with sensitive customer data, provider payloads, and user-supplied personal data.

## Credential gates

Vercel, Supabase, Cloudflare, fal, Resend, Sentry, and Stripe credentials are external operator inputs. Packets blocked on a missing credential report the exact provider and capability; they never substitute another account, environment, mock presented as real, or unrelated project.
