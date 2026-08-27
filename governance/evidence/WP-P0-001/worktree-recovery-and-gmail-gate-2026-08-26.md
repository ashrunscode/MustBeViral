# Worktree recovery and Gmail credential gate — 2026-08-26

Work packet: WP-P0-001, current step `p0-007-p0-gate-evaluation`

No email, password, JWT, confirmation token, private object key, signed URL, raw provider payload,
prompt dump, customer media, recipient address, or screening response is recorded. No GB-02 spend.

## Single-worktree recovery

The extra linked worktree `C:\Users\ernij\.codex\worktrees\224b\MustBeViral` was byte-equivalent to
`C:\dev\MustBeViral` on tracked binary patch and 21 non-ignored untracked path/hash entries at
`HEAD` `4e48e97e445b66f17006a457b98a7df1398db886`. Ignored files were not hashed; the directory was
moved intact rather than deleted.

- Backup: `C:\Users\ernij\.codex\worktree-backups\MustBeViral-224b-20260826-173615`
- `git worktree prune --expire now --verbose` then listed only `C:\dev\MustBeViral` on
  `codex/viralgraph-cleanroom`
- Dirty working tree on the canonical checkout was not reset, stashed, cleaned, or force-checked out
- Node used for preflight: `C:\nvm4w\nodejs\node.exe` `v24.18.0`; pnpm `11.12.0`
- `corepack.cmd pnpm agent:preflight` exited 0 with current step `p0-007-p0-gate-evaluation`

This proves a single linked worktree and a green preflight on this snapshot. It does not prove
inbox state, evaluator qualification, staging session readiness, or any P0 human/economic gate.

## Recruiting inbox

Gmail MCP returned `mcp:oauth-reauth-required` (token permanently revoked). The authorized Ashley
workspace label `MustBeViral/P0 Evaluator Recruitment` was not read.

No 2026-08-26 inbox count is claimed. The last real sanitized check remains
`governance/evidence/WP-P0-001/recruiting-inbox-check-2026-08-21.md` (zero replies on that date).
That file is stale for 2026-08-26.

Candidates sourced, screened, qualified, scheduled, or completed by this session: zero.
External mutations: none. No reply, draft, send, label change, incentive, pilot, deploy, or
provider spend.

## What remains

Re-authenticate Grok Gmail as the Ashley workspace that owns label
`MustBeViral/P0 Evaluator Recruitment`, then recheck that label for replies to the three
2026-08-20 permission requests. Privately screen real replies. Do not invent evaluators.
No GB-02 spend.
