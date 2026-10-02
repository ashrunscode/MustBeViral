# Interface program authority amendment, 2026-10-01

Authority-only amendment under ADR-0008. It records the owner's 2026-10-01 directive, raises
`WP-PLATFORM-W3-001` to specification revision 2, and authorizes only the audited supersession
into `WP-PLATFORM-UI-001`. It implements no product change and claims no acceptance.

## What the owner instructed

The directive is recorded verbatim in `owner-directive-2026-10-01.md` (SHA-256
`55dfdf6ed0dde7c5262fef6e309a7631eb5e99126ba1892334bcf7ee07bc0c77`). It approves the V2 interface
program, the copy and visual direction already in the repository, the bug repairs, the commit,
push, pull request, merge and the deploy to the existing V2 targets, and it instructs that when the
active packet does not allow that scope, the first commit is an authority-only amendment followed
by supersession.

## Why W3-001 cannot host the work

- Its public interfaces state that no customer-visible route is enabled in that packet.
- Its allowed paths exclude `packages/ui/**`, `packages/domain/**`, `packages/db/scripts/**`,
  `playwright.config.ts` and `turbo.json`.
- It is blocked on real-media benchmark inputs that the interface program does not need.

## What this amendment changes

| Path                                                                                 | Change                                                                                                                                                |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/delivery/ACTIVE_WORK_PACKET.yaml`                                              | Specification revision 1 to 2; status `blocked` to `in_progress` for the transition only; blocker moved to carried obligations; ADR references added. |
| `PROJECT_STATE.yaml`                                                                 | Project and phase state `blocked` to `active`/`in_progress` for the transition only; blocker moved to carried obligations; next action named.         |
| `governance/evidence/WP-PLATFORM-W3-001/owner-directive-2026-10-01.md`               | Verbatim source plan.                                                                                                                                 |
| `governance/evidence/WP-PLATFORM-W3-001/owner-supersession-decision-2026-10-01.yaml` | Owner decision record for `pnpm agent:supersede`.                                                                                                     |
| `governance/evidence/WP-PLATFORM-W3-001/successor-WP-PLATFORM-UI-001.yaml`           | Ready successor packet with pending steps, acceptance and gates.                                                                                      |
| `docs/STATUS.md`, `docs/generated/TRACEABILITY.md`, `llms.txt`                       | Regenerated projections.                                                                                                                              |

## What is preserved

- The render blocker text is carried verbatim in the decision's obligations and in the successor
  objective. The benchmark is not run, the architecture decision is not made, and Wave 3 has not
  exited.
- Every W3-001 step stays unfinished and every acceptance criterion stays unproved; the
  supersession receipt records them.
- WP-PLATFORM-W3-002 and the roadmap's bounded execution rows remain owed.
- No deployment, environment, secret, provider, database or public traffic change is made by this
  amendment. The supersession receipt forces the successor's `external_effects.remote_mutation`
  to `none`; a separate authority-only revision records `approval-required` with the directive as
  the owner sentence before any release step.

## Verification for this amendment

Fresh single-worktree clone `C:\dev\mbv-ui-20261001` on local `main` at
`31f75deffaa450851f64a8c92ab541ccce5658ed`, Node 24.18.0, pnpm 11.12.0, frozen dependencies.
Governance checks, governance tests and formatting run before the commit; their exits are recorded
in the pull request and in the packet evidence.
