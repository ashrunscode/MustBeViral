# MustBeViral agent handoff — 2026-08-27

Work packet: `WP-P0-001`, current step `p0-007-p0-gate-evaluation`.

No secrets, tokens, signed URLs, prompts, customer media, names, or screening answers are recorded.
Provider spend in the producing session: zero. No GB-02 spend. No production deploy. No mail send.

A fresh agent must run `corepack.cmd pnpm agent:preflight` in `C:\dev\MustBeViral` before reading
implementation files or editing. Use Node from `C:\nvm4w\nodejs\node.exe` (`v24.18.0`) and pnpm
`11.12.0`. Do not create another Git worktree. Do not use Codex `isolation=worktree`.

## Exactly one next action

Recheck the restored `MustBeViral/P0 Evaluator Recruitment` label for a real reply; when one exists,
run the registered private qualification screen. Do not send without `APPROVE SEND mustbeviral` in
the same turn. No GB-02 spend.

The registered User Interviews / Respondent fallback remains dormant while the recovered community
permission threads are viable. If the operator later determines those sources cannot proceed, use
`governance/evidence/WP-P0-001/paid-research-fallback-kit-2026-08-26.md`. Same screen, $200 / 90
minutes, laptop, GB-04 only. Mail send still needs `APPROVE SEND mustbeviral` in the same turn.

## Producing-session snapshot (historical; verify live state with preflight)

| Field                     | Value                                                           |
| ------------------------- | --------------------------------------------------------------- |
| Checkout                  | `C:\dev\MustBeViral`                                            |
| Branch                    | `codex/viralgraph-cleanroom`                                    |
| HEAD                      | `4c8f10d61485d6d47d6437881452383b736a50c8`                      |
| Origin                    | even (`0` ahead / `0` behind)                                   |
| Working tree              | clean                                                           |
| Linked worktrees          | 1                                                               |
| Packet                    | `WP-P0-001` in progress                                         |
| Phase                     | P0                                                              |
| Pending decisions         | none                                                            |
| Remote destructive action | forbidden                                                       |
| Production                | legacy V1 live; V2 staging only                                 |
| Web staging               | `https://mustbeviral-web-staging.vercel.app`                    |
| Core staging              | `https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev` |
| Worker live version       | `2d47b183-ad36-4954-8ca5-dafdb4e4f79f`                          |
| Worker rollback           | `872ac183-8601-44d9-ba0c-74f46bd6d027`                          |

Recent commits: `4c8f10d` staging Core deploy evidence; `4627de7` fail-evaluation recovery + gate
evidence.

## What the last session finished

- The 2026-08-27 continuation recovered an interrupted authority transition, completed green
  preflight on `codex/viralgraph-cleanroom`, and verified that the registered Gmail label now holds
  the three permission threads.
- Each recovered thread contains one outbound message and no inbound reply. No label mutation, mail
  send, candidate claim, provider spend, or production mutation occurred in that continuation.
- Single-worktree recovery: moved Codex `224b` intact to
  `C:\Users\ernij\.codex\worktree-backups\MustBeViral-224b-20260826-173615`, then pruned.
- On 2026-08-26, Ashley Gmail MCP authenticated but the custom label and threads were absent. That
  older mailbox snapshot is superseded by `recruiting-inbox-check-2026-08-27.md`.
- Playwright against the web alias: disposable sign-in + canvas read, `run_submitted: false`.
- `pnpm agent:verify` green, then commit/push of recovery UI, provider hardening, and P0 evidence.
- Staging **Core** deployed (`2d47b183`). Staging **web** alias was **not** replaced: `vercel deploy
--cwd apps/web` failed (no monorepo `pnpm-lock.yaml` in that upload).
- Cursor Cloud POST returned no agent id. Local `cursor agent` CLI is not wired.
- Preview goldens still say `$4.20`. Worker canvas CTA is `Review named quote`. Quote authority is
  **$4.55 / 4,550,000 micros**.

## Suggested skills

- `build-mustbeviral` (`C:\dev\MustBeViral\.agents\skills\build-mustbeviral\SKILL.md`) — every resume
- `privacy-redactor` — any inbox or session capture
- `hitl-approver` — mail send, production deploy, Stripe write, social post
- `heavy-lift-router` / `cloud-audit` — only after a pushed SHA, no extra worktree, Cloud must not
  email
- Do **not** invoke `queue-master`, `durable-objects`, `realtime-sync`, or social-publishing skills

## Authority to read after green preflight

End with `docs/delivery/ACTIVE_WORK_PACKET.yaml`. Also: `AGENTS.md`, `PROJECT_STATE.yaml`,
`docs/product/PRODUCT_CONTRACT.md`, `docs/product/RELEASE_SCOPE.md`,
`docs/ux/EXPERIENCE_CONTRACT.md`, `docs/ux/CANVAS_AND_SCREEN_STATES.md`,
`docs/architecture/SYSTEM_OVERVIEW.md`, `docs/delivery/ROADMAP.md`,
`docs/delivery/QUALITY_GATES.md`, `docs/research/EVALUATOR_RECRUITMENT.md`.

Session artifacts (not Git authority):

- Continuation prompt:
  `C:\Users\ernij\AppData\Local\Temp\MustBeViral-fresh-session-continuation-prompt-2026-08-26.md`
  (SHA-256 `9B787100DD3C38C8FFACAD882B0A21A2492C4B72317EDC09E4624E0203E37437`)
- Last Grok plan:
  `C:\Users\ernij\.grok\sessions\C%3A%5Cdev%5CMustBeViral\01a03f87-c45f-76f1-a2e4-4ca87b736f78\plan.md`
- This file, also copied to
  `%LOCALAPPDATA%\Temp\MustBeViral-agent-handoff-2026-08-27.md`

## Evidence index

| Path                                             | Proves                                   | Does not prove                                 |
| ------------------------------------------------ | ---------------------------------------- | ---------------------------------------------- |
| `recruiting-inbox-check-2026-08-27.md`           | Three threads restored; zero replies     | Any candidate or qualification                 |
| `recruiting-inbox-check-2026-08-21.md`           | Zero replies on labeled threads that day | 2026-08-27 inbox                               |
| `recruiting-inbox-check-2026-08-26.md`           | Ashley mailbox has no label/threads      | Community UI state                             |
| `session-readiness-staging-walk-2026-08-26.md`   | Sign-in + canvas read, no run            | Quote $4.55 chrome, failed-run UI on web alias |
| `staging-recovery-deploy-2026-08-26.md`          | Worker `2d47b183` live                   | Web alias has recovery copy                    |
| `production-web-vitals-sequencing-2026-08-26.md` | Vitals measured in P1a, not staging      | Gate pass                                      |
| `paid-research-fallback-kit-2026-08-26.md`       | Fallback SOP exists                      | Account or candidates                          |
| `run-failure-recovery-copy.md`                   | Copy contract                            | Staging web deploy                             |
| `landed-cost-honesty-inventory.md`               | $4.55 is customer charge                 | Fal invoice / usable denominator               |
| `live-gb02-16-16-retired.md`                     | Do not pay GB-02                         | Harness 16/20 is still the technical gate      |
| `owner-first-rollout-plan-2026-08-21.md`         | Later owner-first sequence               | Does **not** authorize P1a from P0             |

Older walks still stand for quote/receipt/review: `gb04-receipt-last-mile-walk.md`,
`composed-review-staging-walk.md`, `packshot-upload-staging-walk.md`.

## Whole remaining plan (do not skip people)

An agent cannot mark the platform finished without qualified humans, a paid pilot, and an explicit
operator `go`. Failed usable-output, economics, or paid-demand is **pivot/stop**, not P1.

### P0 now — close `WP-P0-001`

1. Recheck the restored recruiting label for a real reply (current next action).
2. Screen privately (`EVALUATOR_RECRUITMENT.md`). IDs only in Git.
3. Session-readiness before invite: alias URL (custom DNS does not resolve); dedicated staging
   identity per evaluator (not operator kit workspace `098356b4-…`); GB-04
   `Stillroom Countertop Compost Caddy.` canvas `7fb7573e-…`; quote **$4.55**; packshot does not
   condition FLUX.2 (`fal-ai/flux-2-pro` has no `image_url`); live Reject not offered; laptop;
   no coaching; default walk does not confirm a run.
4. 5–8 qualified GB-04 sessions. First five completed are the locked preference cohort. ≥2 AI-tool
   and ≥2 manual. Gates: ≥80% unassisted, ≥70% usable concepts, ≥3 of first 5 prefer this workflow.
5. Landed cost only on usable packs. P1a guardrail ≤ $1.82 fully landed for 60% margin.
6. Production Web Vitals stay pending until P1a production origin.
7. One paid pilot or signed paid engagement. Interest is not proof.
8. Operator records `go` or `pivot/stop`. Silence is not approval.
9. Only then `p0-008` and successor `WP-P1A-001`. `pnpm agent:finish` only when every criterion is
   proven.

Web recovery UI is on Git `4c8f10d` and staging Core `2d47b183`, **not** proven on the web alias.
A monorepo-root Vercel deploy of `mustbeviral-web-staging` remains outstanding. Do not use
`--cwd apps/web` alone.

### P1a after `go` — paid single-user production

Isolated production Supabase / Worker / R2 / Vercel; Stripe wallet (writes = HITL); email;
telemetry; rollback. Owner-first: T0 deploy proof, one closed hour, 72 owner-only hours, then
explicit admission. Legacy V1 stays until governed cutover. Staging migration HISTORY stays
untouched for the rest of P0; do not rewrite it in P1a either without a packet.

### P1b after P1a is live

Public REST / MCP / CLI, OAuth, immutable skills, three-client parity. No autonomous paid MCP.
No social publish on public API until the publishing ADR.

### Connected publishing — separate ADR, not implied by P1b

Publish now, not unattended scheduling. Only an approved Composed Review revision. Provider-owned
OAuth. HTTP 200 is not publication. Per-destination idempotency. Drive/Photos is a second contract.

### P2–P4 only on evidence

P2 same-workspace collaboration (Postgres remains revision authority). P3 queues/DR when load
evidence exists. P4 agency / ten-brand only after paid DTC economics or a superseding ADR to
ADR-0001.

## Stop / never

- GB-02 spend or reuse of probes `17145ccd`, `46d4e12b`, `f5fa333f`, `9b6e0619`, `a72b78e5`,
  `33f2e40e`
- Extra Git worktree; `git reset` / `git clean` of unrelated work
- Invent evaluators, count operator self-sessions, scrape a non-Ashley mailbox
- Production deploy, Stripe write, social post without HITL naming the target
- Claim finished, live, production-ready, one-click, or 1,000-company support without evidence
