# 17_CODE_QUALITY_AUDIT.md

## Code Quality Verdict

There is **no code** to grade. This audit lists the quality bars to enforce when code starts landing, plus the latent quality landmines already visible in `setup.py`'s template strings.

## Existing Quality Landmines (from `setup.py`)

| Issue | Location | Fix |
|---|---|---|
| `package.json` uses `"latest"` for every dep | `setup.py:55–99` | Pin specific versions; commit lockfile |
| `Env` type incomplete | `setup.py:104–110` | Add full `Env` interface (see audit 05) |
| Server entrypoint references `c.env.ASSETS` while `Env` doesn't declare `ASSETS` | `setup.py:118–120` | Add `ASSETS: Fetcher` to `Env` |
| `MarketingAgent` stub lacks 17 callable methods, has no auth/cost/audit hooks | `setup.py:144–184` | Implement per audit 07 |
| Workflow stubs are 2-step placeholders | `setup.py:204–264` | Implement per audit 08 |
| `MustBeViralMCP.init()` returns mock strings | `setup.py:194–201` | Implement read-only D1 tools |
| `0001_initial.sql` is a comment | `setup.py:283` | Replace with full schema |
| `main.tsx` renders a div placeholder | `setup.py:265–273` | Replace with React Router root + providers |
| No `tsconfig.json` / `vite.config.ts` / `tailwind.config.js` | `setup.py` | Add (see audit 16) |
| `app.use("*", cors())` is permissive | `setup.py:114` | Lock to `PUBLIC_APP_URL` |

## Dead Code

None — no code exists. Once code lands, treat unused exports / unreferenced files / unreached branches as failures (`eslint --no-unused-vars`, `ts-prune` or `knip`).

## Duplicate Code

None — no code exists. Establish convention: shared logic into `src/server/services/*` and `src/shared/*`. Don't duplicate Zod schemas between client and server — share via `src/shared/schemas/*`.

## Type Safety Issues

Future-proofing rules to enforce:

| Rule | How |
|---|---|
| No `any` without an explicit `// @ts-expect-error: <reason>` comment | ESLint `@typescript-eslint/no-explicit-any` |
| No untyped DB queries | Drizzle ORM forces typing; if raw SQL, wrap in typed helper |
| No untyped fetch() responses | All fetch wrappers parse via Zod |
| Centralized `Env` type | One file, imported everywhere |
| Strict TS | `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: true` |
| Generated types in sync | `wrangler types` script run pre-build; CI fails on diff |
| Drizzle types in sync | `drizzle-kit generate --check` in CI |

## Naming Issues

Convention to enforce:

- File names: `kebab-case.ts` for services, `PascalCase.tsx` for React components, `PascalCase.ts` for classes (DOs, Workflows, agent roles).
- Type names: `PascalCase` (e.g., `BrandProfile`, `MarketingAgentState`).
- DB table names: snake_case plural; columns snake_case (already correct).
- API route param names: camelCase (`brandId`, not `brand_id`).
- Env var names: SCREAMING_SNAKE_CASE.
- Domain language: "post" not "tweet", "media" not "asset" externally (internal `brand_assets` + `generated_creatives` is fine).

## Architecture Drift Prevention

Even greenfield projects drift. Rules to lock in:

1. **Server code never imports from `src/client/*`.** Enforce with ESLint `no-restricted-imports`.
2. **Client code never imports `src/server/*`.** Same.
3. **Both sides may import `src/shared/*`** for Zod schemas + types.
4. **Routes are thin.** Validate, call a service, return. No business logic in route handlers.
5. **Agents/Workflows orchestrate.** They call services, never duplicate them.
6. **Services are pure.** No HTTP-aware code; pass D1 / fetch / env as parameters.
7. **One purpose per file.** ~200 LOC soft cap; >400 is a code smell.
8. **No reaching into Drizzle from routes.** Routes call services that own queries.
9. **No console.log in production paths.** Use `log()` helper.
10. **No magic strings.** Status enums in `src/shared/enums.ts`; provider IDs in `src/server/services/scheduler/types.ts`; etc.

## Dependency Problems

Pre-emptively flag risky dependencies:

| Package category | Acceptable | Risky | Forbidden |
|---|---|---|---|
| HTTP client | `fetch` (native) | `axios` (Node-only by default) | none |
| ORM | `drizzle-orm/d1` | `prisma` (heavier) | TypeORM |
| Auth | `lucia-auth` (Workers compat), custom | `next-auth` | `passport` |
| Crypto | WebCrypto, `@noble/*` | `node-forge` | `crypto-js` (insecure) |
| Image manipulation | Cloudflare Images | none in-app | `sharp`, `canvas` |
| PDF | `pdf-lib` | `pdfkit` (Node) | `puppeteer` (heavy) |
| Date | native `Intl`, `dayjs` | `moment` (deprecated) | none |
| Validation | `zod` | `yup` | none |
| Test runners | `vitest` + `@cloudflare/vitest-pool-workers` | `jest` (less Workers-friendly) | none |

**Pin versions.** Replace every `"latest"` in `setup.py`'s template before scaffolding.

## Refactor Plan

Since there's no code, this is a "format the rules so future code complies" plan:

1. Add `eslint.config.js` with: `@typescript-eslint`, `eslint-plugin-import`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`, `eslint-plugin-promise`, optionally `eslint-plugin-security`.
2. Add `prettier` with default config + `.editorconfig`.
3. Add `husky` + `lint-staged` (or use `lefthook`) so `eslint --fix` runs on staged files; CI rejects failing typecheck/lint.
4. Add `knip` or `ts-prune` to catch dead code monthly.
5. Add commit lint (Conventional Commits) for changelog hygiene.
6. Document the "thin routes / pure services / orchestrating agents" rule in `CONTRIBUTING.md`.
7. CODEOWNERS for sensitive paths (auth, billing, scheduler) so changes get a second pair of eyes.

## Specific Anti-patterns to Forbid

- Direct `env.AI.run(...)` calls outside `src/server/services/model-router.ts`.
- Direct `c.env.MEDIA_BUCKET.put(...)` outside `src/server/services/media/*`.
- Direct Stripe SDK calls outside `src/server/services/billing/*`.
- D1 raw queries outside service modules.
- Browser Run calls outside `src/server/services/browser/*` with SSRF guard.
- LLM prompts hardcoded inline in route handlers.
- Forgotten audit log on mutating routes.
- `JSON.parse(c.req.headers.get("Foo")!)` without try/catch.
- Catching `Error` and silently swallowing.

A concise "do/don't" file in `docs/architecture/conventions.md` captures these from week 1.
