# Interim traffic decision — WP-P3-009

Prepared 2026-09-08 UTC. **Draft for owner review; no owner ruling recorded.**
This document authorizes no DNS, custom-domain, customer-traffic, or legacy change.

## Recommendation

**Keep all public V2 traffic off now. Continue preparing V2 privately.**

The current protected foundation is healthy at the recovered checkpoints, but the
original 72-hour observation is not proven. The public site still resolves through
Cloudflare; `api.mustbeviral.com` is NXDOMAIN. The production Vercel project has
only its provider domains, and an anonymous request receives the SSO challenge.

The plan's suggested “go subdomains” is a future direction, not evidence that a
custom domain can safely be attached today. A future `api.` binding still requires
its own exact resource authorization and enablement/security gates. `app.` is a
separate later decision. Public signup, generation, providers and charging stay off.

## Evidence the owner is reviewing

- `private-72-hour-observation-2026-09-07.md`: missing first-day capture, late closing
  capture, and unsupported probe assumptions; original observation NOT PROVEN.
- `private-observation-2026-09-08.md`: one owner session, zero tenant/money activity,
  disabled gates, forced RLS, Core health, artifact denial, SSO, stable deployments,
  and recovered runtime error/status counts.
- `replacement-observation-baseline-2026-09-08.md`: new private observation starts
  September 8 at 03:18:11Z and cannot complete before September 11 at 03:18:11Z;
  supported authenticated denial probes and observed browser prefetch counts.
- `owner-session-zero-spend-smoke-2026-09-04.md`: initial owner smoke, with final
  sign-out explicitly deferred.
- `../WP-P3-008/rollback-and-handoff-2026-09-02.md`: existing private deployment
  rollback targets and containment order.
- `execution-recovery-review-2026-09-08.md`: the implementation sequence's remaining
  approval and CI contradictions.

## DNS correction and release limits

The earlier WP-P3-004 inventory said the apex, `www`, and `api` had no DNS records.
The September 6 evidence and fresh September 8 DNS-over-HTTPS queries contradict
that statement for the apex and `www`, both of which resolve. The `api` NXDOMAIN
finding remains correct. The previous inventory must not be used to assume the
apex is unused. The fresh A queries do not by themselves verify the hidden CNAME
configuration behind the Cloudflare proxy.

Legacy resource inventory, customer/subscription impact, 30-day traffic evidence,
export/restore evidence and exact cutover/rollback authorization remain release
requirements. No legacy resource is eligible for deletion based on this draft.
The shared Cloudflare account contains other businesses and is outside this task
except for verified MustBeViral resources.

## Proposed owner ruling

No-go for public traffic to the apex, `www`, `api`, or `app` now. Prepare the V2
implementation and later subdomain path under governed packets. Human rollback
owner: `ashrunscode`, subject to the owner's explicit confirmation. A later traffic
approval must name exact resources and rollback evidence after the missing release
checks pass.

This recommendation neither waives the failed observation evidence nor satisfies
the manual acceptance criterion. The owner's actual response must be recorded
verbatim with its timestamp in a separate decision receipt.
