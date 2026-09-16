# Provenance — resend

| Field | Value |
| --- | --- |
| Source repository | https://github.com/resend/resend-skills |
| Source path | `skills/resend` |
| Pinned revision | `8938c2a6f17903f9168c31431c842c68a68b19f3` |
| Upstream skill version | `3.10.0` (`metadata.version` in `SKILL.md`) |
| License | MIT (full text: `LICENSE` at the source repository root) |
| Vendored on | 2026-09-15 |
| Vendored from | the workstation skill mirror of that repository at that revision, `upstream/resend/skills/resend` |
| Recorded in | the workstation skill manifest (`source`, `pinnedRevision`, `license`, `sha256` per skill) |

## Edits

None. `SKILL.md` and every file under `references/` are verbatim copies of the pinned upstream
revision: identical content, with line endings normalised to LF because this repository's
`.gitattributes` sets `* text=auto eol=lf`. This `provenance.md` is the only added file.

The directory is listed in the repository `.prettierignore` so `pnpm format:check` cannot rewrite the
verbatim copy.

## Repository note

This repository already has a fail-closed Resend adapter in `packages/email/src/index.ts`; Resend
also backs Supabase Auth SMTP (`docs/architecture/SYSTEM_OVERVIEW.md`). Use the skill for Resend API
detail, not as permission to send: sending stays behind the repository's own authority rules.

## Refresh procedure

Re-copy the whole directory from the same source path at a newer upstream revision, then update the
pinned revision, version and date above. Do not hand-edit vendored files; upstream changes belong
upstream.
