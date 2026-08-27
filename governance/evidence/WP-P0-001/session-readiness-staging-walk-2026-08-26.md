# Session-readiness staging walk — 2026-08-26

Work packet: WP-P0-001, current step `p0-007-p0-gate-evaluation`

No email, password, JWT, confirmation token, private object key, signed URL, prompt dump, or
customer media is recorded. No GB-02 spend. No launch-pack confirm.

## Live endpoints

- Web alias: `https://mustbeviral-web-staging.vercel.app`
- Core Worker: `https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev`
- `/health` JSON: `status=ok`, `service=mustbeviral-core`, `generation=viralgraph-cleanroom-v2`

## Unauthenticated web

Signed-out `/login` renders heading `Sign in` and copy `Use the email and password associated with
your Studio workspace.` Skip-to-sign-in is present.

## Authenticated read boundary (Playwright, no run)

`MBV_STAGING_E2E=1` `MBV_PLAYWRIGHT_EXTERNAL=1` against the web alias,
`apps/web/e2e/staging-authenticated.spec.ts`, desktop Chromium, 120s timeout.

- Result: passed in 11.4s
- Disposable workspace: `2dd2b250-260e-4776-a62a-428387f590ff`
- Canvas: `331aab46-4ae3-4495-a17f-eb54fbe8a8f7`
- Revision: `86762c2c-f2f6-43d9-bc51-a121fc774969`
- Canvas GET `/api/core/v1/canvases/{id}`: HTTP 200
- Master-static node visible
- `run_submitted`: false
- `data-run-state` count: 0

This proves sign-in and canvas read on current staging. It does not prove quote $4.55 chrome,
failure-recovery copy, composed review, or packshot attach. Those remain on earlier walks
(`packshot-upload-staging-walk.md`, `gb04-receipt-last-mile-walk.md`,
`composed-review-staging-walk.md`).

## Recovery copy on staging vs local

Customer-safe `content_policy_violation` copy lives in the uncommitted working tree
(`packages/contracts/src/fail-evaluation.ts`, `apps/web/src/features/run/run-port.ts`). This walk
did not open a failed run, so it does not prove that copy is on the current staging web deploy.

## Evaluator implication

Session entry works. Isolated disposable staging identities work. Do not reuse operator kit
workspace `098356b4-190c-4273-bac3-df637c92a3c8` for qualified evaluators. GB-04 remains the
session brief. No GB-02 spend.
