# Final Codex Build Roadmap

## Immediate Slice

1. Normalize docs: move System DNA to `docs/system-dna/`, keep `audit/`, keep `final-strategy/`.
2. Scaffold clean app in a safe structure.
3. Install and validate the scaffold.
4. Add strict scripts and local quality gates.
5. Replace placeholder Cloudflare config with scoped MVP config.
6. Land Hono health route, Env type, and logs.

## First Sellable Slice

Signup/login, workspace, brand creation, mocked onboarding workflow, scan progress UI, intelligence report, calendar, approvals, and manual export.

## Execution Rule

Prefer real implementation over more planning once the strategy docs exist. When external providers are uncertain, create typed interfaces and safe mocks, then continue.
