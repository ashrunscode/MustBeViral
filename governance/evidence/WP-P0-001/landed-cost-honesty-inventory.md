# Usable-pack landed cost is still unproven

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-18

No email, password, JWT, confirmation token, private object key, signed URL, raw provider payload,
prompt text, or customer media is recorded. All money below is integer USD micros.

This file does **not** pass `usable-pack-landed-cost`. It separates numbers that already exist from
numbers that do not.

## 1. Verdict

**pending-remediation.** Catalog capture for every technically complete pack is 4,550,000 micros
($4.55), which is below the $5 ceiling. That figure is the immutable P0 **customer charge**, not a
fully landed cost and not a fal or OpenRouter invoice.

The gate stays pending because all three required pieces are missing:

1. External provider invoice or usage truth (`external_provider_cost_micros` is `null` /
   `not_observable` on every T5 machine record).
2. Storage, execution, retry, and billable-failure components of landed cost.
3. A qualified-evaluator usable-pack denominator (0 of 20 jobs judged). Technical approval is not
   a usable-concept vote.

Consumer Grok, Gemini, or Codex subscriptions cannot close this gate. They produce no tenant-safe
invoice, webhook, or receipt lineage this packet can reconcile.

## 2. Two definitions that must stay separate

| Definition                       | Authority                 | What it includes                                                                                                                                                | Current status                |
| -------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Packet `usable-pack-landed-cost` | `ACTIVE_WORK_PACKET.yaml` | Provider + storage + execution + artifact cost, in micros, for every pack counted as **usable**, ≤ 5,000,000, with no unexplained receipt vs catalog difference | Not computable                |
| P1a 60% margin guardrail         | `pricing-decision.md`     | Fully landed cost ≤ 1,820,000 micros per $4.55 pack                                                                                                             | Estimated only; not a P0 pass |

`pricing-decision.md` also lists retries, billable policy failures, private R2, moderation,
rejected variants, and operator QA as items excluded from the one-pass inference estimate. Operator
QA labor is **not** named in the packet criterion. This inventory therefore treats labor as a
P1a-planning note, not as a missing P0 receipt line.

Failed or partial packs do not enter the usable-pack denominator. They still spent catalog micros
on succeeded nodes. Those captures are recorded below so a later fully-landed sheet can decide
whether retries amortize into the pack that eventually becomes usable.

## 3. Catalog ladder (customer charge, not provider cost)

Pinned P0 catalog from `pricing-decision.md`. Capture writes these unit prices, not fal invoices.

| Role              | Catalog unit | Customer unit (µ) | Qty |      Line (µ) |
| ----------------- | ------------ | ----------------: | --: | ------------: |
| copy_set          | request      |           150,000 |   3 |       450,000 |
| master_static     | image        |           500,000 |   3 |     1,500,000 |
| adaptation        | image        |           200,000 |   9 |     1,800,000 |
| motion_branch     | video_second |           100,000 |   8 |       800,000 |
| **Complete pack** |              |                   |     | **4,550,000** |

One-pass **inference** estimate in the same file, retrieved 2026-07 and corrected for Seedance 1.0
Pro Fast: approximately 640,000–710,000 micros ($0.64–$0.71). Breakdown as published: 3 × $0.03
masters, 9 × $0.04 adaptations, ~$0.10 copy, ~$0.17 motion. That is a planning estimate. It is not
an invoice. It excludes retries, 422s, storage, moderation, rejected variants, and QA.

Copy now runs on OpenRouter `qwen/qwen3-30b-a3b-instruct-2507`, which is cheaper than the Moonshot
line used in that estimate. No launch-pack OpenRouter usage total is committed here, so this file
does not replace the $0.64–$0.71 band with a new invented total.

## 4. What existing receipts actually show

Every T5 completed registered pack stores:

- `catalog_landed_cost_micros`: `"4550000"`
- `external_provider_cost_micros`: `null`
- `external_provider_cost_observability`: `"not_observable"`

Source: `launch-pack-runs/golden-20/GB-01.json` (representative) and the same `money` keys on the
other completed T5 records.

### Bucket A — golden-20 harness, as of `summary.json` 2026-08-12T00:47:33Z

| Field             |     Micros |
| ----------------- | ---------: |
| Quoted / reserved | 86,450,000 |
| Captured          | 79,350,000 |
| Released          |  7,100,000 |
| Residual          |          0 |

16 registered briefs completed at 4,550,000 each. `GB-05` has one extra harness run also captured
at 4,550,000. `GB-02` failed twice in this bucket (original plus 2026-08-12 remediation). `GB-16`
and `GB-17` completed. `GB-18`–`GB-20` remain cap-deferred.

Partial captures inside this bucket:

| Record                              | Run          |  Captured |  Released | Residual |
| ----------------------------------- | ------------ | --------: | --------: | -------: |
| `GB-02.json`                        | `103e7b53-…` |   450,000 | 4,100,000 |        0 |
| `GB-02-remediation-2026-08-12.json` | `8d37f4f8-…` | 1,550,000 | 3,000,000 |        0 |

The 1,550,000 remediation capture is 3 copy + 1 master + 3 adaptations of that master
(450,000 + 500,000 + 600,000). External cost remains `not_observable`.

### Bucket B — pre-T5 spend ladder from `p0-gate-evaluation-package.md` §12

| Event                          |    Quoted |  Captured | Released | Residual | External                     |
| ------------------------------ | --------: | --------: | -------: | -------: | ---------------------------- |
| Track B Kontext probe          |         — |         0 |        0 |      n/a | ~$0.04 off-ledger            |
| Track D copy-only              |   450,000 |   450,000 |        0 |        0 | ~$0.0004 in capture metadata |
| Track E approval/export        |   700,000 |   700,000 |        0 |        0 | ~$0.075                      |
| Track F interrupted `143e6229` | 4,550,000 | 4,550,000 |        0 |        0 | invoice not recorded         |
| Track F acceptance `8e724e99`  | 4,550,000 | 4,550,000 |        0 |        0 | not observable               |

These rows are a different evidence set from Bucket A. Do not add A + B and call the sum landed
cost.

### Bucket C — live self-session runs after T5

| Brief | Run          |    Quoted |  Captured |  Released | Residual | Pack shape                                             |
| ----- | ------------ | --------: | --------: | --------: | -------: | ------------------------------------------------------ |
| GB-04 | `33f2e40e-…` | 4,550,000 | 4,550,000 |         0 |        0 | 16/16 complete                                         |
| GB-02 | `a72b78e5-…` | 4,550,000 |   450,000 | 4,100,000 |        0 | copy only                                              |
| GB-02 | `9b6e0619-…` | 4,550,000 | 3,450,000 | 1,100,000 |        0 | 12/16; master-2 failed                                 |
| GB-02 | `f5fa333f-…` | 4,550,000 | 2,350,000 | 2,200,000 |        0 | 8/16; master-2 and master-3 `content_policy_violation` |

`9b6e0619` composition from its self-session: 3 × 150,000 copy + 2 × 500,000 masters +
6 × 200,000 adaptations + 800,000 motion = 3,450,000.

`f5fa333f` composition from its diagnosis and self-session: 3 copy + 1 master + 3 adaptations +
1 motion = 450,000 + 500,000 + 600,000 + 800,000 = 2,350,000.

No self-session run stores an external provider invoice. None of these operator judgments count
toward the usable-pack denominator.

## 5. Missing components

| Component                                                     | Needed for              | Observable today                                                |
| ------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| fal account invoice or usage export for the exact request IDs | packet landed cost      | No committed sanitized total                                    |
| OpenRouter usage.cost summed per launch-pack copy set         | packet landed cost      | Trial spend exists; no pack-level roll-up                       |
| Private R2 storage and request cost                           | packet landed cost      | ZIP byte size for GB-04 export is 8,571,907; no storage invoice |
| Worker / Vercel execution cost attributable to a pack         | packet landed cost      | Not measured per run                                            |
| Retries and billable 422 / policy failures                    | fully-landed planning   | Catalog captures above; whether fal billed the 422s is unknown  |
| Moderation / rejected-variant extras                          | fully-landed planning   | Not separated                                                   |
| Qualified usable votes (`none` / `one` / `multiple`)          | usable-pack denominator | 0 / 20                                                          |

GB-04 export size is recorded only to show an artifact exists. It is not a storage price.

## 6. Why $4.55 does not close the gate

The packet criterion requires landed cost ≤ $5 **for every launch pack counted as usable**, with
reconciled provider, storage, execution, and artifact evidence and no unexplained receipt or
catalog-price difference.

- $4.55 is the catalog receipt. Comparing it to $5 compares the customer charge to the ceiling.
  That is the wrong side of the ledger.
- Inference ~$0.64–$0.71 is below both $5 and the P1a $1.82 guardrail, but it is not an invoice
  and it omits the missing rows in §5.
- Zero packs are usable under the registered rubric, so the per-usable-pack test has no
  denominator. A later 16/16 GB-02 would still need a qualified vote before it can enter that set.

If a future sheet amortizes GB-02 retries into the first usable GB-02, catalog captures already
spent on that brief (excluding the unused remainder that was released) are 450,000 + 1,550,000 +
450,000 + 3,450,000 + 2,350,000 = 8,250,000 micros across five paid attempts. That sum is **not**
the pack's landed cost. It is the catalog amount captured on succeeded nodes while trying to get
GB-02 through fal policy. It is recorded so nobody later pretends those attempts were free.

## 7. What would close the gate

1. Qualified evaluators mark which of the 20 jobs are usable.
2. A sanitized fal (and OpenRouter) usage extract covering those packs' request IDs, with no
   secrets or customer media.
3. Integer-micro adders for storage and execution that the packet names, or an explicit accepted
   decision that those adders are below a stated bound for P0.
4. A per-usable-pack table: catalog capture, external inference, storage, execution, retries
   charged to that pack, residual 0, and a yes/no on ≤ 5,000,000. P1a separately checks ≤
   1,820,000.

Until those four exist, leave `usable-pack-landed-cost` **pending**.

## 8. Sources

- `governance/evidence/WP-P0-001/pricing-decision.md`
- `governance/evidence/WP-P0-001/p0-gate-evaluation-package.md` §§7, 12, 13
- `governance/evidence/WP-P0-001/golden-20-run-proof.md`
- `governance/evidence/WP-P0-001/launch-pack-runs/golden-20/summary.json`
- `governance/evidence/WP-P0-001/launch-pack-runs/golden-20/GB-01.json`
- `governance/evidence/WP-P0-001/launch-pack-runs/golden-20/GB-02-remediation-2026-08-12.json`
- `governance/evidence/WP-P0-001/self-sessions/2026-08-15-GB-04-01.md`
- `governance/evidence/WP-P0-001/self-sessions/2026-08-17-GB-02-01.md`
- `governance/evidence/WP-P0-001/self-sessions/2026-08-17-GB-02-02.md`
- `governance/evidence/WP-P0-001/self-sessions/2026-08-18-GB-02-01.md`
- `governance/evidence/WP-P0-001/fal-webhook-failed-f5fa333f.md`
- `governance/evidence/WP-P0-001/gb04-receipt-last-mile-walk.md`
