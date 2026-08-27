# GB-02 master-2 image probe failed

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-18

No email, password, JWT, confirmation token, private object key, signed URL, raw provider payload,
prompt text, or customer media is recorded.

## Spend

This was a one-master quote, not a launch pack.

| Field             |  Micros |
| ----------------- | ------: |
| Quoted / reserved | 500,000 |
| Captured          |       0 |
| Released          | 500,000 |
| Residual          |       0 |

Customer ledger charge: **$0**. Fal still executed the job (policy 422). Machine record:
`governance/evidence/WP-P0-001/image-probes/gb02-master-2/single-image-canary-evidence.json`.

## Result

- Workspace: `3742b698-53e1-4f87-a1f3-a34314cc348e`
- Quote: `500,000` micros, one `master_static` line
- Run: `46d4e12b-dc3b-4e41-8ac1-961057c700f1`
- Terminal: `failed` in 57.958 s
- Node: `master-2`
- Stored provider_error_code: `content_policy_violation`
- Worker: `1c4b0b41` (`imageSafeText` live)
- Graph nodes: `brief`, `brand-context`, `master-2` only

The reconstructed sanitizer-safe prompt is not enough. fal still classifies master-2 as
`content_policy_violation`.

## What this blocks

- No master-3 probe
- No $4.55 full pack
- `imageProbeSucceeded` stays false
- `launchPackRetryDecision(..., 'full_pack')` stays `full_pack_blocked_until_image_probe`

## Next evaluation

Write a new fail-evaluation before any further spend. Do not retry the same sanitizer.
