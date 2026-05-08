# PROMPT_ROADMAP.md

Use these prompts sequentially in Claude Code/Codex. After each prompt, run typecheck, tests, and build where applicable.

## Repository/Template Setup

### Prompt 1: Inspect the current repo, list broken/obsolete files, and create a migration plan that preserves useful ideas while isolating old code.

Goal:
Inspect the current repo, list broken/obsolete files, and create a migration plan that preserves useful ideas while isolating old code.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 2: Scaffold the Cloudflare react-router-hono-fullstack-template into a clean app directory and verify npm install, dev, build.

Goal:
Scaffold the Cloudflare react-router-hono-fullstack-template into a clean app directory and verify npm install, dev, build.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 3: Add baseline Tailwind/ShadCN-style design tokens and premium command-center shell.

Goal:
Add baseline Tailwind/ShadCN-style design tokens and premium command-center shell.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 4: Add project README, llms.txt, ARCHITECTURE.md, and strict TypeScript config.

Goal:
Add project README, llms.txt, ARCHITECTURE.md, and strict TypeScript config.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Cloudflare Config

### Prompt 5: Create wrangler.jsonc with D1, R2, AI, Browser Run, Workflows, Queues, Durable Objects, Vectorize, vars, and env blocks.

Goal:
Create wrangler.jsonc with D1, R2, AI, Browser Run, Workflows, Queues, Durable Objects, Vectorize, vars, and env blocks.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 6: Add .env.example and secrets documentation.

Goal:
Add .env.example and secrets documentation.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 7: Create Cloudflare resource setup scripts and placeholder validation.

Goal:
Create Cloudflare resource setup scripts and placeholder validation.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 8: Add worker entrypoint and Hono app bootstrap.

Goal:
Add worker entrypoint and Hono app bootstrap.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Database

### Prompt 9: Create D1 migrations for all Phase 1 tables.

Goal:
Create D1 migrations for all Phase 1 tables.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 10: Create DB service wrapper with typed query helpers.

Goal:
Create DB service wrapper with typed query helpers.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 11: Add Drizzle or lightweight typed schema layer and Zod schemas.

Goal:
Add Drizzle or lightweight typed schema layer and Zod schemas.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 12: Write migration tests and seed script.

Goal:
Write migration tests and seed script.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Auth/Workspace/Brand

### Prompt 13: Implement auth signup/login/logout/me routes.

Goal:
Implement auth signup/login/logout/me routes.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 14: Implement workspace CRUD and membership RBAC.

Goal:
Implement workspace CRUD and membership RBAC.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 15: Implement brand CRUD, soft delete, and brand switcher data.

Goal:
Implement brand CRUD, soft delete, and brand switcher data.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 16: Build create workspace and create brand UI.

Goal:
Build create workspace and create brand UI.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## MarketingAgent

### Prompt 17: Implement MarketingAgent Durable Object class with state, callable methods, and workflow callbacks.

Goal:
Implement MarketingAgent Durable Object class with state, callable methods, and workflow callbacks.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 18: Add agent route bridge from Hono to MarketingAgent.

Goal:
Add agent route bridge from Hono to MarketingAgent.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 19: Implement agent activity logging and broadcast event model.

Goal:
Implement agent activity logging and broadcast event model.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 20: Add tests for agent state transitions.

Goal:
Add tests for agent state transitions.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Onboarding Workflow

### Prompt 21: Implement BrandOnboardingWorkflow skeleton with durable steps and progress reporting.

Goal:
Implement BrandOnboardingWorkflow skeleton with durable steps and progress reporting.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 22: Connect create brand to onboarding start.

Goal:
Connect create brand to onboarding start.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 23: Build scan progress UI with evidence feed.

Goal:
Build scan progress UI with evidence feed.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 24: Mock onboarding workflow outputs for local development.

Goal:
Mock onboarding workflow outputs for local development.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Browser Run / Research

### Prompt 25: Implement browser-run service with safe URL validation and SSRF guard.

Goal:
Implement browser-run service with safe URL validation and SSRF guard.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 26: Implement website fetch fallback service.

Goal:
Implement website fetch fallback service.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 27: Implement website extraction schemas for services/offers/voice/visuals.

Goal:
Implement website extraction schemas for services/offers/voice/visuals.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 28: Write tests for blocked URLs, invalid URLs, and extraction mocks.

Goal:
Write tests for blocked URLs, invalid URLs, and extraction mocks.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Brand Intelligence

### Prompt 29: Implement brand intelligence report generator.

Goal:
Implement brand intelligence report generator.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 30: Implement marketing score calculation with evidence.

Goal:
Implement marketing score calculation with evidence.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 31: Build Brand Intelligence Report UI.

Goal:
Build Brand Intelligence Report UI.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 32: Add acceptance tests for report generation.

Goal:
Add acceptance tests for report generation.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Brand Profile

### Prompt 33: Implement brand profile versions and locked fields.

Goal:
Implement brand profile versions and locked fields.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 34: Build Brand Profile editor UI.

Goal:
Build Brand Profile editor UI.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 35: Implement regenerate/lock/use-in-content actions.

Goal:
Implement regenerate/lock/use-in-content actions.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 36: Add audit logs for profile edits.

Goal:
Add audit logs for profile edits.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Target Market

### Prompt 37: Implement target market report generation.

Goal:
Implement target market report generation.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 38: Build Target Market page.

Goal:
Build Target Market page.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 39: Add cross-sell and upsell opportunity generation.

Goal:
Add cross-sell and upsell opportunity generation.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 40: Add tests for target market schema.

Goal:
Add tests for target market schema.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Content Calendar

### Prompt 41: Implement ContentCalendarWorkflow.

Goal:
Implement ContentCalendarWorkflow.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 42: Create content calendar tables/services.

Goal:
Create content calendar tables/services.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 43: Build calendar month/week/platform views.

Goal:
Build calendar month/week/platform views.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 44: Build post detail drawer.

Goal:
Build post detail drawer.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Approval Queue

### Prompt 45: Implement approval actions and state transitions.

Goal:
Implement approval actions and state transitions.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 46: Build desktop approval queue.

Goal:
Build desktop approval queue.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 47: Build mobile swipe approval.

Goal:
Build mobile swipe approval.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 48: Add keyboard shortcuts and batch approvals.

Goal:
Add keyboard shortcuts and batch approvals.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Media/Image

### Prompt 49: Implement R2 upload service.

Goal:
Implement R2 upload service.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 50: Implement media library UI.

Goal:
Implement media library UI.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 51: Implement FLUX image generation service with model routing.

Goal:
Implement FLUX image generation service with model routing.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 52: Implement Cloudflare Images variant metadata and UI.

Goal:
Implement Cloudflare Images variant metadata and UI.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Scheduler

### Prompt 53: Define SchedulerProvider interface.

Goal:
Define SchedulerProvider interface.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 54: Implement ManualExportAdapter.

Goal:
Implement ManualExportAdapter.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 55: Implement VistaSocialAdapter skeleton.

Goal:
Implement VistaSocialAdapter skeleton.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 56: Implement BufferAdapter skeleton.

Goal:
Implement BufferAdapter skeleton.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 57: Implement ApprovalSchedulingWorkflow with retries and manual fallback.

Goal:
Implement ApprovalSchedulingWorkflow with retries and manual fallback.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## DM Automation

### Prompt 58: Implement dm_rules and dm_events routes.

Goal:
Implement dm_rules and dm_events routes.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 59: Build DM Automation UI.

Goal:
Build DM Automation UI.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 60: Implement safe DM rule generator.

Goal:
Implement safe DM rule generator.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 61: Add approval/compliance checks for DM rules.

Goal:
Add approval/compliance checks for DM rules.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Analytics/Reports/Growth

### Prompt 62: Implement analytics snapshot ingest.

Goal:
Implement analytics snapshot ingest.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 63: Implement WeeklyReportWorkflow.

Goal:
Implement WeeklyReportWorkflow.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 64: Build Reports page and report viewer.

Goal:
Build Reports page and report viewer.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 65: Implement GrowthOpportunityWorkflow and page.

Goal:
Implement GrowthOpportunityWorkflow and page.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Billing/Admin/MCP

### Prompt 66: Implement Stripe checkout, portal, and webhook skeleton.

Goal:
Implement Stripe checkout, portal, and webhook skeleton.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 67: Build Admin Dashboard.

Goal:
Build Admin Dashboard.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 68: Implement MustBeViralMCP read-only server.

Goal:
Implement MustBeViralMCP read-only server.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 69: Add usage/cost tracking dashboard.

Goal:
Add usage/cost tracking dashboard.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

## Testing/Deployment/Hardening

### Prompt 70: Add unit tests for all services.

Goal:
Add unit tests for all services.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 71: Add integration tests for full onboarding mock path.

Goal:
Add integration tests for full onboarding mock path.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 72: Add Playwright E2E tests for core journey.

Goal:
Add Playwright E2E tests for core journey.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 73: Add security checklist automation where possible.

Goal:
Add security checklist automation where possible.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 74: Run typecheck/test/build and fix all failures.

Goal:
Run typecheck/test/build and fix all failures.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 75: Deploy staging and run smoke tests.

Goal:
Deploy staging and run smoke tests.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 76: Prepare production deployment runbook.

Goal:
Prepare production deployment runbook.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 77: Polish UI empty/loading/error states.

Goal:
Polish UI empty/loading/error states.

Files to inspect:
- llms.txt
- ARCHITECTURE.md
- src/server/**
- src/client/**
- wrangler.jsonc
- DATABASE_SCHEMA.sql

Files to create/edit:
Decide minimally based on the goal. Do not edit unrelated files.

Acceptance criteria:
- The requested capability is implemented or scaffolded with clear typed interfaces.
- All new code is TypeScript strict-compatible.
- All route boundaries use Zod validation where applicable.
- Multi-brand/workspace constraints are preserved.
- No unsafe DM/publishing behavior is introduced.
- Relevant tests are added or updated.

Tests to run:
- npm run typecheck
- npm run test
- npm run build

Failure checks:
- No `any` unless justified in a comment.
- No plaintext secrets.
- No Node-only APIs in Worker runtime.
- No broken imports.
- No skipped core tests.

Do not touch:
- Do not remove multi-brand architecture.
- Do not make chat the main UI.
- Do not bypass approval guardrails.

### Prompt 78: Hardening pass 4

Goal:
Perform a focused hardening pass on the current implementation. Identify one class of defects, fix them, and add tests.

Files to inspect:
- all changed files
- tests
- llms.txt

Acceptance criteria:
- One concrete defect class is improved.
- Tests added or updated.
- typecheck/test/build pass.

Do not touch:
- Do not change product scope.
- Do not remove guardrails.

### Prompt 79: Hardening pass 5

Goal:
Perform a focused hardening pass on the current implementation. Identify one class of defects, fix them, and add tests.

Files to inspect:
- all changed files
- tests
- llms.txt

Acceptance criteria:
- One concrete defect class is improved.
- Tests added or updated.
- typecheck/test/build pass.

Do not touch:
- Do not change product scope.
- Do not remove guardrails.

### Prompt 80: Hardening pass 6

Goal:
Perform a focused hardening pass on the current implementation. Identify one class of defects, fix them, and add tests.

Files to inspect:
- all changed files
- tests
- llms.txt

Acceptance criteria:
- One concrete defect class is improved.
- Tests added or updated.
- typecheck/test/build pass.

Do not touch:
- Do not change product scope.
- Do not remove guardrails.

### Prompt 81: Hardening pass 7

Goal:
Perform a focused hardening pass on the current implementation. Identify one class of defects, fix them, and add tests.

Files to inspect:
- all changed files
- tests
- llms.txt

Acceptance criteria:
- One concrete defect class is improved.
- Tests added or updated.
- typecheck/test/build pass.

Do not touch:
- Do not change product scope.
- Do not remove guardrails.

### Prompt 82: Hardening pass 8

Goal:
Perform a focused hardening pass on the current implementation. Identify one class of defects, fix them, and add tests.

Files to inspect:
- all changed files
- tests
- llms.txt

Acceptance criteria:
- One concrete defect class is improved.
- Tests added or updated.
- typecheck/test/build pass.

Do not touch:
- Do not change product scope.
- Do not remove guardrails.

### Prompt 83: Hardening pass 9

Goal:
Perform a focused hardening pass on the current implementation. Identify one class of defects, fix them, and add tests.

Files to inspect:
- all changed files
- tests
- llms.txt

Acceptance criteria:
- One concrete defect class is improved.
- Tests added or updated.
- typecheck/test/build pass.

Do not touch:
- Do not change product scope.
- Do not remove guardrails.

### Prompt 84: Hardening pass 10

Goal:
Perform a focused hardening pass on the current implementation. Identify one class of defects, fix them, and add tests.

Files to inspect:
- all changed files
- tests
- llms.txt

Acceptance criteria:
- One concrete defect class is improved.
- Tests added or updated.
- typecheck/test/build pass.

Do not touch:
- Do not change product scope.
- Do not remove guardrails.
