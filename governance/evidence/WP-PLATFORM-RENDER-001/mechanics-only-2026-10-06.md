# Mechanics-only sharp proof, 2026-10-06

Label: mechanics only.

The test creates every pixel. It composites one deterministic rectangle onto a synthetic image,
then checks the dimensions and sha256. It makes no remote call and uses no customer media. It does
not claim brand fidelity, real-media acceptance, a connected runtime, or the ADR-0010 decision.

Command, from the repository root:

`corepack pnpm --filter @mustbeviral/artifacts exec vitest run src/synthetic-composite.test.ts`

Result on this workstation: exit 0. Test file `packages/artifacts/src/synthetic-composite.test.ts`,
2 passed. Output width 64, height 48. sha256
`bb31c5bdde189848ad477f153660b37734666ab75289d4420cd2c9968efd476c`. The same call repeated in the
test produced the same bytes. A stubbed `fetch` recorded no call. sharp 0.34.5, libvips 8.17.3.

`packages/artifacts` typecheck and lint exited 0 after the test. The package entry `src/index.ts`
does not import sharp.
