# MustBeViral

MustBeViral is a Cloudflare-native, multi-brand AI marketing autopilot. Phase 1 is built for local businesses, agencies, multi-brand operators, and done-for-you operators.

The app is a clean build from Cloudflare's `react-router-hono-fullstack-template`, with the original System DNA preserved under `docs/system-dna/`, the Claude audit preserved under `audit/`, and the reconciled build strategy preserved under `final-strategy/`.

## Product Direction

- One user can manage multiple brands.
- Each brand owns a persistent `MarketingAgent`.
- Agentic onboarding scans website/social/competitor inputs safely.
- The UI is a command center, not a chat-first app.
- Content, image generation, approvals, manual export scheduling, reports, DM rules, billing, usage, admin, and read-only MCP are built in disciplined phases.
- Direct social posting and DM automation are not Phase 1 dependencies.

## Local Development

This project currently needs Node 22+ for current Cloudflare tooling. The system Node in this shell is Node 20, so the initial scaffold used the bundled Codex Node 24 runtime.

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Do not run production deploys from this checkout until the deployment checklist is complete.

## Important Paths

- `docs/system-dna/` - preserved original System DNA.
- `docs/decisions/` - ADRs for implementation decisions.
- `audit/` - preserved Claude audit.
- `final-strategy/` - final Codex build strategy and logs.
- `app/` - React Router client.
- `src/server/` - Hono Worker entrypoint, environment types, agents, workflows, services, db, middleware, and MCP.

## Current Status

The repo has a clean Cloudflare template foundation and strategy docs. Product implementation starts with strict tooling, Cloudflare config, D1 schema, Hono API foundation, auth/RBAC, workspace/brand CRUD, `MarketingAgent`, and mock workflows.
