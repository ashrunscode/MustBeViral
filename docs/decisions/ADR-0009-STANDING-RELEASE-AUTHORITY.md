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

A deploy ships a commit already merged into the active packet branch to one of the existing V2
targets named in the runbook. It ships code and leaves live Worker settings as they are. The
runbook's pre-deploy checks stop any deploy that would change vars, bindings, cron triggers, routes,
`workers.dev` reachability or queue consumers. The active packet's
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

- Every merge and deploy leaves evidence: the checked commit, commands and exit codes, the reviewer
  and reviewed head where `quality-gates` requires a review, the rollback target, the deployed version
  and the smoke results.
- On 2026-09-28, GitHub reported `protected: false` for `main` and `codex/viralgraph-cleanroom`,
  no repository rulesets, and Actions disabled. The owner retained the Actions restriction on that
  date. The exact proposed protections and pending authorization are recorded in
  `governance/evidence/WP-PLATFORM-W2-002/github-branch-protection-2026-09-28.md`; they are not applied
  settings. ADR-0006's consequence that `main` branch protection is the enforcement boundary does
  not hold in this readback. The recorded merge gates in `quality-gates` remain required regardless
  of protection or Actions availability. This decision does not change who may administer branch
  protection or Actions.
- A deploy whose smoke check fails is rolled back to its recorded target in the same release and
  recorded as an incident.
