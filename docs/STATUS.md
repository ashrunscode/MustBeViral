---
doc_id: project-status
---

# Current status

DO NOT EDIT — generated from `PROJECT_STATE.yaml` and the active packet.

| Field | Value |
|---|---|
| Product | MustBeViral Studio |
| Engine | ViralGraph |
| Generation | `viralgraph-cleanroom-v2` |
| Launch customer | `dtc_ecommerce_marketing_teams` |
| Phase | P3 — Disabled-behavior production environment binding (blocked) |
| Active packet | `WP-P3-008` |
| Current step | `p3h-004-private-smoke-and-cutover-gate` |
| Release target | `P0` |
| Pending decisions | None |
| Blockers | BLOCKED_AUTH_EMAIL_DELIVERY_NOT_CONFIGURED: A dashboard SMTP-saved claim for project jjgtlfblsfobdhmtngbz was treated as unverified. Official Management API Auth-config read-back is unavailable in this environment, so custom SMTP, host, user, sender, and secure transport remain unproven. Official inviteUserByEmail does not support PKCE and the deployed /auth/callback only exchanges a code. The single authorized invitation was not sent. |
| Remote destructive action | `forbidden` |

## One next action

On a trusted workstation already authenticated to the Supabase Management API, or after the documented agent-secrets loader provides a Management API token without pasting secrets into chat, read Auth config for project jjgtlfblsfobdhmtngbz as booleans only. Do not send the single authorized invitation until custom SMTP, host, user, sender, and secure transport are proven true and accepted authority records same-origin invite redemption on the existing /auth/callback. Official inviteUserByEmail does not support PKCE.
