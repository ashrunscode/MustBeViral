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

## Route specialist work

- Use `architect-prime` and then `think` for irreversible architecture decisions.
- Treat `brand/BRAND.md` as the design brief and `docs/ux/EXPERIENCE_CONTRACT.md` as the accepted UX authority. Use `frontend-design` to build UI, `web-design-guidelines` to review UI code, `design-qa-loop` before merging UI, and `core-web-vitals` only for measured performance work. If the required design frames are not approved under the visual approval gate in `docs/ux/EXPERIENCE_CONTRACT.md`, perform design work only and do not implement production UI.
- Use the data, auth, API, Cloudflare, billing, email, observability, and testing skills selected by root `AGENTS.md` only when the current packet requires them.
- Do not use P2 collaboration skills or queue infrastructure before the accepted evidence gate and phase authorize them.

## Available specialist guidance

The owner-approved execution-prerequisites amendment of September 28, 2026 replaces five
unresolved specialist aliases for W2-002 and its prepared W2-003 successor. It changes guidance
resolution, not acceptance, review independence or release permissions.

| Responsibility                                             | Guidance to read                                                                                  | Requirements retained                                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Database architecture (formerly `data-architect`)          | `../supabase-postgres-best-practices/SKILL.md` and its security, schema and locking references    | Additive migrations, composite ownership keys, forced RLS, cross-tenant denial and concurrency tests.                                        |
| Authentication/security (formerly `auth-fortress`)         | The same Supabase security guidance plus installed `api-webhook-contracts`                        | Independent auth/RLS review and the complete denial suite, including revoked grants, forged child IDs and queued work after permission loss. |
| API/interface design (formerly `api-and-interface-design`) | Installed `api-webhook-contracts` and `docs/architecture/API_MCP_AND_CLI.md` from repository root | Shared command/query handlers, generated contracts, thin transports, authorization, idempotency and failure semantics.                       |
| Frontend implementation (formerly `frontend-master`)       | Installed `vercel-react-best-practices` and `frontend-design`                                     | Approved Lightfield direction, durable state, accessible responsive behavior and applicable design approvals.                                |
| Quality verification (formerly `quality-check`)            | The active packet's checks, installed `design-qa-loop` and `git-release-quality`                  | Every required local and connected check, current independent review, exact-source evidence and truthful acceptance.                         |

Supabase guidance is vendored in this repository with pinned provenance. Resolve the other named
skills through the installed/shared skill catalog and read their actual `SKILL.md` sources before
matching work; their availability was verified on September 28, 2026. Do not silently omit a missing
source or treat the map as a substitute for reading it. The repository authorities take precedence
over generic guidance.

`superdesign` remains required and was located in the shared catalog. Installed guidance is not
proof that its external service or tools are callable. When those tools are unavailable, preserve
the accepted design artifacts and use the repository's existing render/QA path; new screens still
require approved desktop/mobile artifacts before production implementation.

## Complete one packet

1. Work on one bounded packet and its current step; do not start its successor early.
2. Implement from shared domain and command contracts so browser, REST, CLI, and MCP adapters remain thin.
3. Add or update the packet's required tests, generated references, and evidence in the same change.
4. Run `pnpm agent:verify` and every check named by the packet.
5. Run `pnpm agent:finish` only when every acceptance criterion is proven and the successor is ready. Otherwise run `pnpm agent:handoff` and leave exactly one next action with evidence and blockers.
