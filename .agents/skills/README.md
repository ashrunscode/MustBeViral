# Repository-local agent skills

Every repository-local skill lives here in full — `SKILL.md`, `references/` and, for vendored
skills, a `provenance.md` recording source, pinned revision and license — because Codex, Cursor,
Gemini CLI and Grok all read `.agents/skills/`. Claude Code does not read `.agents/skills/`, so each
skill also has a `.claude/skills/<name>/SKILL.md` that repeats only the `name` and `description`
frontmatter and points back to the copy here. Edit a skill in `.agents/skills/<name>/` only: the
`.claude/skills/` files are pointers that must never accumulate guidance of their own, and vendored
directories are verbatim upstream copies listed in `.prettierignore`, refreshed by re-copying
at a newer pinned revision rather than hand-edited.
