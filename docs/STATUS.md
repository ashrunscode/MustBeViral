---
doc_id: project-status
---

# Current status

DO NOT EDIT — generated from `PROJECT_STATE.yaml` and the active packet.

| Field | Value |
|---|---|
| Product | MustBeViral Studio |
| Engine | ViralGraph |
| Generation | `viralgraph-cleanroom-v2` |
| Launch customer | `dtc_ecommerce_marketing_teams` |
| Phase | P3 — Disabled-behavior production environment binding (blocked) |
| Active packet | `WP-P3-008` |
| Current step | `p3h-004-private-smoke-and-cutover-gate` |
| Release target | `P0` |
| Pending decisions | DECISION_NO_LEGACY_OR_DNS_MUTATION_WORDING: acceptance no-legacy-or-dns-mutation was recorded passed on 2026-09-02 against an unqualified no-DNS-record-change claim. Five mail-authentication records (DKIM x2, SPF x2, DMARC p=none) were added to mustbeviral.com on 2026-09-03 to enable owner email delivery. No A record, CNAME, route, or custom domain changed and legacy V1 traffic is unaffected, so the protection the criterion exists for is intact. Re-expressing an accepted criterion is not a packet-level decision; an owner ruling is required. |
| Blockers | BLOCKED_OWNER_INVITATION_PENDING_ACCEPTANCE: custom SMTP is configured on jjgtlfblsfobdhmtngbz (smtp.resend.com:465, sender hello@mustbeviral.com, verified via the Management API) and the one authorized owner invitation was sent and reported Delivered by Resend. The invitation is still pending acceptance, so production Auth has no signed-in session and the packet's authenticated database/RLS smoke remains unproven. Evidence: governance/evidence/WP-P3-008/smtp-delivery-verification-2026-09-03.md |
| Remote destructive action | `forbidden` |

## One next action

Accept the owner invitation delivered to hello@mustbeviral.com, establish the owner credential, then run the authenticated zero-spend RLS smoke for step p3h-004.
