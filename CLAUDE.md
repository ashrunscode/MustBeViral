This repository is public. Its rules are in `README.md` ("Rules for this repository") and, for the site, `site/README.md`; read them before editing.

<!-- BEGIN CLAUDE-MODELS -->
## Models and advisor

Owner direction, 2026-11-07 (summary): use the advisor, and use Haiku, Sonnet, Opus, or Fable depending on the task. The full rule and the owner's verbatim words are in the owner's user-level Claude Code instructions; follow that text where this summary differs.

- Where the owner's Claude Code settings enable it, a Fable advisor is attached when Claude Code supports it: the Anthropic API, a supported session model, and an advisor at or above that model. Other environments may not have it; if the advisor tool is missing, say so. Change the advisor only when the user asks. A Fable advisor or `fable` subagent can bill usage credits; in `-p` or SDK runs a `fable` subagent bills without a prompt.
- When you delegate to an agent whose definition sets no `model`, pass the alias for the task: `haiku` for read-only search and mechanical edits with an exact spec, `sonnet` for routine implementation and tests, `opus` for complex or security-sensitive work and required reviews, and `fable`, sparingly, for the hardest problems. Keep a custom agent's own `model`, pass none to `fork`, and prefer an alias or `inherit` in agent frontmatter. The Agent tool's own guidance still decides whether to spawn at all.
<!-- END CLAUDE-MODELS -->
