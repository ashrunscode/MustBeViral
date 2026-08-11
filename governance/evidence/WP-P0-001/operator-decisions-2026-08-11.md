# Operator decisions of 2026-08-11: refunds, migration history, evaluation sequence, and workspace hygiene

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs. Recorded 2026-08-11.

The operator issued the following decisions in the go-live supervision session. Each entry names
the decision, its rationale, and its operational consequence. These decisions close blockers that
prior evidence had explicitly parked as operator-owned.

## 1. Refund policy for P0: no customer-facing refunds

Decision: refunds are not offered as a product feature in P0. `refund_run_capture`
(migration 20260730040000) remains an operator-only recovery primitive for system faults —
stranded or duplicate captures — and is invoked exclusively through the privileged PostgREST path
with the run ID, supporting ledger evidence, and reason recorded at time of use. No Worker route,
cron, or customer-facing surface calls it in P0.

Consequence: the "refund implemented with zero callers" observation is resolved by policy rather
than by code; the zero-caller state is the intended P0 shape. The P1a charging design revisits
customer-facing remediation together with the fully-landed margin guardrail of at most $1.82 per
pack for 60% margin.

## 2. Staging migration history: explicit deferral

Decision: the 18-row divergence between the staging migration-history table and the repository's
migration filenames stays untouched for the remainder of P0. The MCP-apply plus
md5(pg_get_functiondef) fingerprint doctrine remains the only sanctioned staging application
path. No `supabase db push --linked`, no `db pull`, no `--status reverted`, and no history
rewriting of any kind now.

Consequence: resolution moves to P1a, by either deliberate reconciliation or fresh staging
re-provisioning, decided there. Tooling that assumes a clean `db push` remains unsupported
against staging for the rest of P0.

## 3. Evaluation sequence: operator self-sessions precede recruitment

Decision: before any external evaluator recruitment, the operator runs the full flow personally
as "evaluator zero" — repeated self-sessions on staging through the real web product (brief →
quote → explicit confirmation → run → review → export → receipt) using multiple golden briefs.

Boundary: operator self-sessions do not count toward the five-to-eight qualified evaluator
sessions or any P0 usability gate. They are dry runs that de-risk the protocol, the product, and
the session script before recruited sessions begin. Gate evidence begins only with qualified
external evaluators under the registered protocol.

## 4. P0 go/no-go scheduling

Decision: the P0 exit go/no-go review is scheduled to occur after the qualified evaluator
sessions complete. A recorded decision — go, or pivot/stop — is required either way; silence
does not advance the phase. This is recorded here and reflected in the packet handoff.

## 5. Workspace hygiene: superseded operator tool removed

Decision: the operator explicitly authorized deleting the untracked single-use tool
`apps/core/tools/approve-export-august-pack.ts`, superseded by the tracked generic
`approve-export-probe.ts` and the recorded approval/export evidence. The file was deleted on
2026-08-11; it was never committed, so no repository history is affected. Workspace-wide
verification is expected to run fully green from this point.

## Left open

- Evaluator recruitment itself (five to eight qualified sessions) and the signed paid pilot
  remain pending operator actions; self-sessions do not substitute.
- The broader-scoped read access needed to finish the legacy inventory's enumeration gaps
  (Pages, routes, Durable Objects, traffic) remains an operator-provisioning decision.
