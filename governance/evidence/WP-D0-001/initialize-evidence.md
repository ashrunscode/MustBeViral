# d0-001-initialize evidence

Date: 2026-07-19. Step: `d0-001-initialize` — verify SuperDesign authentication and create the clean repository analysis.

## SuperDesign authentication verification

`npx --yes @superdesign/cli@latest search-prompts --tags "style"` executed successfully from the repository root and returned live catalog data (20 of 62 style prompts), proving the CLI is functional and the environment is accepted by the SuperDesign service. No credential error occurred.

## Repository analysis

`.superdesign/init/` authored from the actual scaffold sources: `components.md`, `layouts.md`, `routes.md`, `theme.md`, `pages.md`. The analysis records: one route (`/`), one layout, zero shared UI components (the UI package exports only the `superdesign-approval-required` implementation gate), placeholder-only dark styling, and the accepted Experience Contract tokens as the authoritative design target.

## Cleanroom intake statement

The analysis identifies only ViralGraph cleanroom V2. It contains no legacy V1 route, React Router, D1-auth, marketing-autopilot, social-posting, or System DNA instruction. Verified by the repository cleanroom scan (`pnpm cleanroom:check`) over the full tree including the new analysis files.

## Tool side-effect remediation

`@superdesign/cli init` (current CLI behavior) attempted two out-of-scope modifications that were reverted before commit: a `.gitignore` entry excluding `.superdesign` (conflicts with the packet's committed-analysis deliverable; `.gitignore` is outside WP-D0-001 allowed paths) and an unsolicited skill file under `.claude/skills/superdesign/` (outside allowed paths; equivalent workflow guidance is recorded in the research register source `src-superdesign`). The five analysis files were authored directly from repository sources instead.

## Dark-studio foundation selection (contract step: search once, select closest)

Style catalog searched once (`search-prompts --tags "style"`); full prompts retrieved for the four dark-studio candidates: `neural-noir-interface-style`, `cinematic-style`, `bold-editorial-studio-style`, `red-noir-style`. None conforms as-is: neural-noir mandates gold/bronze accents, glassmorphism, and glow (and explicitly excludes blue/violet); cinematic mandates theatrical 3D and cyan–pink gradients; bold-editorial is light-mode-first; red-noir uses a red accent spectrum. Selection: `neural-noir-interface-style` as the closest structural foundation (dark-mode interface discipline for creative tools), with every visual token, font, spacing, radius, and motion rule overridden by the accepted Experience Contract values in `.superdesign/design-system.md`. This follows the contract instruction to write the design system "using the approved product constraints."
