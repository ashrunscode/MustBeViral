---
doc_id: adr-0008-packet-supersession
---

# ADR-0008: Audited owner-directed packet supersession

## Decision and authorization

Accepted September 9, 2026 through the owner's explicit instruction to implement the full-platform
plan and selection of immediate rebaseline. The committed decision receipt under
`governance/evidence/WP-P3-009/owner-supersession-decision-2026-09-09.yaml` records that instruction.

An owner may replace an unfinished packet through an explicit governance-only amendment. Record
the original packet first, increase its specification revision, authorize only the transition work,
and commit that amendment before implementing transition tooling. This is not packet completion.
The amendment authorizes local commits needed for evidence integrity and the subsequent transitions.
Existing required GitHub checks and reviews remain applicable to publication and merging.

## Supersession contract

`pnpm agent:supersede --successor <relative-yaml-path> --decision <relative-yaml-path>` requires:

- A clean committed predecessor and an owner-decision record committed at the same HEAD.
- A decision identifying predecessor and successor IDs and specification revisions, the exact
  current branch, explicit user instruction, reason, and carried release obligations.
- A ready successor on the same branch, pending steps and acceptance, no blockers or completion
  timestamp, and references to accepted authority. Both packets allow every transition output.
- Validation of the existing receipt chain before writes; committed evidence identity and hashes;
  stable HEAD, branch, worktree, manifest, decision, successor, and evidence throughout the write.
- The existing lock, atomic transaction journal, compare-before-write and recovery mechanism.

Version 1 completion receipts remain unchanged. A version 2 supersession receipt stores the
untouched predecessor packet snapshot, its hash, committed evidence identities, decision identity,
successor identity, timestamp, unfinished steps and unproved acceptance. It makes no completion
claim and has no completion timestamp. The receipt participates in the same unique predecessor
chain; cycles, duplicate successors and tampering fail validation.

`agent:finish` retains every existing completion precondition. Neither supersession nor a product
scope change waives an unfinished release gate. Pending observation and owner traffic approval
remain in the existing roadmap/quality authorities and must be satisfied by a later release packet.

## Scope of this bootstrap

WP-P3-009 revision 2 permits only implementing and testing the transition contract before
superseding into the revised WP-P3-010. Runtime product work follows the accepted rebaseline.
The historical observation snapshot remains unaltered. This decision changes no deployment,
customer account, public traffic, provider access, money movement or external communications.

## Verification

Prove accepted incomplete predecessors, rejected missing or uncommitted authorization, incorrect
branch/revision, invalid successors, stale inputs, evidence tampering, duplicate receipts,
interrupted writes and recovery. Run all existing transition and completion tests unchanged.
