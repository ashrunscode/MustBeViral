# Page dependency trees — ViralGraph cleanroom V2

## `/` (only page)

```
apps/web/app/page.tsx (CleanroomPage)
└── apps/web/app/layout.tsx (RootLayout)
    └── apps/web/app/globals.css
```

Server-only, zero client JavaScript beyond the Next runtime, no data fetching, no Supabase usage on the page (Supabase helpers under `apps/web/src/lib/supabase/` exist for the SSR cookie boundary but are not consumed by any page yet).

## Cleanroom provenance statement

This analysis was produced from the `viralgraph-cleanroom-v2` scaffold on branch `codex/viralgraph-cleanroom`. It contains no legacy V1 material: no legacy routes, no React Router, no D1 authentication, no marketing-autopilot, no social-posting surfaces, and no System DNA instructions. The scaffold's only interface statement is the design-gate placeholder, and the only styling is the placeholder dark theme documented in `theme.md`.
