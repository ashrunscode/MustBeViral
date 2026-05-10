# SECURITY_CHECKLIST.md

Status reflects the local repo after the 2026-05-09 Run 14 continuation pass. Production remains `shipped: pending`.

## Auth/RBAC

- [x] Auth required for protected app/API routes.
- [x] Workspace membership checked on every workspace route.
- [x] Brand access checked on every brand route.
- [x] Admin routes require admin role.
- [x] Session expiration implemented.
- [x] Logout revokes the active session.
- [x] Password hashing uses PBKDF2-SHA512 at the repo-safe 100,000 iteration cap.
- [ ] OAuth callback validation if OAuth is added later.

## Browser And CSRF Posture

- [x] Session cookies are `HttpOnly`, `SameSite=Lax`, and secure outside development.
- [x] Cookie-backed mutating API requests require same-origin/same-site origin posture.
- [x] Cross-site cookie-backed mutations return `CSRF_BLOCKED`.
- [x] Browser fetches use same-origin credentials.
- [ ] Add a separate browser-level CSRF fixture if a future cross-origin surface is introduced.

## Validation

- [x] Zod schemas cover current route bodies.
- [x] URL inputs are normalized and SSRF-checked.
- [x] Unsafe localhost/private-network scan targets are blocked.
- [x] Query/list limits are clamped where supported.
- [ ] File uploads need MIME/size enforcement before customer upload launch.
- [ ] Social platform URL validation should be tightened before real social account linking.

## AI Safety

- [x] Scanned website/social content treated as untrusted.
- [x] Prompt-injection guard around web content.
- [x] AI output remains mock-safe without configured providers.
- [x] Generated posts land in draft or pending approval.
- [x] Evidence stored for recommendations.
- [x] Human approval before publishing/export by default.
- [ ] Real external AI activation requires staging smoke and configured secrets.

## Browser Run

- [x] SSRF protection.
- [x] Block private IP ranges.
- [x] Block localhost/internal metadata URLs.
- [x] No browsing authenticated/private areas without explicit user auth.
- [x] No browser automation to bypass platform rules.
- [ ] Browser Run remains disabled until separately approved.

## Media

- [x] R2 access is routed through brand-scoped API ownership checks.
- [x] Generated creative metadata is tenant scoped.
- [ ] Configured production R2 bucket `mustbeviral-production-media` was not verified in Wrangler read-only discovery.
- [ ] Customer uploads need MIME type, size, and malware policy before launch.

## Billing

- [x] Stripe webhook signature validation.
- [x] Stripe webhook replay idempotency.
- [x] Stripe webhook tamper rejection.
- [x] Local subscription rows advance from signed checkout events.
- [x] Subscription status checked for plan caps.
- [x] Plan caps revert after signed cancellation events.
- [x] Usage limits enforced for brands, posts, and AI requests.
- [ ] MustBeViral Stripe test products/prices are not verified.
- [ ] Checkout/subscription smoke requires approved test-mode config and secret writes.

## Scheduler/DM

- [x] No unsafe browser-bot DMs.
- [x] DM rule approvals required.
- [x] DM activation is state-only; no real outbound DM sends.
- [x] Manual export requires approved posts.
- [x] Every scheduler/manual-export action logged.
- [ ] Real scheduler provider tokens require secret management and explicit approval.

## Auditing

- [x] Audit logs for profile changes.
- [x] Audit logs for generated posts and campaign conversion.
- [x] Audit logs for approvals/rejections.
- [x] Audit logs for scheduling/manual export.
- [x] Audit logs for auth and workspace/brand creation.
- [ ] Admin action audit breadth should be expanded as admin actions grow.

## Rate/Cost Limits

- [x] IP rate limits for auth endpoints.
- [x] Per-workspace AI request cap.
- [x] Per-workspace content post cap.
- [x] Per-workspace brand cap.
- [x] Admin cost dashboard data source exists.
- [ ] External observability dashboards remain pending.
