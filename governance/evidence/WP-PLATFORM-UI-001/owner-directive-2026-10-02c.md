# Owner directive, 2026-10-02, third of the day (verbatim)

Received in the Claude Code session on 2026-10-02 after the films-program release of `95deda5`
and its evidence merge `e058983`. The owner's audit preamble and the directive follow without
change.

---

What is already live on https://mustbeviral.com, from merge 95deda5:

• / and /es carry the locked lines, the $700 and $3,500 offers, the six Houston situations in English, and the phone as the only action.
• /software plays the existing film with four beats. /software/pricing shows Solo $49, Studio $149, Portfolio $399, and says charging is off.
• Search files exist: robots.ts, sitemap.ts, llms.txt, JSON-LD, and the paper Open Graph cards.
• The signed-in instrument is deployed. Calendar, inbox, tasks, creators, and results stay empty because those commands do not exist.

What is missing, and must not be invented:

• No /privacy, /terms, or advertising and AI disclosure. brand/context.md section 8 still says an agent does not write legal advice, and the Legal plugin was the required path. The street address is still unknown, so a footer cannot invent one.
• The studio header links to Software. That puts the product pitch on the studio site.
• The English Full Package on the page drops most of the section 7 list. The Spanish Full Package ships with an empty includes list.
• /es does not carry the six situations. There is still no named fluent reviewer.
• The studio hero is still a composed frame. No Higgsfield credential is in the vault, and no Higgsfield tool is connected to this session.
• No public footer exists on any page.

OWNER DIRECTIVE. Audit of origin/main at e058983, live at mustbeviral.com. You finish the public site. Do not rebuild the signed-in instrument. Do not invent a fact.

Start from a clean worktree of origin/main. The canonical checkout is behind, at 31f75de, with untracked briefs/ and .playwright-mcp/. Leave both alone. Read AGENTS.md, run pnpm agent:preflight, then read brand/context.md sections 2, 6, 7 and 8, brand/BRAND.md, and apps/web/src/components/public-copy.ts. The MBV-FILMS-FINISH grant already lets you call Higgsfield, smoke founder@mustbeviral.com read-only, and deploy the two Core Workers with global_fetch_strictly_public. It does not let you print a secret, change DNS, turn on charging, or collect signups.

## What you are correcting

The live studio page is a true document: locked headline, two prices, six trades, one phone button. It is not yet a finished studio site. These are the only public gaps:

1. There is no site footer and no legal route. Add /privacy, /terms, and /advertising. Use Anthropic's Legal plugin if it is installed. If it is not, write the pages only from facts already in brand/context.md and from what the code actually does. Entity: ERLV INC, DBA Must Be Viral. Contact: studio@mustbeviral.com and 713-899-9346. The site collects nothing on /signup. Booking is a tel: link. Access is a mailto:. Say that. Do not invent a street address, hours, a cookie, a tracking pixel, a data sale, or a training practice. The postal line reads "Houston" and names the street address as not yet published. Do not translate the legal pages into Spanish. The /es footer links to the English pages and says they are in English. Do not send email. Do not add a form.

2. Put one footer on every public page: the entity, the phone, the mail, Houston, and the three legal links. The studio header keeps Español only. Remove the Software link from the studio header and the studio pitch from the software header. A quiet footer line may name the other surface. The two pitches still never share a headline or a call to action.

3. Restore the Full Package list from brand/context.md section 7 on the English studio page. The Spanish Full Package includes array is empty. Fill it only with the deliverables already allowed in the locked Spanish copy. Add no new Spanish sentences. The six kinds of work stay off /es until a fluent reviewer is named.

4. Add /pricing for the studio. It repeats the two offers, the full section 7 lists, the add-on ranges $200–$400 and $300–$600, and the same single action. The homepage keeps both prices in the first screen. /software/pricing stays the provisional catalog, charging off, no buy button. Add both pricing URLs to the sitemap. Do not create a page per trade, per ZIP, or per neighborhood.

5. The studio hero stays the composed frame until a real film exists. Try the Higgsfield MCP first. If that tool is absent, load the vault bundle mustbeviral-higgsfield through the agent-secrets loader and run the runner already prepared under the owner's briefs/hero/films/ in the earlier worktree, without copying secrets into the repo. If neither credential exists, ship the pages without a generated film. Do not draw a person and call them Ashley. Do not draw a shop and call it a client. The software film already on /software stays.

6. Design the public pages as one system. The first screen is the decision: the line, the two prices, the one action. The six trades are six composed rows, not a stack of identical cards. Type, space, and the film carry the rank. One action color. Motion only when a film plays or a control answers. Reduced motion keeps every word. Check 375, 768, 1280, and a wide monitor. No horizontal scroll. No second visual language.

## Leave alone

Do not refill calendar, inbox, tasks, creators, or results with fake rows. Do not enable signup collection, generation, charging, or posting. Do not deploy Workers unless the pre-deploy check shows the only setting change is global_fetch_strictly_public. Do not touch DNS. mustbeviral.com already points at the production project.

## Ship

One pull request from the clean worktree. Independent review on that sha. Merge when the checks and the review pass. Deploy mustbeviral-web-staging with the recorded Vercel CLI command, smoke every public route including the three legal pages and both pricing pages, then promote mustbeviral-web-production. Rollback target is the deployment serving production when you start. Confirm mustbeviral.com serves the new id.

## Done

Report the sha, both deployment ids, the legal pages and the fact source for each, the footer, the Full Package lines restored, and whether a film shipped. If the film did not, the only remaining sentence is the Higgsfield credential in the vault inbox.
