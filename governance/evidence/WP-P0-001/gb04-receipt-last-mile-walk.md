# GB-04 receipt last-mile walk

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-18

No email, password, JWT, confirmation token, private object key, signed URL, raw provider payload,
or customer media is recorded.

## Deployed pair

- Git HEAD: `dd1a5fb` (last-mile `a340ea7` plus fal detail-type persistence)
- Staging Worker: `mustbeviral-v2-staging-core` version `9fa5c96d-0a3d-4ff4-8ad9-3dfd2dc2f33d`
  at `https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev`
- Staging web Ready: `mustbeviral-web-staging-qsvhcip1c-ashrunscode-projects.vercel.app`
- Stable alias: `https://mustbeviral-web-staging.vercel.app`
- Inspect: `https://vercel.com/ashrunscode-projects/mustbeviral-web-staging/HYxbWxYsqULsWLdHPfzxmAnjVMkx`
- Web rollback target: `mustbeviral-web-staging-jgifx4c95-ashrunscode-projects.vercel.app`
  (`Crh7aC4FGukTyMnxwAFvezekCdZ4`)
- Worker rollback target: previous version `37897d13`

Did not confirm a new pack. Did not reuse `f5fa333f`, `9b6e0619`, or `a72b78e5`. Walked the
already-complete GB-04 run `33f2e40e-6f96-42a4-8371-93a2c069e2a6` only.

## Receipt walk

Authenticated kit workspace `098356b4-190c-4273-bac3-df637c92a3c8`. Desktop 1440 and mobile 375.

| Check                                       | Result                                            |
| ------------------------------------------- | ------------------------------------------------- |
| Receipt heading                             | `Receipt · Rev d582d974-… · 2026-08-15`           |
| Named amount                                | `$4.55` present                                   |
| `Download pack`                             | visible on desktop and mobile                     |
| Disabled `Export recorded` / `Download PDF` | absent                                            |
| Review incomplete                           | absent                                            |
| Download HTTP                               | 200                                               |
| Content-Type                                | `application/zip`                                 |
| Content-Disposition                         | `attachment`                                      |
| ZIP magic (`PK`)                            | present                                           |
| Byte size                                   | 8,571,907                                         |
| Access path                                 | same-origin `/api/core/v1/artifacts/{id}/content` |
| Console errors                              | 0                                                 |

The previous walk on `jgifx4c95` had a Ready ZIP descriptor and a disabled download. This walk
retrieved private ZIP bytes through `customer_download`.

## Adjacent last-mile honesty

- Review heading is `Stillroom Countertop Compost Caddy. launch pack`.
- Header breadcrumb uses the workspace name `OPERATOR SELF-SESSION WORKSPACE`, not `Campaign`.
- Review body did not show spec-section tails (`design & dimensions` / QA checklist).
- `Reject` was not visible because this run is already concept-approved. The control remains
  local-only in code (`Reject locally`) and is still not a durable reject operation.

## Still open after this walk

- Packshot upload signing still throws.
- Reject is still not durable.
- Live GB-02 16/16 after the content-policy prompt repair is not proven. No same-day second pack.
- Admin, invites, settings, and extra roles stay out of P0.
