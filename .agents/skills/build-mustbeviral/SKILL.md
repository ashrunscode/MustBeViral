---
name: build-mustbeviral
description: Implement, verify, or hand off the active MustBeViral work packet.
---

# Build MustBeViral

Follow root `AGENTS.md` for behavior and run `pnpm agent:preflight` for packet work. Use the active packet's current step, allowed paths, authority references, acceptance, and external-effects policy. Read the authority sections that govern this step rather than the entire project library.

- Preserve the accepted ViralGraph V2 cleanroom. Do not revive retired V1 code or create a competing product/status authority here.
- If preflight fails, the branch is wrong, or a required decision is absent, stop dependent implementation and record the actual blocker; do not guess through the gate. Continue independent work only within the packet's authority.
- Use packet-required specialist skills for their matching steps. Production UI requires the accepted design artifact; an already applicable approval need not be requested again. New infrastructure, provider activity, and live enablement retain their named gates.
- Preserve unrelated work, shared command/domain contracts, and generated transport projections. Include the affected tests and evidence with behavioral changes.
- Continue until the requested packet outcome is implemented and verified, or only a real external/owner dependency remains. Run `pnpm agent:verify` and every named packet check before acceptance.
- Use `pnpm agent:finish` only when all acceptance is proven and the successor is ready; otherwise use `pnpm agent:handoff` for product handoff. Owner-directed packet replacement uses the separate ADR-0008 amendment and audited supersession, never false completion.

For an owner-authorized instruction-only amendment, follow the root contract's scoped governance/skill checks without advancing product acceptance or transitioning the packet.
