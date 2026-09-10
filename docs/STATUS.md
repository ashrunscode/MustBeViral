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
| Phase | P4 — Platform baseline, prototypes and feasibility (blocked) |
| Active packet | `WP-PLATFORM-W0-001` |
| Current step | `w0-002-baseline-and-recovery` |
| Release target | `full-platform` |
| Pending decisions | None |
| Blockers | Local Docker engine and Postgres unavailable; supabase:test fails to connect. Automatic approval review rejected exact dockerInference endpoint removal as blocked by policy. Operator recovery required; SQL repairs remain unverified. |
| Remote destructive action | `forbidden` |

## One next action

Restore local Docker/Supabase, apply the pending local migration and pass all 38 pgTAP suites before completing W0 and activating W1.
