# Theme and design tokens — ViralGraph cleanroom V2

## Implemented (placeholder only)

`apps/web/app/globals.css` carries a minimal dark placeholder — not the product theme:

```css
:root {
  color-scheme: dark;
  font-family: system-ui, sans-serif;
  background: #09090b;
  color: #f4f4f5;
}
```

No Tailwind, no CSS variables beyond the above, no design-token pipeline yet.

## Authoritative target tokens (accepted contract)

From `docs/ux/EXPERIENCE_CONTRACT.md` (Precision Creative Studio direction) — these govern all design work:

| Token                            | Value     |
| -------------------------------- | --------- |
| background                       | `#090A0D` |
| surface                          | `#111318` |
| elevated                         | `#171A21` |
| border                           | `#292E39` |
| text primary                     | `#F5F7FB` |
| text secondary                   | `#A7AFBF` |
| violet (active)                  | `#806BFF` |
| blue (active alt)                | `#5A96FF` |
| green (verified success)         | `#35D08A` |
| amber (attention/reconciliation) | `#F2B84B` |
| red (destructive/failed)         | `#F06B7A` |

Typography: Geist Sans (product text), Geist Mono (identifiers, prices, timings, model labels, execution evidence). Spacing: 4px base; common gaps 8/12/16/24/32. Controls: compact 32–36px, primary ≥40px, touch ≥44×44px. Radius: 6/8/12px. Motion: 120ms local, 180ms panel, 240ms route; motion communicates causality and never delays input. Color is never the only status cue. Final tokens must preserve WCAG 2.2 AA (target 7:1 where practical) through SuperDesign approval.
