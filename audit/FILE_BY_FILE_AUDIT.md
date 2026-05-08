# FILE_BY_FILE_AUDIT.md

Every meaningful file in the working tree, plus the spec docs inside the system DNA package. There is no source code, so the bulk of this table is spec assessment.

Decision codes: **Keep** = use as-is; **Refactor** = use after correction; **Rebuild** = discard and create fresh; **Delete** = remove entirely.

| File | Purpose | Current Status | Problems | Decision | Priority | Notes |
|---|---|---|---|---|---|---|
| `mustbeviral_system_dna.zip` | Original archive of spec package | Present, 54 KB | n/a | Keep (archive) | n/a | Pin into `docs/system-dna/` post-scaffold |
| `mustbeviral_system_dna_extracted/mustbeviral_system_dna/README.md` | Index for the spec set | Lists order of reading | Slightly out of date once `audit/` exists | Refactor | P3 | Update after scaffold |
| `.../RESEARCHED_PLATFORM_NOTES.md` | Cloudflare anchors + template decision | Solid | FLUX.2 ids unverified | Keep | P0 | Cross-check at impl |
| `.../PRODUCT_DNA.md` | Personas, magic moments, pricing | Strong | None major | Keep | P0 | Source of truth for product |
| `.../ARCHITECTURE.md` | Stack + flows | Solid | Onboarding flow conflates Browser Run + fetch fallback into a single arrow | Keep, annotate | P0 | Add SSRF + size cap notes |
| `.../wrangler.jsonc` | Cloudflare config | Mostly correct | Placeholders; `worker_loaders` and `ANALYTICS_INGEST_QUEUE` unjustified; FLUX ids unverified | Refactor | P0 | See audit 05 |
| `.../DATABASE_SCHEMA.sql` | D1 schema, 33 tables | Solid foundation | Missing 6 tables, 7 indexes, status CHECKs; no `password_hash`, `sessions`, etc. | Refactor | P0 | See audit 06 |
| `.../AGENT_SPEC.md` | MarketingAgent shape | Right shape | No per-call user identity, no scheduling primitive | Keep, annotate | P0 | See audit 07 |
| `.../WORKFLOWS_SPEC.md` | 7 workflow specs | Right taxonomy | Step-level retry + idempotency not deeply specified | Keep, annotate | P0 | See audit 08 |
| `.../API_CONTRACTS.md` | Route shapes | Right envelope | Many endpoints missing (auth/login, batch approve, billing, admin, analytics) | Refactor | P0 | See audit 09 |
| `.../UI_WIREFRAMES.md` | Page layouts | Solid | Empty/loading/error not standardized | Keep, annotate | P0 | See audit 10 |
| `.../COMPONENT_MAP.md` | Component decomposition | Reasonable | Missing primitives (EmptyState, ErrorBoundary, EvidenceLink, etc.) | Refactor | P1 | See audit 10 |
| `.../SECURITY_CHECKLIST.md` | Controls list | All unchecked | None of it implemented | Keep | P0 | Tracking checklist; audit 11 expands |
| `.../TEST_PLAN.md` | Test categories | Shallow | No coverage thresholds, no assertion lists | Refactor | P1 | See audit 15 |
| `.../DEPLOYMENT_RUNBOOK.md` | Deploy commands | Good | Vectorize dim mismatch; no CI section; no rollback | Refactor | P1 | See audit 16 |
| `.../COST_MODEL.md` | Cost categories | Good | No code path for enforcement | Keep | P0 | Drives `usage_events` |
| `.../CLOUDFLARE_TEMPLATES_AUDIT.md` | Template picks | Good | Some templates may be deprecated | Keep | P1 | Re-verify availability |
| `.../PROMPT_ROADMAP.md` | 84-prompt build sequence | Repetitive boilerplate; 7 filler prompts | Generic acceptance criteria block; many prompts under-specified | **Replaced by `audit/CLAUDE_CODE_FIX_ROADMAP.md`** | P0 | Keep for reference |
| `.../setup.py` | Project skeleton generator | Minimal scaffolder | Hardcoded `"latest"` deps; placeholder `0001_initial.sql`; incomplete `Env`; references undeclared `ASSETS`; doesn't scaffold from chosen template | **Discard** | P0 | Replace with template scaffold + `cf-bootstrap.ts` |
| `.../MASTER_EXECUTION_PACKAGE.md` | Concatenation of all spec files | 150 KB; no new content | Duplicates the others | Keep (archival) | P3 | Archive only |
| `.../llms.txt` | Quick reference for LLMs | Good | Mentions `src/server/services/scheduler` etc. that don't exist yet | Keep, evolve | P1 | Update as project evolves |
| `audit/01_REPO_INVENTORY.md` | This audit | Just authored | n/a | Keep | n/a | Source of truth |
| `audit/02..17_*.md` | This audit | Just authored | n/a | Keep | n/a | Source of truth |
| `audit/MASTER_AUDIT_REPORT.md` | This audit | Just authored | n/a | Keep | n/a | Source of truth |
| `audit/REPAIR_PLAN.md` | This audit | Just authored | n/a | Keep | n/a | Source of truth |
| `audit/CLAUDE_CODE_FIX_ROADMAP.md` | This audit | Just authored | n/a | Keep | n/a | Source of truth |
| `audit/FILE_BY_FILE_AUDIT.md` | This file | Just authored | n/a | Keep | n/a | Source of truth |
| `audit/AUDIT_SCORECARD.md` | This audit | Coming next | n/a | Keep | n/a | Source of truth |
| `audit/FIX_LOG.md` | Per-prompt execution log | Created on first execution | n/a | Keep | n/a | Append-only |

## Summary

**Files to keep as authoritative spec:** 13 (the spec markdowns in `mustbeviral_system_dna_extracted/`).
**Files to refactor before use:** 5 (`wrangler.jsonc`, `DATABASE_SCHEMA.sql`, `API_CONTRACTS.md`, `COMPONENT_MAP.md`, `TEST_PLAN.md`).
**Files to discard:** 2 (`setup.py`, `PROMPT_ROADMAP.md` — the latter replaced by `CLAUDE_CODE_FIX_ROADMAP.md`).
**Files to keep as archive:** 2 (`MASTER_EXECUTION_PACKAGE.md`, `mustbeviral_system_dna.zip`).
**Files this audit added:** 22 (`audit/*`).

There are zero source-code files to audit individually. Every TypeScript / TSX / SQL file required by the product must be created from scratch by following `CLAUDE_CODE_FIX_ROADMAP.md`.
