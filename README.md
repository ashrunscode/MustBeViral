# Must Be Viral

The rebuild starts here. Must Be Viral is an AI social autopilot for local businesses, made by Axiom & Alloy, Inc. It's in development and not for sale.

| Folder | What |
|---|---|
| `site/` | mustbeviral.com: the public site and the waitlist, one Cloudflare Worker with D1 |

## Where V2 went

Everything from V2, its code, its governance packets and its full history, is kept at the tag `v2-archive` (commit `2c2a7be`). Nothing was force-pushed or deleted from history. `git checkout v2-archive` brings it all back.

Six commits that only existed on one laptop are kept on the branch `archive/local-viralgraph-cleanroom-20260911`.

## Rules for this repository

- If it isn't true yet, it isn't on a public page.
- No person behind the company is named, pictured or described on a public page.
- This repository is public. No secrets, no customer data, no `.env` files.
- No GitHub Actions. Checks run locally: `npm run check` inside each folder.
