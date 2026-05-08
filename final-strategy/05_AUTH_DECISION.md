# Auth Decision

Decision: custom D1-backed email/password auth with server-side sessions and future OAuth support.

## Why

- Phase 1 needs a sellable owner/agency login without a third-party auth dependency.
- Server-side sessions give revocation and admin control.
- D1-backed sessions match Cloudflare-native deployment.
- OAuth remains future-ready through `oauth_accounts`.

## Implementation Shape

- `users` stores identity, role, failed login state, and optional profile fields.
- `password_credentials` stores password hash metadata separate from user profile.
- `sessions` stores hashed session tokens, expiry, IP/user-agent metadata, and revocation.
- Auth middleware reads a secure HTTP-only cookie for browser UX and enforces CSRF with SameSite Lax plus custom JSON/header checks; API tokens can be added later.
- Workspace and brand RBAC are checked server-side on every scoped route.

## Password Hashing

Workers-compatible PBKDF2 via WebCrypto is the safe first implementation. Argon2id can replace it only after a Workers-compatible package is verified in tests.
