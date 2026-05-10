# 02 — Repo State and Command Results

## Repository

| Item | Value |
|---|---|
| Working dir | `C:\Users\ernij\OneDrive\Documents\V2\dev\MustBeViral` |
| Current branch | `master` |
| Latest commit | `1864c48 Deploy MustBeViral production MVP` |
| Prior commits | `3923dfa Build Cloudflare MVP foundation`, `55daf67 Initial commit (by create-cloudflare CLI)` |
| Working tree | Clean (only `mustbeviral_system_dna.zip` untracked) |
| `git remote -v` | **empty** — no remote configured |
| Toolchain | Node v22.22.0, npm 10.9.4, Wrangler 4.90.0 |

## Commands run by this audit (read-only)

All commands ran from the repo root. Production deploy / live-Stripe / migrate-remote commands were intentionally **not** executed.

### `npm run typecheck` → ✅ PASS (exit 0)

`wrangler types` regenerated `worker-configuration.d.ts` (workerd@1.20260507.1). `react-router typegen` and `tsc -b` reported no errors. Note from Wrangler:

> Action required: Migrate from @cloudflare/workers-types to generated runtime types — `wrangler types` now generates runtime types and supersedes `@cloudflare/workers-types`. You should now uninstall `@cloudflare/workers-types` and remove it from your tsconfig.json.

Codex has not migrated yet. (Low severity — cosmetic.)

### `npm run lint` → ✅ PASS (exit 0)

`eslint .` produced no output.

### `npm run test` → ✅ PASS (exit 0)

```
RUN  v4.1.5
Test Files  5 passed (5)
     Tests  12 passed (12)
  Start at  07:15:02
  Duration  1.70s
```

This matches Codex's "5 files / 12 tests" claim exactly.

Test files: `tests/unit/auth-security.test.ts` (4), `tests/unit/envelope.test.ts` (2), `tests/unit/scheduler-model.test.ts` (2), `tests/unit/schema.test.ts` (3), `tests/unit/scaffold.test.ts` (1).

E2E specs `tests/e2e/command-center.spec.ts` (2 specs) **were not executed** by `vitest run`. Per BUILD_LOG Milestone 7, only `npm run test:e2e:list` was run; full Playwright execution still requires a managed dev-server command.

### `npm run build` → ✅ PASS (exit 0)

```
vite v6.4.1 building for production...
✓ 43 modules transformed.
[client output omitted]
vite v6.4.1 building SSR bundle for production...
✓ 206 modules transformed.
build/server/assets/server-build-Uqr7oUtW.js   522.33 kB
build/server/assets/worker-entry-Du59DTxE.js   536.33 kB
✓ built in 1.65s
```

### `npm audit --audit-level=moderate` → ⚠️ **15 vulnerabilities (5 moderate, 10 high)**

Critical/high-severity findings affecting production runtime:

| Package | Severity | Count | Notes |
|---|---|---|---|
| `hono` ≤4.12.15 | **High** | ~19 advisories | JWT alg confusion, XSS in ErrorBoundary, cache middleware private-cache miss, IPv4 bypass, basicAuth/bearerAuth timing, cookie injection, SSE CR/LF injection, prototype pollution in `parseBody({ dot: true })`, path traversal in `serveStatic`, body-limit bypass on chunked requests, etc. **Fix: `npm audit fix --force` → `hono@4.12.18`** |
| `react-router` 7.0.0 – 7.12.0-pre.0 | High | 3 | CSRF in Action processing, XSS via Open Redirects, SSR XSS in ScrollRestoration. **Fix: `@react-router/dev@7.15.0`** |
| `vite` ≤6.4.1 | High | 2 | Path traversal in Optimized Deps `.map`, arbitrary file read via dev-server WebSocket. **Fix: `vite@6.4.2`** |
| `lodash` ≤4.17.23 | High | 3 | Prototype pollution in `_.unset`/`_.omit`, code injection via `_.template` |
| `minimatch`, `picomatch` | High | 5 | ReDoS in glob handling |
| `rollup` 4.0–4.58 | High | 1 | Path traversal during build |
| `undici` 7.0.0 – 7.23.0 | High | 6 | HTTP smuggling, WebSocket parser overflow, unbounded decompression, CRLF injection |
| `brace-expansion`, `postcss` | Moderate | 2 | ReDoS, XSS in stringify |

Codex's BUILD_LOG (Milestone 2) explicitly noted "15 dependency audit findings" but did **not** run `npm audit fix` "because it can force dependency churn." The 15 findings remain unmitigated and **two of them (hono, react-router) are direct runtime dependencies of the deployed Worker.** The hono advisories include cookie injection and basicAuth timing issues that affect this app's session/auth paths.

### `wrangler deployments list --env production`

Not executed by this audit (would have required online auth and is unnecessary to verify the code-level claims). Codex's reported deploy version `2f4ead0c-3d67-4261-8867-53dc43ca5c56` is therefore **unverified by this audit** but supported by the wrangler.jsonc production env block (real D1 ID `b9a428e0-…`, real KV ID `ff374abd8ca…`, routes for apex + www).

### `npx wrangler d1 migrations apply DB --env production --remote`

**Not executed by this audit.** Production migration application is a Codex claim that we cannot independently verify without live wrangler creds. Local migration application is wired via `npm run db:migrate:local`.

## File inventory (depth 2 of repo root)

```
.dev.vars.example
.env.example
.gitignore
.husky/
.node-version
.prettierignore
.prettierrc
.react-router/
.vscode/
.wrangler/
AGENTS.md
README.md
app/                   (React Router app)
audit/                 (preserved Claude audit, 23 files)
build/                 (vite output)
codex-audit/           (this audit's output, NEW)
dev-server.err.log
dev-server.out.log
docs/                  (system-dna + decisions)
eslint.config.js
final-strategy/        (23 strategy files + BUILD_LOG.md + DECISIONS_LOG.md)
llms.txt
mustbeviral_system_dna.zip
mustbeviral_system_dna_extracted/
node_modules/
package.json
package-lock.json
playwright.config.ts
public/
react-router.config.ts
scripts/
src/server/            (Hono Worker entrypoint)
tests/                 (5 unit + 1 e2e)
tsconfig.cloudflare.json
tsconfig.json
tsconfig.node.json
vite.config.ts
vitest.config.ts
worker-configuration.d.ts   (auto-generated, 509KB)
workers/
wrangler.jsonc
```

## Read-only contract

This audit performs Read, Glob, Grep, and a small set of read-only Bash commands (npm scripts, git, npx wrangler --version). No implementation files were modified. Only files under `codex-audit/` are written.
