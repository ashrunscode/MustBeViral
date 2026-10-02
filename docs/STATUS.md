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
| Launch customer | `brand_operators_and_multi_brand_studios` |
| Phase | P4 — V2 interface program across public, studio, brand, campaign and content surfaces (in_progress) |
| Active packet | `WP-PLATFORM-UI-001` |
| Current step | `ui-008-release` |
| Release target | `full-platform` |
| Pending decisions | None |
| Blockers | None |
| Remote destructive action | `forbidden` |

## One next action

Staging cannot serve the merge commit until NEXT_PUBLIC_APP_ORIGIN, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and NEXT_PUBLIC_CORE_API_URL exist on mustbeviral-web-staging; the sentence that clears it is permission to set those four names on mustbeviral-web-staging from the values already on production, after which the staging deploy, smoke and production promotion of 59a3618 proceed through the guarded procedure.
