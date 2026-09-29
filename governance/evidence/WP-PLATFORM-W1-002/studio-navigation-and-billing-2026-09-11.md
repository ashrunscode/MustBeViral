# Approved studio navigation and actual billing reads

Implemented under W1-002 steps 2 and 3. No remote, paid, or staging execution was performed.

- Three presentation queries (`get_studio_access`, `list_brand_studios`, `list_studio_team`) join
  the shared registry as `platform_presentation`. Team email labels are owner-only through
  `app_private.platform_team_label`. `list_brand_studios` requires current caller membership and a
  current `brand:read` grant; grants to studios the caller does not belong to are omitted.
- Authenticated studio routes use durable portfolio/brand/project pages. Locked Lumen golden
  preview remains on `MBV_LOCAL_GOLDEN_PREVIEW=1`. Old project links resolve only through
  authenticated mappings. Unsaved draft edits guard refresh, in-app links, and browser back/forward.
- Workspace owners get an explicit grant/revocation surface. Invitations still do not create
  workspace, billing, media, or publish authority.
- `get_workspace_billing` reads the workspace wallet profile and ledger as decimal micros strings.
  Missing profile is not shown as zero. Charging remains the platform kill-switch value and is not
  treated as a wallet balance. Studio membership is not billing authority. No checkout, Stripe
  mutation, or provider run is enabled.
- Preview `/studio/[workspace]/billing` still renders the historical fixture panel. Authenticated
  sessions use the live billing query.

Local verification:

- `pnpm supabase:test` — 44 files, 659 assertions, including `00041` presentation directory and
  `00042` workspace billing.
- Contracts tests 113 passed; Core platform port 12 and registry parity 48 passed (REST/CLI/MCP
  share the new operations).
- Web platform and billing unit tests 21 passed. Web lint and typecheck passed. Contracts, Core,
  database, and CLI typechecks passed. Generated OpenAPI/docs current.
- `verify-platform-connected.mjs` — 7 printed identity journeys passed.
- `verify-platform-setup-connected.mjs` — 7 printed setup journeys passed, including presentation
  reads for owner studio access and WashBodega studio context. Isolated schema-only databases are
  created and dropped; the primary database and volumes are preserved.

Evidence level: implemented and locally verified for contracts, database, and unit UI. Connected
staging, authorized production, and desktop/mobile browser journeys are not claimed.

Next step: `w1b-004-journeys-and-successor`.
