# Diagnosis: `fal_webhook_failed` on GB-02 run f5fa333f

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs
Recorded 2026-08-18

No email, password, JWT, confirmation token, private object key, signed URL, raw provider payload,
prompt text, or customer media is recorded.

## Boundary

- Run: `f5fa333f-df35-4ce8-99f2-90ee9a78b7c7`
- Workspace: `098356b4-190c-4273-bac3-df637c92a3c8`
- Revision: `9be6eef2-8ac1-4ba1-8b9c-ee7c74192039`
- Staging host: `lqvigvzqumpwfjikcvws.supabase.co`
- Sources: `get_run_execution_audit` plus classified fal queue result metadata for the two failed
  master request IDs. Result bodies were inspected only for HTTP status, JSON keys, and
  `detail[].type`.
- Did not confirm another pack. Did not reuse `9b6e0619`, `a72b78e5`, or `33f2e40e`.

## What the stored code actually is

`fal_webhook_failed` is the Worker default when `falWebhookFailureCode` cannot extract a short
machine token from `error`, `error.type`, or `error.code`. Official fal webhook ERROR documents
use a different shape:

- `error` is a free-text HTTP wrapper such as `Invalid status code: 422` (spaces and colon fail
  the stored-code regex, by design).
- The machine type lives on `payload.detail[]` as `type`, for example `content_policy_violation`.
- Request-level failures use `error_type` on a flat object.

The extractor did not walk arrays or `error_type`. Persistence of `fal_webhook_failed` therefore
does not classify the fal failure.

## What this run actually returned

| Node     | Route                    | Attempt | Job elapsed | Stored code          | Fal result HTTP | `detail[].type`            |
| -------- | ------------------------ | ------: | ----------: | -------------------- | --------------: | -------------------------- |
| master-1 | `fal/flux-2-pro/masters` |       1 |      13.1 s | none (succeeded)     |             200 | (images present)           |
| master-2 | `fal/flux-2-pro/masters` |       1 |      12.7 s | `fal_webhook_failed` |             422 | `content_policy_violation` |
| master-3 | `fal/flux-2-pro/masters` |       1 |      13.7 s | `fal_webhook_failed` |             422 | `content_policy_violation` |

Queue status for both failed request IDs was `COMPLETED` (fal's finished-job state). The result
endpoint is the classified source. Six adaptations canceled because their masters failed. Motion
and master-1 adaptations succeeded. Settlement: captured 2,350,000, released 2,200,000, residual 0.

Elapsed time matches the successful master, so this is execution-time safety, not a submit timeout
or missing-field 422.

## Why hardening did not clear GB-02

Worker `37897d13` already omitted supplement offer and audience from image prompts and retitled
master-2 away from "benefit still life". Live fal still returned `content_policy_violation` on
master-2 and master-3. Remaining image prompt material still named banned concepts:

- master-2 direction listed `sleep`, `bedroom`, `muscle`, `doctor`, and `medical` as negatives
- brief `creative_constraints_rights` (copied onto every image node) named `doctor`, `white coats`,
  and `body transformation`

master-1 (packshot-as-hero) succeeded with the same product and packshots, so the failure is the
combination of those prohibition lists with the other two visual directions, not a dead route.

## Repair authorized by this diagnosis

1. Walk official fal `payload.detail[]` and `error_type` when persisting `provider_error_code`.
   Fall back to `http_NNN` only for a bare `Invalid status code: NNN` wrapper. Never persist
   `msg`, `input`, or free-text errors.
2. Keep supplement image prompts visual-only: packaging rights line, no prohibition-list of
   banned concepts, no brief doctor/body rights paragraph.

These changes do not start another pack. Live 16/16 proof still waits for the next authorized
UTC day.

## Not in this diagnosis

- Admin, invites, settings, and extra membership roles remain out of P0.
- Last-mile ZIP/copy/header deploy and the GB-04 receipt walk are separate from this file.
