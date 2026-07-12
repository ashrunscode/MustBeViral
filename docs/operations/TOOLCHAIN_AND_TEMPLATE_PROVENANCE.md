---
doc_id: toolchain-template-provenance
---

# Toolchain and template provenance

`governance/toolchain.yaml`, root package metadata, runtime version files, and the lockfile must agree with this approved pin set:

| Tool                      | Exact version | Use                                                   |
| ------------------------- | ------------: | ----------------------------------------------------- |
| Node.js                   |       24.18.0 | LTS runtime                                           |
| pnpm                      |       11.12.0 | package manager                                       |
| Turborepo / create-turbo  |        2.10.4 | task graph and scratch scaffold                       |
| Next.js / create-next-app |       16.2.10 | web application                                       |
| React / React DOM         |        19.2.7 | UI runtime                                            |
| TypeScript                |         5.9.3 | strict compiler; next major waits for ecosystem proof |
| Wrangler                  |       4.110.0 | Cloudflare development/deployment                     |
| create-cloudflare         |       2.70.10 | Hono Worker scratch scaffold                          |
| Vercel CLI                |        55.0.0 | preview/deployment operations                         |
| Supabase CLI              |       2.109.1 | local stack, migrations, project operations           |
| SuperDesign CLI           |         0.4.0 | design workflow                                       |
| shadcn CLI                |        4.13.0 | accessible component source                           |
| Vitest                    |        4.1.10 | unit/integration tests                                |
| Playwright                |        1.61.1 | browser/accessibility/visual tests                    |

Enable strict engine checking, exact dependency saves, frozen CI installs, and lockfile-only automated upgrades. Do not add Bun, Yarn, Deno, Volta, another container runtime, infrastructure-as-code tooling, Git LFS, or standalone local Postgres.

## Official template intake

The WP-R0-002 intake ran on Windows with Node 24.18.0 in a disposable directory outside the repository. Generators received relative target paths, telemetry and deployment were disabled, nothing was copied wholesale, no nested agent contract entered the repository, and scratch deletion was verified. Generator package metadata and selected source patterns are evidence; generated dependency ranges never override this document's exact pins.

### Turborepo

```powershell
$env:TURBO_TELEMETRY_DISABLED = '1'
pnpm dlx create-turbo@2.10.4 turbo-source-pinned `
  --package-manager pnpm `
  --no-git `
  --skip-install `
  --turbo-version 2.10.4 `
  --example "https://github.com/vercel/turborepo/tree/2223a3300936845e7ac23265f69953888ed4cfd0/examples/basic"
```

- Result: exit 0; 64-file manifest SHA-256 `8ddeb92b8073542811720a336ddba90df4129c4d86be0cf494ba814877ddc093`.
- Selected: workspace globs, dependency-aware tasks, build-output exclusions, and uncached persistent development tasks.
- Rejected: both demo applications, sample product/UI code, fonts and assets, nested lockfile/Git state, pnpm 9 declaration, loose ranges, and tutorial configuration.
- Modification: `--turbo-version 2.10.4` is required because the generator otherwise emits `^2.10.4`.

### Next.js with Supabase

```powershell
$env:NEXT_TELEMETRY_DISABLED = '1'
pnpm dlx create-next-app@16.2.10 web-pinned `
  --example "https://github.com/vercel/next.js/tree/31541356c21bc389150b958379acb26aa7e97b22/examples/with-supabase" `
  --use-pnpm `
  --disable-git `
  --skip-install `
  --yes
```

- Result: exit 0; 55-file manifest SHA-256 `c4de34072d8acf461cd0b7330fc513cac9d27c829d4066f1441e7185a1b89713`; no generated `AGENTS.md` or lockfile.
- Selected: request-scoped browser/server clients, `getAll`/`setAll` cookie bridging, proxy session refresh through `getClaims()`, and supported confirmation-route semantics.
- Rejected: tutorial pages, styling, logos, theme setup, default components, loose dependency ranges, `/protected` product assumptions, and the development-only missing-environment bypass.
- Modification: the full source-commit URL is mandatory because short `--example with-supabase` reads mutable canary content. Installation remains root-owned because the example otherwise invokes pnpm 10.20.0 and resolves `latest` ranges.

### Cloudflare Hono Worker

```powershell
$env:CI = 'true'
$env:CREATE_CLOUDFLARE_TELEMETRY_DISABLED = '1'
pnpm dlx create-cloudflare@2.70.10 core-hono `
  --framework=hono `
  --platform=workers `
  --no-deploy `
  --no-git `
  --no-agents `
  --no-open `
  --no-auto-update
```

- Result: exit 0; 11-file manifest SHA-256 `f6001d6678e38b8aee40079fe16136733c76a8f69a64d82dd64dda7cbb9894ea`; C3 invoked `create-hono@0.19.4` and its intake resolved `hono@4.12.28`.
- Selected: typed Hono bindings, Wrangler JSONC schema reference, generated binding types, `nodejs_compat`, observability, source maps, and the type-generation pattern.
- Rejected: public assets, sample `/message` behavior, remote deploy command, loose ranges, nested workspace/lockfile, VS Code settings, copied generated types, and every generated instructional file.
- Modification: omit `--lang ts`. With C3 2.70.10 that option removes Hono from the eligible framework map and can silently select the generic SSR template when defaults are accepted. On Windows/Node 24, C3 telemetry cleanup caused a post-generation libuv assertion; disabling C3 telemetry produced a clean exit without changing generated files.
- Testing correction: the Hono template contains no tests. Current Worker tests use `cloudflareTest()` from `@cloudflare/vitest-pool-workers@0.18.4`; the older C3 generic template's `defineWorkersConfig`/`poolOptions` pattern was rejected.

### shadcn inspection only

```powershell
pnpm dlx shadcn@4.13.0 init `
  --cwd . `
  --template=next `
  --base=radix `
  --preset=nova `
  --yes `
  --force `
  --no-monorepo `
  --css-variables `
  --no-reinstall
```

- Result: disposable 56-file probe manifest SHA-256 `cd825b7a059e400b6d53aca1ea75c8d5d97a62b307c1b0c15798ea7d97fcd857`.
- Selected now: only the proven CLI/registry mechanism.
- Rejected now: generated CSS, `components.json`, button primitive, utility module, application-local aliases, lockfile/package changes, and unapproved theme/dependencies.
- Gate: initialization in the repository remains prohibited until SuperDesign approval. Final aliases must point at `packages/ui`. The current CLI defaults to `base-nova`, and `--yes` does not bypass the base-switch confirmation for an existing Radix project.

### Supabase local configuration

`pnpm exec supabase init --workdir <external-scratch> --yes --agent no` was run with Supabase CLI 2.109.1. The repository selects the generated local ports, Postgres 17, ordered migrations, seed path, Auth/Studio/SMTP configuration, and new-table fail-closed behavior. It disables Realtime until P2, Supabase Storage because canonical media belongs in private R2, Edge Functions, and local analytics. Tutorial comments, AI keys, unrelated experimental storage systems, and empty provider sections were rejected.

### Registry and license evidence

| Package                     | License           | Registry integrity                                                                                | Source evidence                                           |
| --------------------------- | ----------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `create-turbo@2.10.4`       | MIT               | `sha512-g0O5e654UZZEmRWCdbI9DUFDiag9BYvrdammXq6CaHWJwJq4xMe9BQoPl1wmeQTylfYRo9SJSKCZCoBBeeRGqg==` | package source `1506a114e377dd7e1e8e7a7863c42adf94a9f776` |
| `create-next-app@16.2.10`   | MIT               | `sha512-Hm/vtawpvcBcXoz3aHUVV5y70AU8SbjPRUVbGUFpYARUbekfzEjPCeNfhUBxl2qC6Y1v9zFTVQ3wHokYBEP4MQ==` | package source `9dadfd693c5d26bb3c85d1c17802f49dde244b3e` |
| `create-cloudflare@2.70.10` | MIT OR Apache-2.0 | `sha512-9X0Yv0NxWYzvv2pQtTub+IW8jz+E5vnShMItT5GFcsZwkZsYp+YuzTaA3qhug1tLO0RoZ7uUoMCFOcJhsfS6CQ==` | package source `774c09ed93600aebe73f152ea93ba0ccdc02532d` |
| `shadcn@4.13.0`             | MIT               | `sha512-5fuJ4jI/GcPeA/iTL4cJivCZuYQGXz/N3bIzyd+Gd/FM6xUCy2MxGG+LaDQuw2cjNy9zGPSFPTEmI048UwPTZA==` | package source `d0fae528221011f75a8c64a917073904c2847493` |
| `create-hono@0.19.4`        | MIT               | `sha512-0Kes3aNRqez5hv8YOqL2GQS6qdlpe7f9JuxTdj4xU4FBCo7isqoQJBCgI6pzjatvlLZB0ftT61GzvSVZF2VIBg==` | package integrity                                         |
| `hono@4.12.28`              | MIT               | `sha512-YwUvVpSF7m1yOblFPrU3Hbo8XhPheBoiyfGuII6z19LnOr6JpDnyyp7LFNrfV56wS8tpvtBFGRISHN02pDdLOA==` | package integrity                                         |

License authorities are the upstream [Turborepo license](https://github.com/vercel/turborepo/blob/main/LICENSE), [Next.js license](https://github.com/vercel/next.js/blob/canary/license.md), [Workers SDK license](https://github.com/cloudflare/workers-sdk/blob/main/LICENSE-APACHE), [shadcn/ui license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md), and [create-hono license](https://github.com/honojs/create-hono/blob/main/LICENSE).

### Compatibility decisions proven during integration

- The implementation pins current `hono@4.12.29`, not the scratch template's resolved 4.12.28.
- ESLint 10.7.0 was rejected because Next 16.2.10's React/accessibility plugins still declare ESLint 9 peers. The cleanroom pins maintenance `eslint@9.39.5` and `@eslint/js@9.39.5`; `pnpm peers check` is green.
- pnpm 11's fail-closed build policy required explicit approval of `unrs-resolver` in addition to `esbuild`, `sharp`, and `workerd`; it is the native resolver in the official Next lint dependency graph.
- Next's application compiler requires the ES2024 Promise library. Optional `typedRoutes` was rejected after Next 16.2.10 generated a global `JSX` reference incompatible with React 19's `React.JSX` namespace; route type generation remains required.
- Wrangler 4.110.0 generated types and completed a no-provision dry build with compatibility date 2026-07-12 even though its local workerd build is dated 2026-07-08.
- Shared runtime TypeScript keeps `skipLibCheck: false`. Only the Cloudflare test/tool projects use targeted `skipLibCheck: true` because official generated Worker globals intentionally conflict with DOM declarations pulled by test-tool types; production Worker types remain generated and drift-checked.

## SuperDesign sequencing

Do not initialize SuperDesign until the clean Next scaffold exists. Then verify CLI version/authentication, complete `.superdesign/init`, create the design system from accepted contracts, render three explicit branches, and wait for user approval before production UI code.
