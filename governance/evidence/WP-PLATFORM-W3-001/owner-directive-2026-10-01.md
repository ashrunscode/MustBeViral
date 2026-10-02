# Owner directive 2026-10-01: V2 interface program

Recorded verbatim from the owner's instruction delivered on 2026-10-01 to the local Claude Code
session on the owner's workstation. This file is the source plan for the audited supersession of
`WP-PLATFORM-W3-001` into `WP-PLATFORM-UI-001`. Its SHA-256 is recorded in
`owner-supersession-decision-2026-10-01.yaml`. The text is kept inside one fenced block so that
formatting never alters it.

```text
OWNER DIRECTIVE 2026-10-01. MustBeViral Studio, ViralGraph V2. Canonical checkout: C:\dev\projects\ashrunscode\MustBeViral. GitHub: ashrunscode/MustBeViral.

You will finish this program in one continuous run. The owner has approved the program, the copy and visual direction already written in the repo, the bug repairs, the commit, the push, the pull request, the merge, and the deploy to the existing V2 targets. Do not ask whether to proceed, which page to do first, whether a contract-faithful screen is acceptable, or whether you may commit. Those answers are in this directive. Speak to the owner only in the final report, or with one exact sentence when a hard stop is the only remaining gate.

Codex CLI 0.158.0 is the escape hatch when you are stuck. You remain the only lead. Codex never commits, pushes, merges, deploys, spends, or writes production.

## 1. One-shot rules

Work the phases in section 8 in order. A phase ends when its exit check is true. Then start the next phase in the same run.

Decide every product choice from the files in section 3. When two designs both fit those files, copy the nearest shipped screen that already passes. When the files are silent, choose the calmer, more specific, more recoverable option and record one line in the packet evidence. Do not present alternatives.

A failing command, type error, broken route, or visual defect is the next task. Repair it and continue. Do not end a turn with a plan, a question, or a partial screen you could still finish.

You are the single writer of the canonical checkout. Do not run a second writer there. Do not spawn a committee. Codex, when used, writes only in the worktree section 7 assigns.

"Perfect" means section 6 is true for every surface in section 5, the gates in section 9 are green on the merge commit, and section 10 has deployed that commit. A placeholder, a dead control, a mock row, lorem, a TODO in the UI, or a route that does not read and write the real backend fails the run.

## 2. Authority you will use, and the stops you will not cross

Local agents on this workstation hold adr-0009-standing-release-authority. This directive is the owner's approval to carry the V2 interface program through the guarded release in docs/operations/DEPLOY_ROLLBACK_AND_INCIDENTS.md and docs/decisions/ADR-0009-STANDING-RELEASE-AUTHORITY.md. Before every commit, push, pull request, merge, or deploy, read C:\dev\skills\local\git-release-quality\SKILL.md and follow it.

You may, without asking again: edit within the packet paths, commit, push, open one pull request, merge when the checks and the required review on that exact sha have passed, deploy mustbeviral-web-staging and then mustbeviral-web-production, and deploy the existing Workers mustbeviral-v2-staging-core, mustbeviral-v2-staging-collaboration, mustbeviral-v2-production-core, and mustbeviral-v2-production-collaboration when the runbook's pre-deploy check shows no Worker setting change. Staging additive migrations follow that same runbook after merge. New live screens that obey brand/BRAND.md, docs/ux/EXPERIENCE_CONTRACT.md, and the operator-approved frames in .superdesign/hifi/ are approved by this directive. They do not wait for a second design review.

Still refuse, and ask with one sentence that names the exact action:

- DNS, custom domains, traffic changes, or any cutover of mustbeviral.com. Legacy Cloudflare V1 and projects mustbeviral and must-be-viral stay as they are.
- Signup that collects data, generation, provider calls, a new queue consumer, charging, Drive connection, posting, or a live customer renderer. /signup collects nothing. /software/pricing has no buy button.
- New cloud resources. Changes to Worker vars, bindings, cron, routes, workers_dev, or queue consumers. Copying or editing secrets or environment variables. If staging returns 500 because NEXT_PUBLIC_APP_ORIGIN, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, or NEXT_PUBLIC_CORE_API_URL is missing, do not promote production and do not print values. The sentence you need is permission to set those four names on mustbeviral-web-staging from the values already on production.
- Production database writes. Deletes of data, branches, backups, rollback material, or another session's work.
- Email, SMS, social posts, HubSpot writes, and any provider spend. Spend none of the development budget.
- Publishing new Spanish as approved. No fluent reviewer is named. New Spanish stays status draft. The locked studio lines may ship.
- Any price, testimonial, reach, view, follower, lead, ROI, rating, award, hour, address, or offer that brand/context.md sections 4 and 7 do not already state.

On a hard stop: write the sentence, finish every other phase, deploy everything that is authorized, and put the stop in the report. Do not idle, and do not cross it.

Never use gh pr merge --admin, --no-verify, a force-push, or a history rewrite. Start from origin's default branch or one registered worktree. Refuse a detached HEAD. Refuse a dirty tree you did not create. One packet, one worktree, one pull request.

If the active packet is WP-PLATFORM-W3-001 or any packet that does not allow this scope, the first commit is an authority-only amendment under ADR-0008, committed alone, naming these paths and this directive. Then supersede and implement. Do not mark the render benchmark accepted. Do not claim Wave 3 exited. Do not widen a packet inside an implementation commit.

Independent review before merge is required when the diff touches auth, payments, consent, CRM, migrations, customer data, or deploy tooling, or when it exceeds 20 files. Your own reread does not count. Section 7's read-only Codex review of that exact sha is the reviewer of first resort. Record reviewer, sha, and verdict in the pull request. A new sha needs a new review. The owner's approval of this program does not waive a red check or a failed review.

## 3. Read, then act

Read AGENTS.md. Run pnpm agent:preflight. Read PROJECT_STATE.yaml and docs/delivery/ACTIVE_WORK_PACKET.yaml. Use .agents/skills/build-mustbeviral/SKILL.md. Before any UI or copy, read brand/context.md, brand/BRAND.md, docs/ux/EXPERIENCE_CONTRACT.md, packages/ui/src/tokens.ts, and packages/ui/src/styles.css. Tokens win over older hex values. Use repo-pinned Node and corepack pnpm install --frozen-lockfile.

Product truth you will not re-decide:

Two surfaces, one design system, never on the same page. Public name is "Must Be Viral". Ashley Ansons is the only named public face.

Studio, / and /es. Buyers are Houston owners and marketing leads, 3–100 employees: h1 med spa, h2 restaurants and bars, h3 gyms, h4 auto, h5 home services, h6 real estate. Job: book a test shoot. H1 "We film Houston." Sub "Weekly content for Houston businesses — Reels, photos, and a posting schedule you actually keep." Spanish H1 "Filmamos Houston." Spanish sub "Contenido semanal para negocios de Houston: Reels, fotos y un calendario de publicación que sí se cumple." CTA "Book a test shoot" / "Agende un test shoot." Phone is the only secondary. Prices near the top in plain text: Test Shoot $700 once; Full Package $3,500 a month; cadence and counts only as brand/context.md section 7. The objection "we already post" is answered: "You do. The gap is the weeks you don't. We keep the cadence so it doesn't depend on somebody remembering." No agents, runs, quotes, receipts, platform, or the software line.

Software, /software and /software/pricing. Buyer is a DTC founder or head of growth. Line: "You brief. Agents produce. You approve every dollar." Catalog Solo $49, Studio $149, Portfolio $399 per month, provisional, no checkout. Auth screens say "Request access."

Signed-in product. The buyer fears unapproved spend, the wrong brand, a pretty failure, and not knowing what is blocked. Every screen answers, in the interface: where am I, what is ready, what is blocked, what will this change or cost, how do I recover. Confirm controls name the amount. Status is state, consequence, and exit. Review is Composed Review: one Meta ad, three concepts, placements Feed 4:5, Feed 1:1, Stories 9:16, Reels. Paper and ink. One signal-fill primary action. Weight 400 headings, product type no larger than 28px. Motion only for the running filament, the traveling edge, and the 180ms arrival. Kill list: viral guaranteed, blow up, explode, crush it, game-changer, revolutionary, AI-powered as a benefit, discounts, limited time, magic, supercharge, unleash, elevate, seamless, one-stop, solutions, leverage, cutting-edge, state-of-the-art, exclamation marks, fake urgency, rounded money.

Studio home is a frame at screen width, designed at 375 first. The owner rejected a sparse document. Hero poster is a rights-cleared studio frame via next/image, the LCP element, dimensions and priority set, aspect ratio reserved. Video loads after, muted, playsInline, preload none or metadata, paused under reduced motion, with captions. If no rights-cleared studio asset exists, build the frame so the asset drops in and record that single blocker. Use no stock, no generated people, no client work without permission, no minors, and do not put the software film on the studio page.

## 4. Paint the buyer, then the screen

For each surface, before editing, write five lines in the packet evidence: buyer, moment they arrive, fear, proof they will believe, single next action. Use only brand/context.md section 2 and the experience contract. The first screenful contains the decision, the price or the cost, and the one action. Studio order: work, price, what is included, cadence, how to book. Product order: place, ready, blocked, cost, recovery. Proof is showable work with permission. No vanity metrics and no revenue or follower charts before a real integration exists.

## 5. The V2 surface list

Inventory the app against this list first. Mark each item: wired, fake, or missing. Then make every item wired. Keep behavior that already passes.

Public: /, /es, /software, /software/pricing, /login, /signup, /forgot-password, /reset-password, /verify-email, /maintenance, /unauthorized, not-found.

Studio workspace: overview, brands, calendar, approvals, tasks, creators and partners, reports, team, settings.

Brand: overview, intelligence with editable sourced findings, assets with rights, channels, campaigns, content, calendar, inbox, results. Brand name and workspace stay visible. Search and switch must not touch the wrong account.

Campaign: brief, plan, content, collaborators, approvals, calendar, results, budget. Cards show assets, reason, owner, status, and channels.

Content: source, editor, channel previews, QA, comments, approval, publishing history. Composer shows edit and preview together, with save state, undo, versions, and the approval impact before a write.

Existing flows that must remain real: portfolio, brand draft, brief, canvas, quote, run, review, compare, receipt, billing, API keys, skills, continue, internal operations.

Calendar is a view of durable scheduled revisions. Month and week on desktop, a day or list below 768. Each item shows brand, channel, status, time in the workspace zone, owner, and revision. Create, move, and cancel call the schedule command once, idempotently, and show conflict, permission failure, and stale revision in place. Say, before the write, whether a change keeps or invalidates approval.

Desktop at 1280 and wider authors the graph. Tablet uses drawers. Below 768 the phone reviews, comments, approves or rejects, reads the receipt, and exports. Unsupported actions stay visible with a one-line reason and a desktop link.

Wire screens to existing Core command and query handlers. Add a thin transport where the handler exists and the UI does not. A missing table requires the authority commit to allow the migration, then the Supabase Postgres skill: additive migration, RLS, integer money, pnpm supabase:test. Supabase owns permissions, revisions, runs, and money. Do not add a second database, a second queue authority, or a Durable Object that owns those. If no accepted command exists, ship an honest empty state and record the missing contract. Do not fake rows to look finished.

Mutations are idempotent. Money displayed is the amount the quote handler returned. Revisions are immutable. A stale write fails closed and shows the current revision. Artifacts stay private. Lists load thumbnails or metadata. Session expiry explains what was kept and returns to sign-in. Wrong tenant renders unauthorized. Kill switches render the handler's blocked state. Loading reserves final geometry.

## 6. The finish line for every screen

A screen is done only when all of these are true and you have exercised them:

1. The five questions are answered on the screen.
2. There is one primary action, and it names the outcome and any amount.
3. Data is the server's data, or the empty state names the one legal action.
4. Default, hover, focus-visible, pressed, disabled, loading, error, and success exist. Disabled text stays WCAG AA. Focus is the 2px signal outline.
5. 375, 768, and 1280 are checked. The studio page is also checked on a wide monitor.
6. The primary task works by keyboard alone.
7. Contrast, reduced motion, and forced colors hold. Status is text plus a chip, dot, or edge.
8. Copy is the approved voice. The kill list is absent. Internal words such as P1a are gone from user surfaces.
9. A mutation shows the durable result after refresh. A second click does not double-write.
10. Another workspace's data never appears.
11. No placeholder, dead control, or layout shift from late media.

Colors change only in packages/ui/src/tokens.ts. Components use semantic roles. No hex in components. No gradients, glass, glow, dark bento, cream-and-terracotta, section-sized blue, identical shadowed cards, decorative eyebrows, numbered markers on non-sequences, arrow glyphs on buttons, bold headlines, or entrance motion on every block.

## 7. When you are stuck, call Codex

You are stuck only after all three are true: you reproduced the failure, you named one cause from the code and the output, and you applied one fix that did not clear it. A contract-silent design choice that would be expensive to reverse also counts. A hard stop in section 2 does not. Call Codex for the hard stop is forbidden.

At most two Codex calls per defect. The second call includes the first result and the new evidence. After the second failure, park the defect with the reproduction and the files, continue every other phase, and put it in the report. Do not loop.

Codex holds no release authority. Its output is a claim until you reproduce it. You review the diff, run the tests, and integrate. Never give Codex a secret, a signed URL, a customer record, or a path under %USERPROFILE%\.agent-secrets, .local-data, or a wrangler config. Tell it not to read those.

Use a fresh PowerShell process. Strip credential-like variables, then run Codex. Plugin use is allowed only when the plugin runs this same flag set. Never use --sandbox danger-full-access, --dangerously-bypass-approvals-and-sandbox, or --approve-for-me. Never drop --ignore-user-config or --ignore-rules. If the sandbox will not start, stop that call. Do not fall back to a looser sandbox.

Diagnosis, read-only, current worktree:

Get-ChildItem Env: | Where-Object Name -match 'KEY|TOKEN|SECRET|PASSWORD|CLOUDFLARE|BRIGHTDATA|SUPABASE' | ForEach-Object { Remove-Item "Env:$($_.Name)" }
codex exec --ignore-user-config --ignore-rules --ephemeral --sandbox read-only -c 'windows.sandbox="elevated"' -c 'shell_environment_policy.inherit="core"' -c 'web_search="disabled"' --disable apps --disable plugins --disable remote_plugin --disable computer_use --disable browser_use --disable browser_use_external --disable browser_use_full_cdp_access --disable in_app_browser --disable in_app_local_automation --disable memories --disable multi_agent --disable image_generation --disable hooks --disable skill_mcp_dependency_install -C "<worktree>" -o "$env:TEMP\mbv-codex-last.md" "<prompt>"

A code fix uses --sandbox workspace-write and -C set to a new worktree created with git worktree add from the current HEAD at C:\dev\worktrees\mustbeviral\codex-<short-slug>. Do not point that write at the canonical checkout. Do not delete the worktree afterward. Leave it if it holds unique work.

The Codex prompt contains: the defect, the reproduction command, the files to read, the expected behavior, the paths it may edit, the paths it must not edit, and this sentence: "You have no authority to commit, push, merge, deploy, spend, or write any database outside this worktree. Do not read secrets." For the merge review, use the read-only form on the exact sha and require a verdict of PASS or FAIL with file:line findings. Apply every FAIL, then review the new sha.

## 8. Phases

A. Preflight. Clean tree, packet authority committed if required, gap inventory written. Exit: you have a complete wired/fake/missing list and a legal branch.

B. Public studio and software pages, both languages on the studio side, auth and status screens. Exit: section 6 on each public route, voices unmixed, signup stores nothing.

C. Signed-in shell and navigation, studio, brand, campaign, and content routes, including every calendar. Exit: each route loads real state or an honest empty state, and switching workspace cannot show the wrong brand.

D. Brief, canvas, quote, run, composed review, receipt, billing, approvals, composer, team, settings. Exit: the primary task on each completes against the handler, including a forced stale-revision failure and a recovery.

E. Defect sweep. Typecheck, lint, unit, integration, and the journeys in B–D. Fix every defect in the web app, the UI package, the contracts, and the handlers those screens call. Out-of-scope bugs become named blockers. Exit: the sweep list is empty or parked after two Codex calls.

F. Browser proof. Exercise each changed journey: type, save, fail, recover, leave, return, refresh. Cover 375, 768, and 1280, plus the wide studio page. Cover empty, loading, error, denied, stale, and success. Exit: evidence files exist for those passes and the five questions still hold after refresh.

G. Gates. pnpm agent:verify and the packet's governance, design, repository, and database commands. Exit: each command's exit code is 0 on the commit you will merge.

H. Release, section 10. Exit: production web serves the merge sha, or the report names the one hard stop that prevented it.

## 9. Tests and bugs

For each behavior you change or fix, add a regression test that fails if the defect returns, then fix the cause. Do not silence a test, weaken a type, or hide a failure in a fallback. Use systematic debugging: one cause, one fix. Keep a repair log with the command and the result.

Browser proof is mandatory for UI. A single screenshot is not proof. Follow the changed data onto every route that reads it.

## 10. Release

Commit in meaningful steps. No secrets. Push and open one pull request whose body lists the sha, the surfaces, the repairs, the check results, the review verdict, and the hard stops not crossed.

When review is required, run the read-only Codex review on that sha. Repair, recommit, re-review. Merge by the repository's normal merge only when checks are green and the recorded verdict is PASS on that sha.

From a fresh clone of the merge, run pnpm verify and pnpm supabase:test against the repo's local Supabase. Deploy with the recorded root-checkout commands only. Project rootDirectory is apps/web. Do not pass --cwd apps/web, --env, or another Vercel project. Smoke every public route and one signed-in journey on staging. A 500 is a defect to fix, or the env hard stop. On smoke failure, roll staging back to the previous good deployment, fix forward, and repeat. Promote mustbeviral-web-production only after staging smoke passes. Then the production Workers, only if their settings will not change. Confirm the alias serves this sha.

Update only the packet fields the repo allows. agent:handoff while a real blocker remains. agent:finish only when every criterion is proven.

## 11. The only report

When the run ends, report the merge sha, the deployment ids and aliases, each gate's exit code, the screens completed, the bugs fixed and their tests, any parked defect with its reproduction, and any hard stop with the one sentence that clears it. If production is not serving this sha, name the gate that is still open. Do not describe a deployment you did not run.
```
