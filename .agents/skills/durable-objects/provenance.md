# Provenance — durable-objects

| Field | Value |
| --- | --- |
| Source repository | https://github.com/cloudflare/skills |
| Source path | `skills/durable-objects` |
| Pinned revision | `b052c32bab7dd493513260228a36c88294f343f1` |
| Upstream skill version | not declared in upstream `SKILL.md` frontmatter |
| License | Apache-2.0 (full text: `LICENSE` at the source repository root) |
| Vendored on | 2026-09-15 |
| Vendored from | the workstation skill mirror of that repository at that revision, `upstream/cloudflare/skills/durable-objects` |
| Recorded in | the workstation skill manifest (`source`, `pinnedRevision`, `license`, `sha256` per skill) |

## Edits

None. `SKILL.md` and every file under `references/` are verbatim copies of the pinned upstream
revision: identical content, with line endings normalised to LF because this repository's
`.gitattributes` sets `* text=auto eol=lf`. This `provenance.md` is the only added file.

The directory is listed in the repository `.prettierignore` so `pnpm format:check` cannot rewrite the
verbatim copy.

## Repository note

`AGENTS.md` gates Durable Objects to P2 work. Vendoring the skill does not change that gate; read
`AGENTS.md` and the active work packet before using it.

## Refresh procedure

Re-copy the whole directory from the same source path at a newer upstream revision, then update the
pinned revision and date above. Do not hand-edit vendored files; upstream changes belong upstream.
