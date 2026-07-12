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

Templates are generated in a disposable directory outside the repository, inspected, and selectively copied. Scaffold commands never run over the repository and generated agent instructions are rejected.

| Source           | Exact scratch command                                                                                    | Upstream/license                                                                                                                  | Intended selection                                  | Rejected material                                         | Intake state           |
| ---------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------- | ---------------------- |
| Turborepo        | `pnpm dlx create-turbo@2.10.4 <scratch>/repo --package-manager pnpm --no-git --skip-install`             | [vercel/turborepo](https://github.com/vercel/turborepo), MIT                                                                      | workspace/task configuration patterns               | example product code, nested Git                          | approved for WP-R0-002 |
| Supabase Next.js | `pnpm dlx create-next-app@16.2.10 <scratch>/web --example with-supabase --use-pnpm --disable-git`        | [Supabase Next.js quickstart](https://supabase.com/docs/guides/auth/quickstarts/nextjs), MIT starter                              | supported auth helper/cookie patterns               | tutorial styling/content, duplicate package manager files | approved for WP-R0-002 |
| Cloudflare Hono  | `pnpm create cloudflare@2.70.10 <scratch>/core --framework hono --lang ts --no-deploy --no-git --agents` | [Cloudflare Workers guide](https://developers.cloudflare.com/workers/get-started/guide/), template license recorded during intake | Worker/Hono config and test patterns                | deployment, sample business logic, nested agent files     | approved for WP-R0-002 |
| shadcn           | exact command recorded when initialized against `apps/web`                                               | [shadcn/ui](https://ui.shadcn.com/), MIT                                                                                          | approved primitive source after design tokens exist | demo pages and unapproved theme                           | gated by design system |

For each actual intake, the implementation packet records command output, source commit/package integrity, license, copied paths, rejected paths, and modifications. Delete scratch directories after provenance is captured.

## SuperDesign sequencing

Do not initialize SuperDesign until the clean Next scaffold exists. Then verify CLI version/authentication, complete `.superdesign/init`, create the design system from accepted contracts, render three explicit branches, and wait for user approval before production UI code.
