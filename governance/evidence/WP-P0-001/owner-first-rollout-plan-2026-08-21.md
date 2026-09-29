# Governed master finish and owner-first rollout plan — 2026-08-21

Work packet: WP-P0-001, current step `p0-007-p0-gate-evaluation`

This plan turns the operator's requested one-hour personal-launch observation and 72-hour
other-user hold into an executable release contract. It does not claim that the platform is
production-ready, promote a later phase, or replace accepted authority. Where this plan conflicts
with `PROJECT_STATE.yaml`, the active packet, or a registered authority, the registered authority
wins.

No credential, customer identity, screening response, prompt, provider payload, private object key,
signed URL, or customer media is recorded here.

## 1. Definition of finished

"Finished" is a sequence, not one deployment:

1. **P0 validation complete:** all technical, usability, output-quality, economic, paid-demand,
   privacy, and trust gates pass; the operator records `go`.
2. **P1a paid single-user product complete:** isolated production infrastructure, production RLS,
   billing/wallet, email, operations, rollback, telemetry, and a controlled production release are
   proven.
3. **Owner-first activation complete:** one clean pre-owner hour, followed by 72 clean hours of
   owner-only production use.
4. **Controlled customer admission complete:** additional users are admitted gradually only after
   the owner-only window passes.
5. **P1b programmable surface complete:** OAuth/API keys, public REST, MCP, CLI, and immutable
   creative playbooks have three-client semantic parity.
6. **Connected publishing complete only after a separately accepted product/architecture change:**
   Google Drive import and human-confirmed publishing to supported Instagram professional accounts,
   Facebook Pages, Pinterest boards, TikTok creator/business accounts, and X accounts. This is a
   new cleanroom capability, not the prohibited legacy multi-brand social autopilot.

## 2. Current truth and immediately executable work

| Item                  | Current truth                                                                                            | Required action                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Repository health     | Latest governed verification evidence is green; the worktree contains uncommitted operator/agent changes | Preserve the worktree and run current verification before handoff                                                         |
| Staging web           | `https://mustbeviral-web-staging.vercel.app` responds successfully                                       | Operator may use it now for staging rehearsal                                                                             |
| Staging Core          | The current Worker health endpoint responds `status: ok`                                                 | Keep staging as the only executable V2 environment in P0                                                                  |
| Custom staging DNS    | `staging.mustbeviral.com` and `api-staging.mustbeviral.com` do not currently resolve                     | Treat the Vercel and Workers aliases as the verified staging entry points; repair custom DNS only in an authorized packet |
| Representative runs   | 16 of 20 and latency gate proven                                                                         | No more GB-02 spend                                                                                                       |
| Recruiting            | Three permission requests exist; zero replies as of the 2026-08-21 private-label check                   | Continue monitoring; privately screen real replies                                                                        |
| Human gates           | Zero qualified sessions, no qualified usable denominator, no paid pilot                                  | Complete five to eight sessions and one paid pilot                                                                        |
| Economics             | Customer catalog charge is known; fully landed cost per evaluator-approved usable pack is not            | Reconcile provider invoice/usage, storage, retries, moderation, and operator QA only after usable votes exist             |
| Production Web Vitals | Not measured because V2 production does not exist                                                        | Measure in the accepted P1a production segment; do not substitute staging or lab data                                     |

The operator can start using staging immediately with `GB-04`. Operator use remains a self-session:
it is useful for finding defects but cannot be counted as an independent evaluator session or paid
pilot. Do not use retired `GB-02` for paid execution.

## 3. P0 closure path

Execute in this order without changing denominators after observation:

1. Monitor the private recruitment label. For each real reply, apply the registered DTC, Shopify,
   Meta-spend, creative-accountability, workflow-cohort, conflict, and repeat-exposure screen.
2. Schedule five to eight qualified `GB-04` staging sessions. The first five completed qualified
   participants are the fixed preference cohort; maintain at least two AI-tool and two manual-flow
   participants.
3. Run the neutral 90-minute protocol. Record unassisted completion, time to first reviewable pack,
   usable-concept votes across the fixed 20-brief denominator, forced workflow preference, and
   risk feedback. Store personal data only in the private recruiting system.
4. Obtain one real paid validation engagement or signed paid-pilot commitment. Interest alone does
   not count.
5. Reconcile fully landed cost only for packs qualified evaluators mark usable. Preserve integer
   USD micros and unexplained differences; enforce the stricter P1a 60% margin guardrail before
   charging.
6. Record the production Web Vitals sequencing decision without pretending staging is production.
7. Present the complete dossier to the operator for an explicit `go` or `pivot/stop`. A failed
   value, cost, or paid-demand gate blocks P1a expansion.
8. Only after every gate passes, execute `p0-008` and prepare the governed P1a successor packet.

## 4. P1a production build and release prerequisites

The successor packet must independently prove:

- isolated production Supabase, Core Worker, private R2, Vercel, Stripe, email, and telemetry;
- forward-only migrations, forced RLS, cross-tenant denial, secrets separation, and restore proof;
- production identity, subscription/setup charge, prepaid wallet, entitlements, caps, refunds, and
  reconciliation using integer money and immutable receipts;
- no public media, duplicate provider work, duplicate charge, unexplained ledger residual, or blind
  retry after ambiguous submission;
- feature flags and kill switches for generation, provider routes, charging, signups, invitations,
  and connected publishing;
- authenticated golden-flow smoke, rollback rehearsal, incident contacts, alert delivery, and
  production-segment p75 LCP, INP, and CLS measurement;
- an allowlisted operator account and closed enrollment by default.

No production mutation begins from this P0 document. These items become executable only when the
accepted P1a packet names the exact resources, allowed paths, rollback evidence, and approval.

## 5. Exact one-hour and 72-hour rollout contract

Define `T0` as the timestamp at which the governed P1a production deployment and its immediate
smoke suite both pass.

### T0 through T+1 hour — closed production observation

- No customer invitations or self-service signup.
- Continuously observe web/API health, auth errors, RLS denials, provider state, outbox age,
  reconciliation age, artifact verification, public-access checks, reservation/ledger balance,
  duplicate suppression, spend caps, Core Web Vitals, and alert delivery.
- Exercise one no-spend authenticated read path and the packet-authorized canary path. Do not turn a
  health response into launch proof.
- Verify the rollback target and kill switches remain immediately usable.
- At T+1 hour, record a pass/fail receipt. Only a clean pass unlocks the operator account.

### T+1 hour through T+73 hours — operator-only production

- The operator may use the production product. Everyone else remains blocked by enrollment and
  invitation controls.
- Start the 72-hour owner-only clock at the operator's first production access, not at deployment.
- Monitor the same safety, money, provider, privacy, reliability, and Web Vitals signals, plus every
  owner run and recovery event.
- Do not enable public APIs, public MCP discovery, social publishing, autonomous scheduling, or
  additional accounts during this window.
- A clock reset is mandatory after any cross-tenant access, public artifact, duplicate submission or
  money movement, ledger imbalance, uncontrolled spend, signature bypass, Sev-1 incident,
  production rollback, or unresolved provider ambiguity.

### After 72 clean owner-only hours — controlled additional users

- Require an explicit operator admission decision; elapsed time alone does not open enrollment.
- Invite the paid-pilot customer first, then a small allowlisted cohort one account at a time.
- Verify auth, workspace isolation, wallet/caps, first run, artifact access, receipt, and support path
  for each account before admitting the next.
- Keep self-service signup disabled until the successor packet's cohort acceptance and support/SLO
  gates pass.

The 72-hour zero-legacy-traffic clock in `docs/operations/LEGACY_V1_RETIREMENT.md` is independent.
It begins only after an actual route cutover and must still pass before any legacy deletion.

## 6. P1b and connected-publishing sequence

After the paid web product is stable:

1. **P1b:** production OAuth/API keys, public REST, MCP, CLI, immutable user-authored creative
   playbooks, revocation, scoped audit UX, and browser/REST/MCP/CLI parity.
2. **Connected Publishing decision:** amend the accepted product, release-scope, UX, architecture,
   provider, privacy, and incident authorities. Do not implement it as an undocumented P1b extra.
3. **Connector UX:** a Lightfield-native connections page matching the supplied interaction model:
   installed strip, search, categorized two-column catalog, `+` install action, overflow management,
   branded consent modal, provider-owned OAuth/workspace/account selection, success toast, reconnect,
   revoke, and honest states such as review-pending or private-only.
4. **Google Drive:** Google Picker with per-file `drive.file` scope, immediate verified copy into
   private R2, no blanket Drive crawl, no folder sync in the first release.
5. **Publish workflow:** only an approved immutable Composed Review revision may become a social
   draft. Show per-platform previews, exact destinations, captions, alt text, privacy, rights,
   claims, brand/AI disclosures, and a final browser-session confirmation.
6. **Provider order:** Meta professional Instagram/Facebook Pages, Pinterest, TikTok draft then
   audited direct post, X, then multi-destination dispatch. Every platform remains disabled until
   its current provider review, scopes, account eligibility, revocation, live-post receipt,
   permalink, media validation, duplicate protection, and kill switch are proven.
7. **Dispatch semantics:** `draft -> ready_for_approval -> approved -> dispatching ->
provider_processing -> published`, with `failed`, `needs_action`, `unknown`, and `canceled`
   alternatives. An HTTP acceptance is not publication proof. Ambiguous timeouts become `unknown`
   and reconcile before retry. One platform failure never duplicates a successful post elsewhere.

First release is **Publish now**, not autonomous scheduling. Final social publication is unavailable
to MCP, CLI, and API keys until a later accepted security decision; those surfaces may prepare
drafts but cannot bypass the fresh browser confirmation.

## 7. Evidence required before any completion claim

For every phase, preserve exact version/deployment IDs, migration range, checks, operator, start and
end timestamps, rollback target/outcome, alert evidence, sanitized run/receipt references, provider
review state, and unresolved risks. Mark results `passed`, `failed`, `blocked`, or `unverified`; never
convert absence of evidence into a pass.

The only next action while WP-P0-001 remains active is to monitor the private recruiting inbox,
screen real respondents, and schedule the qualified staging sessions. Future-phase implementation
is intentionally not executed early.
