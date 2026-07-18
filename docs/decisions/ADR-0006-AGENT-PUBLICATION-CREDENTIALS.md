---
doc_id: adr-0006-agent-publication-credentials
---

# ADR-0006: Authorize agents to use the operator GitHub publication credential

## Status

Accepted on 2026-07-17. Supersedes the blanket agent-credential prohibition previously stated in the `local-env-secrets` runbook.

## Decision

Agents may use the operator-provisioned GitHub CLI credential to publish, push, administer branch protection, and manage GitHub Actions workflows for this repository. Repository deletion and organization-level destructive actions still require an explicit, per-action operator authorization that names the exact resource. Remote destructive actions against project infrastructure remain gated by `PROJECT_STATE.yaml` and the active work packet naming exact resource IDs and rollback evidence.

## Rationale

The cleanroom must be publishable and branch-protectable by the same automation that builds it. The prior rule forbade agents from holding repository-admin, workflow-admin, or publication credentials, which blocked the required R0 publication and branch-protection actions with no safer path available in this single-operator setup. A single operator-owned credential, exercised under the packet plus `PROJECT_STATE.yaml` authorization model and recorded in Git history, is simpler and more auditable than a stalled manual-only path. Least-privilege remains the guidance; the two irreversible actions an agent could not undo — repository deletion and org-level destruction — keep an explicit per-action gate.

## Consequences

- `local-env-secrets` permits agent use of the operator GitHub credential for publication, push, branch protection, and workflow administration; repository deletion and organization-level destructive actions remain per-action gated.
- Branch protection on `main` (code-owner review, non-rewriting merges, and the `governance` and `quality` required checks) is the enforcement boundary for published history.
- Remote destructive actions against project infrastructure still require `PROJECT_STATE.yaml` plus the active packet to name exact resource IDs and rollback evidence, per `AGENTS.md`.
- Scoped identities and short credential lifetimes remain recommended where the operator can provide them.
