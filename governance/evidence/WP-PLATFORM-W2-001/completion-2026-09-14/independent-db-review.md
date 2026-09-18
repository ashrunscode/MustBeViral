I will review only the incremental DB/index and connected-verify changes against the approved source snapshot.Index hashes match the applied W2 migration. Next I will read the new indexes, 00036 coverage rule, and the connected-verify denial wrap.## Additive DB repairs approved, connected acceptance pending

Reviewed `C:\dev\bootstrap\mustbeviral-grok-w2a001-20260914\db-repaired-index.json` (base `ea835215e3bd4c028950005a1b55d3323d403261`, captured `2026-09-14T22:32:35.620Z`). Applied W2 migration hash is still `a40925ffbbe26c5f04ae8b90bfaa15f7b332b5fa0149000233a04fa1479adc9d`.

No source defects in this increment. Browser failures stay validation, not schema/script bugs.

---

### 1. `20260914020000_platform_knowledge_fk_indexes.sql` — approve to apply

Nine `CREATE INDEX` only, same pattern as `20260910140000_platform_foreign_key_indexes.sql`. Timestamp is after `20260914010000`. No rewrite, drop, RLS, grant, or data change.

Each catalog FK in `missing-fk-indexes.json` has a matching leftmost prefix:

| FK                                                               | Index                       |
| ---------------------------------------------------------------- | --------------------------- |
| `brand_source_jobs(created_by)`                                  | `(created_by)`              |
| `brand_source_jobs(workspace_id, source_id)`                     | `(workspace_id, source_id)` |
| `brand_sources(created_by)`                                      | `(created_by)`              |
| `brand_sources(workspace_id, job_id)`                            | `(workspace_id, job_id)`    |
| `brand_knowledge_drafts(created_by)` / `(updated_by)`            | matching single columns     |
| `brand_knowledge_candidates(created_by)`                         | `(created_by)`              |
| `candidates(workspace_id, job_id)` / `(workspace_id, source_id)` | matching pairs              |

FKs already covered by W2 page/supersedes indexes (`(workspace_id, brand_id, …)`, `(workspace_id, supersedes_id)`) are correctly omitted. Unique `(workspace_id, brand_id, job_id)` does **not** cover `(workspace_id, job_id)` under 00036’s prefix rule, so that new index is required.

00036 covering check (`00036_production_disabled_binding_hardening.test.sql` 20–45) matches these btree prefixes. Focused rehearsal hash `c0fbb048785eb70bf4a2d9b53ede421c0492411eeb65a8c3da54472114233815` equals the file in the index.

---

### 2. Connected verify denials — approve

`packages/db/scripts/verify-platform-knowledge-connected.mjs` wraps the **whole** `begin()` for expected denials (`assert.rejects` at 125–143, 195–207, 316–323, 389–417). Regexes still name the real failures (`permission denied for function/table`, `NOT_FOUND`, `VALIDATION_FAILED`, `NOT_FOUND|FORBIDDEN`). Success paths still assert inside transactions. Isolated DB is `mbv_platform_knowledge_` + 32 hex; `finally` drops only that name if `created`. Unexpected errors still set `exitCode = 1`.

---

### 3. `http.integration.test.ts` — approve

Companion PUT is counted in path/operation-id sets and checked for bearer security, MIME, 2MiB `maxLength`, deadline/lease copy, rest/web-only, and error envelope. No product-authority change.

Generated `database.generated.ts` includes the applied knowledge tables; indexes are not type-level.

---

### Pending validation (not source bugs)

- Apply `20260914020000` and rerun full pgTAP
- W2 desktop/mobile selector/order/viewport repairs (3 pass / 5 fail reported)
- W1 connected regression against the local stack
- Full `pnpm agent:verify` after those

Do not treat the packet as complete.
