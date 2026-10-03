# S0 live release proof, October 3, 2026

Run: codex-finish-20261002

Source `f97488dc220c6f1b6686f4c0642b2203baab156e`, reviewed head `56abd4b9c100f98a1ea06835c7aeee2a32acd511`, PR #71. Staging `dpl_vHurZJBF5kKQ9Jum6sTN6MhTFhDn`; production `dpl_HCxas3BjbcANLZoVVQh68q1EcHoL`. Sanitized provider/CLI identity, fresh rollback, deployment and gate receipts are retained here. Raw environment values, customer data, tokens and signed URLs are absent.

Both staging aliases and all four production aliases moved without promotion. The protected long production alias was inspected only. Staging's public alias, apex, www and the public production Vercel alias passed the complete signed-out HTTP smoke and the media-byte/description/disclosure/cache/auth-boundary probes. No form, phone link or email link was activated.

Playwright MCP used fresh signed-out Chromium contexts. Each environment's full matrix contains all 14 public routes at 375 and 1280: 28 cells with expected served deployment, one main/h1, h1 28 px, no horizontal overflow, zero console errors and no submitted form. Separate fresh 375 x 812 media contexts measured the poster before any playback request, then exercised the English film's actual Play, Pause and reduced-motion change.

| Environment | Route        | LCP ms | LCP element   | CLS | Console errors |
| ----------- | ------------ | -----: | ------------- | --: | -------------: |
| Staging     | /            |    408 | S0 poster IMG |   0 |              0 |
| Staging     | /es          |    404 | S0 poster IMG |   0 |              0 |
| Staging     | /advertising |    336 | Text          |   0 |              0 |
| Production  | /            |    568 | S0 poster IMG |   0 |              0 |
| Production  | /es          |    540 | S0 poster IMG |   0 |              0 |
| Production  | /advertising |    384 | Text          |   0 |              0 |

Both studio routes have the prioritized poster, reserved 1920 / 1080 frame aspect and no initially mounted video/track. The exact disclosure and factual English description are outside the empty-text picture. /es has document lang es, decorative empty alt, no control/video/track and English notes. Actual English playback is muted with no native overlay or track; the external pressed state is true while playing and false after Pause. Pause restores the poster. Reduced motion unmounts the clip, disables Play and announces the reason.

All six full-page captures are retained. Their stage/production pairs are byte-identical; all three unique contents were visually inspected. `s0-live-capture-identities.json` proves the reuse. The local source proof in `../browser-proof-2026-10-03-s0/README.md` supplies the four-width accessibility/state matrix, keyboard pass, axe results and measured local interaction latency. These live observations are unthrottled lab samples, not real-user percentiles or authenticated platform acceptance.

The changed routes retain their local design scores 96/96/97; the live captures confirm the same hierarchy, whole approved composition, readable disclosure and absence of overlays. Existing 15 px body/footer typography remains the specified D3 finding. The advertising page's frozen October 2 legal date remains unchanged under A8's restriction; `../owner-pack-legal-disclosure-date-2026-10-03.md` prepares its minor metadata correction, with an exact clearing sentence. No legal or Spanish approval is claimed.

This release closes only public-surfaces with D1 and A6. primary-flows and release-smoke remain pending. Remote schema lag and the founder input remain their separately recorded stops. No remote write, generation, spend, enablement, contact send or customer action occurred.
