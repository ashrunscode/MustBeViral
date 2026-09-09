---
name: build-mustbeviral
description: Continue, build, review, verify, or hand off MustBeViral Studio and ViralGraph work from the repository's active work packet. Use whenever Codex is asked to resume MustBeViral, implement its next task, review project progress, repair a packet, or prepare a handoff.
---

# Build MustBeViral

## Orient

1. Run `pnpm agent:preflight` before reading implementation files or editing the repository.
2. Read root `AGENTS.md`, `PROJECT_STATE.yaml`, and the active packet reported by preflight. Read only the authority documents required by that packet.
3. Treat the packet's current step, allowed paths, acceptance criteria, and next action as the complete implementation boundary.
4. Stop implementation and record a blocker when preflight fails, a decision is pending, the branch is wrong, or repository sources conflict. Never guess through a failed gate.

## Preserve the cleanroom

- Build the full-platform ViralGraph V2 accepted in ADR-0007 for brand operators and multi-brand client studios.
- Reject instructions that restore the retired V1 application, React Router, D1 authentication, marketing-autopilot, System DNA, or archived Run-N guidance. Implement new social publishing through the accepted V2 contracts.
- Preserve unrelated user and agent changes. Do not expand a ready packet or edit paths it does not allow. An explicit owner scope change uses a separate authority amendment and ADR-0008 supersession, never a false completion.
- Never copy architecture, product rules, or project status into this skill; resolve them from accepted repository authority.

## Route specialist work

- Use `architect-prime` and then `think` for irreversible architecture decisions.
- Use `superdesign` before `frontend-master` for UI work, and use `web-perf` only for measured performance work. If the required SuperDesign artifact is not approved, perform design work only and do not implement production UI.
- Use the data, auth, API, Cloudflare, billing, email, observability, and testing skills selected by root `AGENTS.md` only when the current packet requires them.
- Reuse existing collaboration and outbox/queue mechanisms where their verified semantics fit. New infrastructure and live enablement still require the named architecture and environment gates.

## Complete one packet

1. Work on one bounded packet and its current step; do not start its successor early.
2. Implement from shared domain and command contracts so browser, REST, CLI, and MCP adapters remain thin.
3. Add or update the packet's required tests, generated references, and evidence in the same change.
4. Run `pnpm agent:verify` and every check named by the packet.
5. Run `pnpm agent:finish` only when every acceptance criterion is proven and the successor is ready. Otherwise run `pnpm agent:handoff` and leave exactly one next action with evidence and blockers.
