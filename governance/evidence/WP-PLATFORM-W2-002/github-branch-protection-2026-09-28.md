# GitHub branch-protection readback and owner-action request

Date: 2026-09-28. Repository: `ashrunscode/MustBeViral`.

## Current evidence

Read-only GitHub API checks returned:

- `GET /repos/ashrunscode/MustBeViral/actions/permissions`: `enabled: false`.
- `GET /repos/ashrunscode/MustBeViral/branches/main/protection`: HTTP 404, `Branch not protected`.
- `GET /repos/ashrunscode/MustBeViral/branches/codex%2Fviralgraph-cleanroom/protection`: HTTP 404, `Branch not protected`.
- `GET /repos/ashrunscode/MustBeViral/rulesets`: empty array.

No settings have been changed. These observations supersede no historical receipt.

## Requested settings

The owner instructed "PLEASE IMPLEMENT THIS PLAN" on 2026-09-28. That plan specifies:

> Both `main` and `codex/viralgraph-cleanroom`: prohibit force-push and deletion; enforce for administrators.

> `main`: require PRs, with zero GitHub approval-count requirements.

> No hosted required status checks while Actions remains disabled.

The same plan requires a reviewable owner-action request when exact-action authority is absent.
The attached handoff's quoted approval claim is not independent current permission. ADR-0009 and
the active packet currently authorize guarded releases, not this GitHub settings write. This
document prepares the exact write for owner authorization and the corresponding scoped authority
record; it does not widen the standing release grant or apply the settings.

Apply with `gh api --method PUT --input <payload-file>` to each endpoint below. These JSON payloads
are complete; `null` required checks intentionally keeps hosted CI optional while Actions is off.

`repos/ashrunscode/MustBeViral/branches/main/protection`:

```json
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "require_code_owner_reviews": false,
    "dismiss_stale_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

`repos/ashrunscode/MustBeViral/branches/codex%2Fviralgraph-cleanroom/protection`:

```json
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

Read both endpoints back after any authorized write and verify every requested field, plus that
Actions is still disabled. Only then update the factual descriptions in quality-gates and ADR-0009.
There are no required hosted checks because Actions remains off. Zero GitHub approval-count
requirements accommodates one owner account; the separate independent review required by the
repository still applies before merging. Cleanroom retains its current packet workflow until the
separately reviewed promotion to main.

## Recovery

The observed prior state is no branch protection. Restoring it would use
`gh api --method DELETE repos/ashrunscode/MustBeViral/branches/main/protection` and
`gh api --method DELETE repos/ashrunscode/MustBeViral/branches/codex%2Fviralgraph-cleanroom/protection`.
These are reviewable rollback commands, not permission to execute them; removing protection needs
its own exact owner authorization. Preserve branches, commits, Actions settings and local review
gates throughout recovery.
