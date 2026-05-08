# SECURITY_CHECKLIST.md

## Auth/RBAC

- [ ] Auth required for app routes.
- [ ] Workspace membership checked on every workspace route.
- [ ] Brand access checked on every brand route.
- [ ] Admin routes require admin role.
- [ ] Session expiration implemented.
- [ ] Password hashing if custom auth is used.
- [ ] OAuth callback validation if OAuth is used.

## Validation

- [ ] Zod schemas for every route body.
- [ ] Query params validated.
- [ ] File uploads validate MIME type and size.
- [ ] URL inputs validated and normalized.
- [ ] Social platform URLs validated.

## AI Safety

- [ ] Scanned website/social content treated as untrusted.
- [ ] Prompt injection guard around web content.
- [ ] AI output must pass compliance review.
- [ ] Risky claims flagged.
- [ ] Forbidden phrases enforced.
- [ ] Evidence stored for recommendations.
- [ ] Human approval before publishing by default.

## Browser Run

- [ ] SSRF protection.
- [ ] Block private IP ranges.
- [ ] Block localhost/internal metadata URLs.
- [ ] Do not browse authenticated/private areas without explicit user auth.
- [ ] Do not use browser automation to bypass platform rules.

## Media

- [ ] R2 bucket not publicly listable.
- [ ] Signed URLs where appropriate.
- [ ] Asset ownership enforced.
- [ ] Content type validation.
- [ ] Virus/malware scanning optional but planned.

## Billing

- [ ] Stripe webhook signature validation.
- [ ] Idempotency keys.
- [ ] Subscription status checked.
- [ ] Usage limits enforced.

## Scheduler/DM

- [ ] API tokens encrypted/secret-managed.
- [ ] No unsafe browser-bot DMs.
- [ ] DM rule approvals required.
- [ ] Every scheduler action logged.

## Auditing

- [ ] Audit logs for profile changes.
- [ ] Audit logs for approvals/rejections.
- [ ] Audit logs for scheduling.
- [ ] Audit logs for admin actions.

## Rate/Cost Limits

- [ ] Per-user rate limits.
- [ ] Per-workspace AI budget.
- [ ] Per-brand image limit.
- [ ] Admin cost dashboard.
