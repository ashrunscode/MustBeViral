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
| Phase | P0 — Real Meta Campaign Launch Pack vertical slice and private MCP proof (in_progress) |
| Active packet | `WP-P0-001` |
| Current step | `p0-005-golden-launch-pack-runs` |
| Release target | `P0` |
| Pending decisions | None |
| Blockers | A launch pack cannot complete. Five remaining execution-engine defects, none of them operator inputs. Adaptation and motion nodes carry no prompt material; create_quote hardcodes ready=true so graph edges are validated but never scheduled; the OpenRouter copy route has no terminal advance, no artifact and no capture; a succeeded copy attempt makes every later fal webhook in the same run fail on a NaN capture and 503-loop; and nothing ever produces approved_output, so create_export can never succeed. Tracked as Tracks C-F of the completion plan. The sixth defect is closed - signed artifact-access capabilities now give the 10 image-to-image and image-to-video nodes a fetchable private-R2 input, proven live by fal fetching one and returning a real edit; evidence in governance/evidence/WP-P0-001/signed-artifact-access.md.; Provider route identity and queue polling were both wrong and only live probing found either. The pinned Kontext application fal-ai/flux-kontext/pro does not exist on fal (its result reads back 404 "Path /pro not found"), which would have failed all 9 adaptation nodes after the 3 masters they depend on were paid for; and the driver constructed queue status/result URLs by appending to the full submit endpoint, which 405s for every route except flux-2-pro, so the reconciler could never observe a paid Kontext or Seedance artifact. Both are fixed and pinned by tests; see governance/evidence/WP-P0-001/signed-artifact-access.md section 4. The remaining lesson is that fal's queue returns 200 IN_QUEUE for any submit body and validates only at execution, so no submit-time success proves a route is callable.; Two settlement holes that must close before further spend. Confirmation tokens are not verified (any string of 16 or more characters satisfies the paid-run human-consent gate, which contradicts the MCP rule that tool descriptions cannot imply autonomous spending), and reconciliation_required has no exit transitions while refund is implemented with zero callers, so customer funds can be held with no recovery path.; The web product does not exist yet. apps/web makes zero HTTP requests to the Worker; all seven screens run on in-memory fixtures; there is no sign-in surface; and packages/contracts declares no response schemas, so no typed client can be built until that contract is closed.; P0 exit is gated on people rather than code. It needs 5-8 paid evaluator sessions (all eight slots still PENDING) and one signed paid pilot. Recruitment runs in parallel; sessions must not be held against fixtures.; The P1a charging model must enforce the fully-landed margin guardrail (at most $1.82 per pack for 60% margin), not the looser $5 gate. |
| Remote destructive action | `forbidden` |

## One next action

Fix the six execution-engine defects that prevent a launch pack from completing, in money-safety-first order, then climb the metered spend ladder ($0.04 signed-URL probe, $0.0004 copy-only money-path proof, $0.075 approval/export, $0.67 one full pack, ~$13 for 20 briefs). The quote path is proven 20/20 on staging at 4,550,000 micros and all four launch routes are gate-open per the 2026-07-29 amendment to governance/evidence/WP-P0-001/environment-provisioning.md section 4 (operator inputs are listed in section 5; the previous pointer to section 6, the 2026-07-20 execution record, was wrong).
