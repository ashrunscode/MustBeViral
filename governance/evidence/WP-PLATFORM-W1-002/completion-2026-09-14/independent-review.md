I’ll finish from the final4 delta only: BrandResource permission snapshot, the test-only JWT readiness gate, and the visual CSS.## Verdict

**No required source defects** in the final4 candidate. Finish is **conditional** on parent 14/14, refreshed `pnpm agent:verify`, screenshot inspection, and evidence bind. This is not a handoff.

Prior final2/final3 failures are **not** product bugs: redundant-save assertion is now `disabled` + `Saved` status; Core 401s were JWT `iat` vs host clock, confirmed by the diagnostic logs, with **no** verifier/auth source change.

---

## BrandResource (fresh permissions)

`brand-workspace.tsx` 49–50, 85–142, 214–215:

- Keyed reset: `key={`${studioId}:${workspaceId}:${brandId}`}` drops snapshot on identity change.
- Guarded render-phase updates only: clear on error; replace only when `studio.data`/`access.data` object identity changes. No effect `setState`, no render-phase ref I/O.
- **Fresh results own grants:** `current = access.data ?? confirmed.access`. `canWrite = !waiting && current.actions.includes('brand:write')`. Location `canRead`/`canWrite` use the same `!waiting && action` gate.
- **Waiting:** `hidden`+`inert` on the subtree; frame **omits** `role` and `showBilling` (no stale owner chrome). Draft stays mounted and disabled (`canWrite` false).
- **Denial:** error path `setConfirmed(null)` and `PlatformRecovery` in the same render; form unmounts. Retry starts from `!confirmed` loading, not a cached grant.

Location writes cannot run while pending. Owner-only **settings** still receive snapshot `workspaceOwner` during waiting, but that block is inside the inert subtree and brand writes stay `canWrite === false`. Not a required hole.

---

## Visual / a11y CSS

- Forced colors: `ButtonFace`/`ButtonText` (disabled `GrayText`, `opacity: 1`); active tab `Canvas`/`LinkText` + underline/border. No `Highlight` fill, no `forced-color-adjust: none`.
- Skip: `top: 8px` + `clip-path: inset(50%)` until `:focus`/`:focus-visible`.
- Mobile nav: `flex-wrap` / `overflow-x: visible` / `white-space: normal`.
- Breadcrumb wraps identity children.

final3 already passed dirty-refresh, held-access, forced-color, skip, and nav/reflow on both viewports. Parent still inspects forced-color/zoom screenshots.

---

## Test-only clock readiness

`signIn` (`platform-connected.spec.ts` 700–735): intercepts outbound Core calls, reads **unverified** local `iss`/`iat` only, fails if skew `> 3s`, otherwise `expect.poll` until host epoch `>= iat` (5s bound), attaches `{ ahead_seconds, ready }` with **no token**, then `route.continue()`. No sleep, no failed-API retry, no fake body, no auth relaxation. Bound is appropriate for fractional WSL/Windows skew, not a verifier change.

---

## Evidence (do not pre-green)

| Check                      | Status                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| final4 browser             | **In progress** when read: desktop 1–6 already `ok`, including the dirty-refresh journey. Not 14/14 yet. |
| final3                     | 13/14; remaining miss was the same clock skew, not the new journeys.                                     |
| Lint r4b / types final     | Passed.                                                                                                  |
| agent:verify on this patch | Parent will re-run after 14/14. r3 verify is stale vs final4 source.                                     |
| Packet YAML                | Still pending until bind.                                                                                |

**Finish when:** final4 (or successor) is 14/14, `pnpm agent:verify` exits 0 on this source, forced-color/zoom screenshots are readable (active tab + disabled Save; skip clipped after main focus), and packet evidence is remapped. Successor W2-001 stays ready/inactive until then.
