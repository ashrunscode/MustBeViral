---
doc_id: generated-environment
---

# DO NOT EDIT — Generated environment reference

Source: `packages/config/environment.manifest.json`. Values are intentionally excluded.

| Variable | Owner | Environments | Sensitivity | Required | Purpose |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web | local, preview, staging, production | public | yes | Environment-specific Supabase API URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | web | local, preview, staging, production | public | yes | Environment-specific Supabase publishable browser key; never a service-role key. |
| `NEXT_PUBLIC_CORE_API_URL` | web | local, preview, staging, production | public | yes | Origin for the matching Core API environment. |
| `APP_ENV` | core | local, staging, production | public | yes | Explicit Core runtime environment label. |
| `SUPABASE_URL` | core | local, staging, production | public | yes | Environment-specific Supabase issuer and Data API origin. |
| `SUPABASE_JWT_AUDIENCE` | core | local, staging, production | public | yes | Expected audience for Supabase user JWT verification. |
| `CORS_ALLOWED_ORIGINS` | core | local, staging, production | public | yes | Comma-separated exact web origins accepted by browser-facing Core routes. |
