# GB-02 master-2 closed-packaging probe

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-18

No email, password, JWT, confirmation token, private object key, signed URL, raw provider payload,
prompt dump, or customer media is recorded.

## Change under test

Worker `872ac183` (`mustbeviral-v2-staging-core`). Rollback target `1c4b0b41`.

Direction now: `Material still life: closed bottle, carton, and readable label only.`

This is the only new variable versus probe `46d4e12b`.

## Spend

One-master quote. Not a launch pack.

| Field             |  Micros |
| ----------------- | ------: |
| Quoted / reserved | 500,000 |
| Captured          |       0 |
| Released          | 500,000 |
| Residual          |       0 |

Customer ledger charge: **$0**. Fal still executed the job (policy 422).

## Result

- Workspace: `d2e0ddbb-0a3e-4ec7-ab2e-bbc65d867711`
- Quote: `500,000` micros, one `master_static` line
- Run: `17145ccd-bf50-430c-8460-ca328155c4f4`
- Terminal: `failed` in 53.056 s
- Node: `master-2`
- Stored provider_error_code: `content_policy_violation`
- Worker: `872ac183`
- Graph nodes: `brief`, `brand-context`, `master-2` only

The named closed-packaging direction is falsified. Live-GB-02-16/16 is retired.

Machine record:
`governance/evidence/WP-P0-001/image-probes/gb02-master-2-closed-packaging/single-image-canary-evidence.json`.
