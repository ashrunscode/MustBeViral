## Part A. Owner decisions, 2026-10-02 (verbatim grants for this run)

The owner said in chat on 2026-10-02: "give codex all authority and maker sure it works in loops till all is perfect" and "finish it, have codex finsh all palfrom fully, all approced, push him to do its best work possible". Asked whether the S0 film package (`briefs\hero\films\studio\REPORT.md`) looked right visually, the owner answered "yes". Asked who reviews the Spanish, the owner answered "have codex pick".

The owner's rules require each gated action to be named exactly. So, by sending this message, the owner grants exactly the following for this run, dated 2026-10-02:

- **A1. Lead.** "Codex, running locally on this workstation, is the lead and the only writer for MustBeViral for this run. It holds the ADR-0009 standing release authority and the MBV-FILMS-FINISH grant. The 2026-10-01 directive's sentences 'Codex never commits, pushes, merges, deploys, spends, or writes production' and 'Codex holds no release authority', and its ban on running Codex with danger-full-access, do not apply to the lead session of this run. Its other rules still apply, including the isolated read-only reviewer recipe in its section 7."
- **A2. Move past stuck packets.** "When the active packet cannot finish only because what remains waits on an input only I can supply (footage and rights, a credential, a named reviewer, an owner-only gate), or needs work outside its allowed paths that a later roadmap packet owns, Codex may supersede it under ADR-0008 into the next implementable roadmap packet. Codex may also re-point `completion.successor_packet_id` to that packet. Each supersession commits the authority-only amendment alone first, quotes this sentence as my explicit instruction in the decision record, names the predecessor and the successor, carries every unproven acceptance row and obligation forward, and never marks unfinished acceptance passed."
- **A3. New screens.** "A new signed-in screen may go live without my approval of frames or mockups when it is built from the existing tokens and primitives, scores at least 90 on the design-qa-loop rubric on every route it touches, has zero serious or critical axe violations, and passes independent review."
- **A4. Public origin.** "Set `NEXT_PUBLIC_APP_ORIGIN` to `https://mustbeviral.com` on the Vercel project `mustbeviral-web-production`, Production environment only, replacing the current value, then release through the guarded release. It is a public value. No other environment variable changes."
- **A5. Production migrations.** "Apply merged, additive, independently reviewed migrations to the Supabase project `mustbeviral-prod`, only through the Supabase MCP `apply_migration`, only after the same migration was applied and verified on `mustbeviral-staging`, and only after recording the restore point. Additive means no DROP, TRUNCATE, DELETE, data rewrite or narrowing change. Never `supabase db push`. No other production database write."
- **A6. Two Worker settings.** "(a) Deploy `mustbeviral-v2-production-collaboration` with the committed `workers_dev: true` when the pre-deploy check shows that is its only setting difference. (b) Add `https://mustbeviral.com` and `https://www.mustbeviral.com` to `CORS_ALLOWED_ORIGINS` of `mustbeviral-v2-production-core`, keeping the existing origin, through a committed `wrangler.jsonc` change and the guarded release. No other var, binding, cron, route, queue or flag change."
- **A7. Films.** "Generate S1, P1, P0, P2 and P3 with Higgsfield, spending only the credits already in the account: no purchase, no plan change. Use the Higgsfield app in Codex first, which is the route that made S0. QC each film to the S0 standard. A P0 master that passes QC and reads at 375 px replaces the film on /software; this lifts the 2026-10-02c freeze on that film."
- **A8. S0.** "The S0 package is approved visually. Ship the English wordless plate as the studio hero with a visible AI disclosure."
- **A9. Stale brand facts.** "Codex may correct `brand/context.md` sections 8b and 13 and the `brand/BRAND.md` lines that are now factually stale (legal pages published; the studio hero is a disclosed generated film; the wordmark and `apps/web/public/` facts) through an ADR-0008 authority-only amendment that adds exactly those two paths. Facts only. No new legal wording. No new Spanish."
- **A10. Development spend.** "Codex may spend the remaining development budget (about $58.56, ledger `governance/evidence/WP-PLATFORM-W2-002/development-spend-2026-09-28.yaml`) on provider calls a packet needs, each quoted and reserved in that ledger before the call."
- **A11. Spanish.** "'Have codex pick' means Codex picks the route that adds no new Spanish. Codex is not a fluent reviewer and approves no Spanish."

**Not granted. These stay with the owner.** You build everything up to them, switched off, and list what each one needs.

- DNS, domains and Vercel domain settings.
- Supabase Auth settings, including Site URL and the redirect allow-list.
- Any other environment variable, secret or project setting.
- Reading, printing, copying or rotating secrets. Loading any vault bundle except `mustbeviral-higgsfield`.
- New cloud resources. Buying credits.
- In production: enabling signup collection, generation, provider runs, queues, charging or any Stripe mode, email or SMS, Drive, or social posting.
- Deleting anything: data, branches, worktrees, deployments or backups. Force-push or history rewrite.
- GitHub settings: protection, rulesets, Actions, webhooks, visibility. PR #1 (`cursor/setup-dev-environment-b920`) stays untouched.
- Legacy V1. Traffic rulings. The 72-hour observation sign-off.
- A generated person presented as Ashley Ansons or as a client. Any fact that `brand/context.md` does not state.

Record Part A verbatim, with no other text added, in `governance/evidence/<active packet>/owner-directive-2026-10-02d.md` in your first pull request.
