# Composed Review staging walk

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-17

No email, password, JWT, confirmation token, private object key, signed URL, raw provider payload,
or customer media is recorded.

## Deploy

- Staging web alias: `https://mustbeviral-web-staging.vercel.app`
- Current Ready deployment: `mustbeviral-web-staging-jgifx4c95-ashrunscode-projects.vercel.app`
- Inspect: `https://vercel.com/ashrunscode-projects/mustbeviral-web-staging/Crh7aC4FGukTyMnxwAFvezekCdZ4`
- Git HEAD at deploy: `8075db5`
- Rollback target: `mustbeviral-web-staging-akxyses26-ashrunscode-projects.vercel.app`
- Worker: unchanged; copy still served from private R2 via `get_artifact`

## Walked surface

Authenticated GB-04 run `33f2e40e-6f96-42a4-8371-93a2c069e2a6` in workspace
`098356b4-190c-4273-bac3-df637c92a3c8`.

- Review (desktop 1440): Composed Review with three concepts, Feed 4:5 / 1:1 / 9:16, Reels 8s
  motion on concept 1, safe-zone toggle, concept-approved state, 16/16, quote `$4.55`, campaign
  title from `get_project`, reviewer `You`. Lightbox opened from the still.
- Review (mobile 375): stacked rail, full-width phone, placements remain usable.
- Compare: still the artifact-card grid, not Composed Review.
- Receipt: verified, quote and actual `$4.55`, ZIP descriptor Ready, download still disabled.

Preview Lumen goldens were not changed.

## Remaining honest product gaps

- Description field can still carry a spec-section tail on some copy sets.
- Breadcrumb still says `Campaign` rather than the product name.
- Export ZIP bytes are not wired through `customer_download`.
- Reject remains local-only because P0 has no reject operation.
