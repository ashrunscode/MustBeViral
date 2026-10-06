# Render preflight inventory, 2026-10-06

Classification: current-source inventory. This file is not acceptance. It does not prove real-media
fidelity, a connected runtime, customer rendering, or the ADR-0010 architecture decision.

Read against `6e0ef8a50da40213512a65759324e9ac00fe976d` before the mechanics commit. Node 24.18.0.
pnpm 11.12.0. No remote call, no customer media, and no deployment.

## Sharp and the artifacts boundary

- Resolved sharp is 0.34.5. Local `sharp.versions` reports libvips 8.17.3. The same sharp version
  is already in the lockfile through Next. This change adds it as a devDependency of
  `@mustbeviral/artifacts` so the mechanics test can import it. The lockfile links that package to
  `sharp@0.34.5` and does not add another sharp build.
- `packages/artifacts/package.json` exports only `.`, which is `src/index.ts`. `apps/web` imports
  that entry from `apps/web/src/features/export/export-port.ts`. The mechanics test is
  `packages/artifacts/src/synthetic-composite.test.ts`. `index.ts` does not mention sharp, and the
  test fails if it starts to. No Worker imports this package.
- The installed library reports heif 1.20.2. That report is not HEIC/HEIF acceptance. Real-fixture
  normalization is still required.

## Still missing

`docs/delivery/QUALITY_GATES.md` still requires a real source image with exact logo and text, a
real-footage reel, captions, fonts, cover, audio rights, private transfer, cancellation, a cost
receipt, and measured memory, duration, and cost before any implementation decision. Those inputs
are absent. Footage, an approved font, and the literal offer are absent. No connected renderer and
no customer render was run.
