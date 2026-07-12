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
- P0 proves user value with real providers and private artifacts before paid-platform breadth.
- P1a ships the paid web product before P1b expands programmable surfaces.
- P2 collaboration does not alter Postgres revision authority.
- Each optional infrastructure addition needs a recorded trigger, benchmark, rollback, and accepted decision.
- Failed P0 value, cost, or paid-demand gates cause a pivot/stop review rather than automatic progression.

## Phase handoff

Every exit replaces the active packet with an already-defined successor, updates `PROJECT_STATE.yaml` and `STATUS.md`, records evidence, regenerates traceability, and leaves exactly one next action. Effort estimates assume one strong technical founder using coding agents full-time; evidence and security gates are not compressed by parallelism.
