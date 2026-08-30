# Buyer-journey staging release evidence

## Source commits

- Authority and gates: `f6c3992`
- Failure recovery: `3fbb050`
- Buyer export and receipt: `8f2d223`
- Authentication and resilient state: `e089d99`
- Privileged export boundary repair: `08eff8f`
- Caller-scoped artifact streaming: `4a5997f`
- Private artifact cache policy: `3c0f376`

## Staging versions and rollback

| Surface                | Current                                | Pre-release rollback                   | Stable alias                                            |
| ---------------------- | -------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| Vercel Studio          | `dpl_EFVgRCdcWm3DkrVBL8usUQgidkMN`     | `dpl_8L3qDokfqfc5h9qWtoPSwpE1KrJb`     | `mustbeviral-web-staging.vercel.app`                    |
| Core Worker deployment | `ce5c33dc-fdb6-4259-8fc7-e3e8fc259184` | `dd394533-d8a5-4da3-aa4d-370ec18c78b4` | `mustbeviral-v2-staging-core.ernijs-ansons.workers.dev` |
| Core Worker version    | `246b5df9-bbcd-48cb-b90c-a050db73f208` | `2d47b183-ad36-4954-8ca5-dafdb4e4f79f` | `mustbeviral-v2-staging-core.ernijs-ansons.workers.dev` |

The pre-release rollback pair was captured before mutation. Candidate validation exercised Core
Worker rollback after downstream smoke failures. The Vercel candidate was not rolled back, and
this evidence does not claim otherwise. The nearest Vercel pre-candidate restore point was
`dpl_56Sg25DrjSg28PqXZW2pYwrwf3qQ`; the Core Worker was restored to version
`1f1ddba8-6883-40b2-89d1-08372f8446a6`. Export privilege, caller authorization, cache policy, and
proof-fixture expectation defects were repaired and reverified before the final pair above was
promoted. Production product traffic was never in scope.

## Check counts

- Design-direction check: passed.
- Agent verification: passed after the final handoff update.
- Governance tests: 122 passed.
- Core unit tests: 241 passed.
- Web unit tests: 166 passed.
- Web integration tests: 21 passed.
- Contracts integration tests: 3 passed.
- Core integration tests: 2 passed.
- Focused cache and customer-download regression tests: 30 passed.
- Package builds: 14 passed.
- No-spend browser proof: 1 passed; login, sentinel bootstrap/replay, draft reload, synthetic
  packshot, 16-line GB-04 quote at `4550000` USD micros, and zero run submission were proven.
- Deployed downstream proof: run/recovery/spend, receipt, review, deterministic export, manifest,
  honest QA, direct Worker download, authenticated Vercel bridge, and checksum parity passed. The
  final replay performed 0 export posts, 0 run starts, and 0 provider calls; persisted spend and
  provider facts were unchanged.
- Deterministic export proof: 19 archive members, 18 manifest-hashed members, 16 approved outputs,
  and 16 provider-lineage rows.
- Vercel unauthenticated bridge smoke: `401`, no redirect, `private, no-store`, and `no-referrer`.
- Worker smoke: health `200`.
- Clean Vercel upload input: 753 tracked or sanitized metadata files, 750 upload files, and 0
  blocked inputs.
- Cursor implementation-commit staged-diff audits: 0 blockers.

## Sanitized gate facts

- The accepted stack remains Vercel for the Next.js Studio, Supabase for Auth/Postgres/RLS, and one
  existing Cloudflare Core Worker with private R2. Wrangler updated only that existing staging
  Worker. No Worker, queue, or Cloudflare architecture was added.
- Vercel's stable target belongs to the isolated `mustbeviral-web-staging` project. It is not the
  production MustBeViral product and did not change production traffic.
- The Supabase staging Auth configuration has one exact stable callback, public signup disabled,
  anonymous signup disabled, email sign-in enabled, email auto-confirm disabled, and the configured
  password policy retained.
- The stable staging buyer path passed login without a continuation, campaign-sentinel workspace
  bootstrap, isolated draft restoration, synthetic packshot attachment, and the GB-04 quote at
  `4550000` USD micros with 16 priced lines. Confirmation remained disabled and no run was
  submitted.
- The same deployed run recovery and exact persisted-ledger settlement appeared through REST and
  generated/private MCP contracts. Receipt lineage exposed safe attempt, provider, model, route,
  status, and captured-micros facts for all 16 approved outputs without raw provider messages,
  evidence, object keys, or URLs.
- The deterministic buyer archive used semantic concept filenames, one copy JSON per concept,
  machine-verifiable QA, receipt, and a manifest hashing every other member. Its authenticated
  Vercel bridge bytes matched the checksum-verified Worker download. The final replay reminted no
  artifact and rebuilt no export.
- One bounded export-only rebuild occurred during repair verification. It created no run, provider
  submission, ledger movement, or spend. The final deployed proof reused that export with 0 export
  posts.
- The deployed QA aggregate was honestly `failed`; unassessed constraints remained
  `not_evaluated`, and incomplete output was never labeled complete.
- No production deployment, Stripe action, database migration change, or linked database push
  occurred. No new customer access, provider run, or provider spend occurred during this release.
- Qualified customer commitment, evaluator sessions, unassisted completion, usable-concept rate,
  workflow preference, production Web Vitals, usable-pack landed cost, and operator P0 exit remain
  pending. Actual payment and Stripe are not required for the pending P0 commitment gate.

## Exactly one next action

Operator records the ready partner under an existing `EV-01` through `EV-08` candidate ID in the
approved private recruiting system, including complete qualification, durable staging-use and
commercial-commitment evidence, and one verified recipient, then reruns staging enablement.
