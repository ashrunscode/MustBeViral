# Approved S0 wordless studio hero implementation

Run: codex-finish-20261002

Packet `WP-PLATFORM-UI-001`, revision 3, current step `ui-008-release`. Base `c0b39c989a68b6be05f00eff883e288eb5e68cc0`. This product change implements D2 under the already adopted A8/A11 authority; its exact reviewed head and all merge/release gates belong in the pull request and subsequent release record.

The MP4 and JPEG are byte-identical copies of the approved package, using content-versioned public filenames. The component reserves the poster geometry, preloads the one priority image, mounts video only after an explicit request, keeps controls outside the picture, and cancels pending playback on Pause, reduced motion or unmount. Failed media is unmounted so retry uses a fresh video element. The silent, wordless plate has no captions track; a visible factual description and exact A8 disclosure accompany it. The Spanish page uses only a decorative poster and English notes. The advertising page repeats the exact disclosure, with its other legal wording unchanged.

| Asset                                           | Bytes     | SHA-256                                                            |
| ----------------------------------------------- | --------- | ------------------------------------------------------------------ |
| `/films/s0-studio-hero-d55af8ec3d69.mp4`        | 2,163,648 | `d55af8ec3d692af3545e001bc40d7c559fbff9c09de281da1c9a7cfca0cf01bb` |
| `/films/s0-studio-hero-poster-41da8acddb3f.jpg` | 119,229   | `41da8acddb3fbf938ba8f250228641dca41cf24414601c13ae79855d00e81fe5` |

Only these two versioned URLs receive immutable one-year cache headers. Assets are outside the signed-in namespace and the existing proxy matcher bypasses them. No typed master, mezzanine, manifest, Spanish media, optional WebM or repeated-lead captions ship.

## Demonstrated regressions

Command: `corepack pnpm --filter @mustbeviral/web exec vitest run --config vitest.config.ts src/components/studio-hero-media.test.tsx src/components/studio-hero-assets.test.ts src/components/signed-out-surfaces.test.tsx src/components/public-site.test.tsx`.

| Check                                                                    | Observed result                           | Exit   |
| ------------------------------------------------------------------------ | ----------------------------------------- | ------ |
| New regressions against the prior implementation, 10:25:53 UTC           | 16 failed, 15 passed; four files          | 1      |
| Initial implementation, 10:29:46 UTC                                     | 31 passed; four files                     | 0      |
| New failed-video remount assertions before repair, 10:31:45 UTC          | Two failed, eight passed; media test file | 1      |
| Remount repair and complete focused suite, 10:32:05 UTC                  | 31 passed; four files                     | 0      |
| Final focused suite after the shared legal-disclosure edit, 11:13:40 UTC | 31 passed; four files                     | 0      |
| Focused web lint, typecheck and build                                    | All passed                                | 0 each |

The media-only remount check uses the same command with only `src/components/studio-hero-media.test.tsx`. The obsolete assertions were rewritten as regressions; none was deleted to make the suite pass. Read-only filesystem tests lock approved asset hashes, immutable cache placement and auth-matcher separation. Before/after excerpts are retained under the browser proof's `regressions/` folder.

Browser evidence: `browser-proof-2026-10-03-s0/README.md`, with all required widths, accessibility modes, actual playback, synthetic failure/retry, latency and measured poster LCP. Local scores are 96, 96 and 97. This record does not claim deployment, completion of `public-surfaces`, legal review, Spanish approval or field performance.

## Current environment and authority

On October 3 the signed-out production home returned 200 from `dpl_CHf1B4RTTcHMRVpAkSvjKQPuQx9b`; proxied Core health was ok. Fresh read-only migration metadata still has staging at `20260917223105` (50 entries), production at `20260902154759` (39 entries), and 75 local files through `20260929017000`. Differently timestamped staging entries do not prove semantic parity. This change adds no schema dependency and applies no remote migration.

Both named Higgsfield key entries and the founder bundle remain absent. The S0 package already exists; no generation, upload or credit spend was needed for this change. The app route remains the authorized first choice for subsequent films. No signup, charging, provider run, queue event, contact send or other setting changed.

A8's official terms check was performed on October 3 at `https://higgsfield.ai/terms-of-use-agreement`, published update July 26, 2026, section 4.4. The clause still says the company does not claim ownership of Inputs/Outputs and does not restrict commercial use of Outputs. The later release record must carry the ship-day source check. This is descriptive rights-basis evidence, not legal review.
