# Final Security Strategy

## First-Class Controls

- Auth and RBAC before feature routes.
- SSRF guard before any Browser Run or fetch scan.
- Prompt-injection guard before scraped content reaches a model.
- Stripe raw-body webhook verification before billing state mutation.
- Idempotency keys for risky write actions.
- Audit logs for profile edits, approvals, scheduling, admin actions, and billing changes.
- Rate limits on auth, onboarding, scanning, image generation, and AI-heavy endpoints.
- Cost limits at model-router boundaries.
- Admin routes protected by explicit admin role.

## Untrusted Content Rule

Website, social, competitor, and user-uploaded text are never trusted instructions. They are normalized, capped, wrapped in untrusted delimiters, and never placed into system prompts.

## Publishing/DM Rule

No content is published or scheduled unless it is approved. DM rules are drafted and approved, not browser-botted or silently pushed.
