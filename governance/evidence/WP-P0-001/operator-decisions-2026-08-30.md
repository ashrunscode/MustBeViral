# Operator decisions supplied for 2026-08-30: P0 commitment proof and buyer enablement

Work packet: WP-P0-001, step p0-007-p0-gate-evaluation. The operator supplied these decisions
for the dated record 2026-08-30.

These decisions amend the P0 paid-demand evidence definition and the immediate customer-enablement
sequence. They do not pass a gate without evidence, authorize Stripe, promote production, approve
provider spend, or relax any evaluator, usability, quality, economic, performance, or exit gate.

## 1. Qualified P0 commitment proof

Decision: the P0 customer-commitment gate is satisfied only when at least one qualified US,
Shopify-first DTC customer or design partner has sanitized durable evidence that it will use the
staging product and either intends to pay or has agreed commercial terms. Actual payment, a Stripe
integration, and a P1a billing surface are not required in P0.

Consequence: interest without qualification, a staging identity, operator self-use, a verbal lead,
provider spend, or this decision by itself does not pass the gate. The gate remains pending until
the repository contains sanitized evidence proving both qualification and commitment while
excluding names, contact details, customer media, tokens, payment secrets, and signed URLs.

## 2. Spend remains separately authorized

Decision: customer commitment does not authorize a provider run. A new GB-04 $4.55 launch-pack run
requires explicit operator spend authorization recorded in the repository before confirmation.
GB-02 remains retired, and historical failed/probe runs named in existing evidence are not reused
as customer proof.

Consequence: no-spend staging validation stops before confirmation. The customer may be enabled
only after the commitment evidence and the exact GB-04 spend authorization are recorded.

## 3. P0 product and platform boundaries remain unchanged

Decision: the accepted stack remains Next.js on Vercel, Supabase Auth/Postgres/RLS, one existing
Cloudflare Core Worker, and private R2. The customer path remains the single-owner GB-04 Meta
Campaign Launch Pack. Stripe, agency operation, queues, another Worker, production promotion, and
migration-history reconciliation remain outside this action.

## 4. Gate status and handoff

Decision: evaluator sessions, unassisted completion, usable-concept judgment, workflow preference,
production-segment Web Vitals, fully landed usable-pack cost, and the explicit P0 go or pivot/stop
decision remain pending. The packet stays in p0-007 and ends with a handoff rather than finish.

The single operator-owned next action after the buyer journey is verified on staging is:

> Operator enables the ready DTC design partner on GB-04 staging, records sanitized
> qualification/commitment evidence and explicit authorization for the customer's $4.55 run, then
> gives the customer access.
