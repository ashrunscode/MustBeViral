# MustBeViral Studio

MustBeViral Studio is the visual operating system for DTC creative production. ViralGraph turns a structured campaign brief into a transparent, versioned graph that humans and compatible agents can plan, quote, execute, inspect, refine, and export.

The cleanroom rebuild is governed from the repository. Start with:

```powershell
corepack pnpm install --frozen-lockfile
pnpm agent:preflight
```

- Human documentation map: `docs/INDEX.md`
- Current machine state: `PROJECT_STATE.yaml`
- Agent contract: `AGENTS.md`
- Active implementation slice: `docs/delivery/ACTIVE_WORK_PACKET.yaml`

Do not infer product or architecture behavior from this README; the accepted documents registered in `docs/MANIFEST.yaml` are authoritative.

## Cleanroom scaffold

The active monorepo contains:

- `apps/web`: Next.js 16 App Router on Vercel, with supported Supabase SSR cookie boundaries.
- `apps/core`: one Hono Cloudflare Worker with generated bindings, private R2/Hyperdrive candidate bindings, and a safe `/health` contract.
- `packages/*`: contracts, domain, graph, database, provider, billing, artifact, AI, UI-gate, configuration, and telemetry boundaries.
- `supabase`: local CLI configuration, ordered raw SQL migrations, deterministic seed, and database test layout.

For local application work, copy the public examples into the app-specific ignored files, start local Supabase, and then start the two applications:

```powershell
Copy-Item .env.example apps/web/.env.local
Copy-Item .dev.vars.example apps/core/.dev.vars
pnpm supabase:start
pnpm dev
```

Replace the example publishable key with the local value reported by Supabase. Do not place a service-role key in the web environment. The current web page is intentionally a scaffold; production UI implementation remains blocked until a SuperDesign artifact is approved.
