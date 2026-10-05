# Internal operations access repair

Run: codex-finish-20261002.

## Reproduction and change

On base `66a3ba4e7db6f597ecaa51f7a616fcde6e0712d4`, the internal panel mounted for any authenticated workspace route. It immediately requested `get_workspace`, read the general authenticated kill-switch RPC and subscribed to saved browser campaign progress. Neither workspace membership nor the workspace identifier establishes a platform-operator permission. The panel also presented a fixed catalog amount as operational reconciliation information.

The repair closes the panel before mounting those readers or subscriptions. The existing platform heading and empty-state primitives explain that operations access is unavailable, that no operations data is loaded or changed, and that this release has no approved operator permission or operations query. Its single recovery action returns to `/studio`. The route no longer passes a workspace identifier into the panel. The workspace breadcrumb and main landmark use the same plain name, Operations. No role, email, JWT claim, browser setting or caller-supplied identifier is treated as permission.

## Authorization boundary and unfinished capability

The workspace layout retains its existing authenticated session boundary. Core's registered REST, CLI and MCP operations and authenticated actor contract contain no platform-operator grant or internal operations query. Core's unknown REST routes return its existing `NOT_FOUND` envelope without creating operations access. No new operations endpoint, grant, permission schema or global-administrator role is introduced by this repair. The general authenticated kill-switch RPC serves ordinary product safety states and remains unchanged.

This is a closed unavailable surface, not a completed operator console or a proof of a positive operator grant. A database-owned operator permission, shared authorization handler and denial/revocation tests remain a carried obligation for ROADMAP W6.1 permissions. The current packet forbids `supabase/migrations/**`; this repair does not broaden it. L3f's positive UI/Core operator-capability verification remains unproven and must be carried at transition. `primary-flows` and `release-smoke` remain pending.

## Checks observed before the commit

- The new mounted component regression failed on the original panel: Core was read once without an operator grant, exit 1. After closing the panel, it passes, exit 0, and asserts no Core, Supabase, progress read or subscription, no operations cards, one recovery link and the visible unavailable state.
- The preview journey initially failed because its status locator also matched the preview banner. The corrected locator identifies the operations status by its heading. The four journeys passed at 375, 768, 1280 and 1920 px, exit 0, including refresh, no operations requests, no horizontal overflow and keyboard recovery.
- An initial targeted lint run found an unused compatibility prop. Removing the prop and its route plumbing resolved it; no lint rule was disabled. A shell quoting failure in targeted formatting was rerun with a glob that contains no parenthesized path. Formatting passed.
- The author C4 database pre-step, `agent:verify`, `packet:verify`, `format:check` and `diff-scope:check` all exited 0. Local migration versions exactly match all 75 files through `20260929017000`. The source checksums were verified unchanged across the gate run. Node 24.18.0, pnpm 11.12.0, Supabase 2.109.1 and Playwright 1.61.1 were used.
- The first native Playwright MCP check at 375 px found zero axe violations and zero incomplete results, with the unavailable heading, status and recovery link present in the accessibility tree. Its connection then returned `Transport closed` during the wider matrix and on a minimal retry. That first cell alone does not satisfy the complete browser-proof requirement.

The first full author gate pass preceded the breadcrumb/landmark name repair. Its new browser regression failed on the old Internal operations label, exit 1. The four final preview journeys then passed, exit 0. The complete author recheck of the final five source files ran from 17:36:43 to 17:46:36 UTC: the database pre-step, agent:verify, packet:verify, format:check and diff-scope:check all exited 0. The wrapper completed with actual exit 0 and unchanged source hashes. SQL coverage remains 61 files and 1,181 assertions. The earlier pass alone is not used as proof of the changed shell label.

Fresh exact-commit verification, the complete native browser matrix, independent review, merge and guarded release are pending at this checkpoint. No acceptance row is advanced and no release is claimed here. The final evidence record must identify the actual completed results.
