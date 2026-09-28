---
doc_id: adr-0009-standing-release-authority
---

# ADR-0009: Standing owner release authority for local agents

## Status

Accepted on 2026-09-28 by the owner's instruction that agents "can push, merfge, commit deploy etc,
just be mingful on not messging things up", repeated for this and all other projects. The
authorization record, with the full verbatim messages, is
`governance/evidence/WP-PLATFORM-W2-002/owner-release-authority-amendment-2026-09-28.yaml`. This
decision extends `adr-0006-agent-publication-credentials` from publishing to merging and deploying.
ADR-0006 stays in force and is not widened.

## Decision

Local agents on the owner's workstation may commit, push, open pull requests, merge and deploy this
repository without asking again. Each merge passes the merge gates in `quality-gates`. Each deploy
follows the guarded release in `deploy-rollback-incidents`. This standing approval is the deployment
approval that runbook requires. Cloud-hosted agents do not hold this authority and never receive
credentials.

A deploy ships a commit already merged into the active packet branch to an existing V2 target. The
existing targets are the staging and production Core and collaboration Workers and the staging and
production web projects. A deploy changes code only. The active packet's
`external_effects.remote_mutation: authorized` means this guarded release. Any other remote mutation
needs the packet to name it exactly.

## Not covered

Each of these still needs a dated owner sentence naming the exact action:

- Legacy V1 production, which stays `preserve_until_v2_cutover`, and cutover, public traffic
  activation, DNS, custom domains, routes and `workers.dev` reachability.
- Production database writes, including production migrations. A production deploy that depends on
  an unapplied production migration waits for that sentence.
- Secrets, environment variables, provider and project settings, and enabling features, catalog
  entries, queues, provider execution, charging or a Stripe mode.
- New cloud resources, spend, email or SMS, public posts, package or app-store publishing, and
  repository visibility.
- Deleting data, branches, backups, rollback material or other sessions' work. Force-push and
  history rewrite.

Remote destructive actions stay `forbidden` in `PROJECT_STATE.yaml`. Where later allowed, they still
require state and packet authority naming exact resources, plus rollback evidence. These still bind:
packet, freeze, state and lead-only rules; a task that says not to push or deploy; and the carried
WP-P3-009 release obligations in `quality-gates`.

## Consequences

- Every merge and deploy leaves evidence: the checked commit, commands and exit codes, reviewer and
  reviewed head, rollback target, deployed version and smoke results.
- As of 2026-09-28, GitHub enforces no branch protection, rulesets or Actions checks on this
  repository. The recorded local merge gates are the enforcement. Restoring protection or Actions is
  a GitHub settings decision for the owner.
- A deploy whose smoke check fails is rolled back to its recorded target in the same release and
  recorded as an incident.
