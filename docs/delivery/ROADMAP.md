---
doc_id: roadmap
---

# Delivery roadmap

| Phase | Outcome                                                                           | Exit evidence                                                                  | Estimated effort |
| ----- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------: |
| R0    | Cleanroom authority, continuity, toolchain, scaffold, GitHub governance           | Fresh-agent preflight, validators, clean install/build/tests, protected `main` |         2–3 days |
| D0    | Decision-complete product/architecture and approved UX; provider/latency evidence | Approved prototype, model evidence, RLS/Hyperdrive spike, golden briefs        |         3–5 days |
| P0    | Real Meta Campaign Launch Pack vertical slice and private MCP proof               | All P0 technical/product/economic/paid-demand gates                            |       10–14 days |
| P1a   | Secure paid single-user web product                                               | Production RLS, Stripe/wallet, email, operations, rollback, paid pilot         |        4–6 weeks |
| P1b   | Public API, MCP, CLI, user-authored Skills                                        | OAuth/scopes, three-client parity, public contract evidence                    |        2–3 weeks |
| P2    | Multiplayer collaboration and shared review                                       | Presence/comments/text sync/leases, revision checkpoint integrity              |        3–5 weeks |
| P3    | Scale, direct adapters, resilience, compliance                                    | Evidence-triggered services, DR/security rehearsal, margin/SLA improvement     |        3–5 weeks |
| P4    | Agency and enterprise expansion                                                   | Retention/economic evidence supports each expansion                            |  Evidence-driven |

## Sequence rules

- R0 authority precedes scaffold implementation; D0 design precedes production UI.
- P0 engineering completeness (real providers, private artifacts, last-mile onboarding, measurement instrumentation) precedes P1a paid-platform breadth.
- P0 human product-validation (qualified evaluator sessions, usable-concept votes, partner commitment, operator go/no-go) remains required to claim P0 validation success. It is a parallel human appendix and does not stall remaining accepted product implementation.
- P1a ships the paid web product before P1b expands programmable surfaces.
- P2 collaboration does not alter Postgres revision authority.
- Each optional P3 infrastructure addition needs a recorded trigger, benchmark, rollback, and accepted decision. P4 agency expansion stays deferred until DTC retention evidence exists.
- Failed P0 value, cost, or paid-demand evidence still blocks claiming validation success and blocks customer charging. It does not set the engineering next action to partner recruiting.

## Finish sprint

The remaining engineering sequence is P0 implementable product → P1a → P1b → P2. The paste-ready execution contract is `CODEX_FINISH_MEGA_PROMPT.md`. Successor packets live under `governance/evidence/WP-P0-001/successor-WP-P1A-001.yaml`, `successor-WP-P1B-001.yaml`, and `successor-WP-P2-001.yaml`.

## Phase handoff

Every engineering exit replaces the active packet with an already-defined successor, updates `PROJECT_STATE.yaml` and `STATUS.md`, records evidence, regenerates traceability, and leaves exactly one next action. Effort estimates assume one strong technical founder using coding agents full-time; human evidence gates are not compressed by parallelism and are not an engineering stall.
