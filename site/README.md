# mustbeviral.com

The public site for Must Be Viral, a product of Axiom & Alloy, Inc. It's one Cloudflare Worker that serves static pages and takes waitlist sign-ups into D1.

## The rule for copy

If it isn't true yet, it isn't on the page. Anything not working today is labelled Building or Planned. No testimonials, no invented numbers, no AI customers. No person behind the company is named, pictured or described. `scripts/check-site.mjs` fails the build on machine-sounding words and claim patterns, and on the personal names listed in `scripts/private-names.txt`. That file is gitignored because this repository is public; keep a local copy.

## Layout

| Path | What |
|---|---|
| `public/` | The pages, one stylesheet, one small script, the font (Bricolage Grotesque, OFL) and `og.png` |
| `src/index.ts` | Routing, security headers, www to bare-domain redirect, noindex on every host but `mustbeviral.com` |
| `src/waitlist.ts` | Form parsing, validation and the D1 upsert |
| `migrations/` | D1 schema |
| `test/` | Unit tests (Node, fake D1) |
| `scripts/check-site.mjs` | Static checks, and live checks against a URL |
| `scripts/make-og.py` | Draws `public/og.png` |

## Run, test, deploy

```bash
npm install --legacy-peer-deps
npm run db:migrate:local
npm run dev                       # http://127.0.0.1:8787
npm run check                     # typecheck, unit tests, static checks
node scripts/check-site.mjs http://127.0.0.1:8787   # live checks (adds one test sign-up)
npm run deploy                    # check, then wrangler deploy
```

`compatibility_date` is 2026-04-01 because wrangler 4.81's local runtime supports nothing newer.

## Cloudflare

- Worker `mustbeviral-site`. `workers_dev` and `preview_urls` are false. Never turn them on.
- D1 `mustbeviral-site` (`93621a40-eb5b-4ec7-b831-a418c9de7cde`), region ENAM. Table `waitlist`, one row per email. No IP address, user agent or cookie is stored.
- Migration 0002 widened the kinds of business by rebuilding the table. It renamed the first table to `waitlist_v1` instead of dropping it; that table is empty and can be dropped once someone says so.
- Rate limit binding `WAITLIST_LIMIT`: 5 sign-up attempts a minute per IP, held in memory by Cloudflare.
- Preview: `next.mustbeviral.com` (custom domain, noindex).

Read the sign-ups:

```bash
npx wrangler d1 execute mustbeviral-site --remote --command "SELECT created_at, email, business_type, business_name, city, utm_source, utm_campaign FROM waitlist ORDER BY created_at DESC"
```

## mustbeviral.com moved from Vercel on 2026-11-08

The owner approved the preview on 2026-11-08. In one API call the two Vercel CNAMEs below were deleted and `mustbeviral.com` and `www.mustbeviral.com` were attached to this Worker as custom domains, so the gap was about a second. `routes` in `wrangler.jsonc` now lists all three hostnames. The Worker sends www to the bare domain with a 301.

Before the move the apex and www were CNAMEs to Vercel, not proxied:

| Old record id | Name | Content |
|---|---|---|
| `d500a73252c01bf3ceccde5a14c721a6` | `mustbeviral.com` | `3a62e7409b89bdf6.vercel-dns-016.com` |
| `901d9de42bcdff77492415252e8be9e4` | `www.mustbeviral.com` | `3a62e7409b89bdf6.vercel-dns-016.com` |

Never touched: the Google MX on the apex, the SPF and site-verification TXT on the apex, `google._domainkey`, `_dmarc`, `resend._domainkey`, and the SES MX and SPF on `send`. After the move all eight were compared with the snapshot taken before it and were unchanged, and 1.1.1.1 and 8.8.8.8 returned the same MX, SPF, DKIM and DMARC answers.

Rollback: take `mustbeviral.com` and `www.mustbeviral.com` out of `routes` and deploy, or detach them in the dashboard, then recreate the two CNAMEs above, not proxied. Vercel serves again as soon as DNS resolves.

The Vercel project still exists. It no longer receives traffic for this domain. Deleting it is the owner's call.
