# MustBeViral Studio — Brand Detail

Companion to `brand-id.md`. Source: live study of lightfield.app (2026-07-19) — computed CSS extraction,
full-page 1440px capture (`reference/lightfield-hero.png`), copy architecture analysis. This file
explains WHY the Lightfield language works and exactly HOW we apply each mechanism.

## 1. The psychology of reception — why Lightfield feels premium

**Restraint reads as competence.** The h1 is 28px at weight 400 with −3% tracking. A startup that
whispers its headline signals it expects to be evaluated by sophisticated buyers on substance.
Application: our headlines never exceed weight 500; hierarchy comes from space and ink-opacity, not size shouting.

**Negative space reads as confidence.** The hero headline sits in an enormous quiet field (multiple
viewport-heights of calm before content). Space says: we are not fighting for your attention.
Application: section paddings in viewport-scale units; the studio's empty states are calm fields, never dashboards of skeleton noise.

**The product is the proof.** Lightfield's only imagery is its real UI, floating as tilted paper cards
showing agents actually working ("Retrieved 17 accounts… Emails drafted"). No stock art, no 3D blobs.
Application: our marketing and empty states show the real canvas, real receipts, real QA panels — agent work rendered as evidence steps.

**Ink-opacity system reads as editorial.** All text is black at measured alphas — 0.85 strong, 0.75
headline, 0.6 body, 0.5 muted, 0.25 faint, 0.12 borders, 0.04 washes — on `lab(96.5)` paper. One
ink, many pressures: the page feels typeset, not themed.
Application: our entire neutral system is ink-alpha on paper (tokens in `design-system.md`); we never mix gray hexes.

**A single accent reads as intentionality.** One quiet blue exists on the entire page. When
everything is ink, the one colored element is understood as THE thing to do.
Application: signal blue appears exactly once per screen — on the current moment's primary action (usually Confirm).

**Oppositional copy reads as clarity.** "Traditional CRMs expect you to… Lightfield does…" — the
enemy is named structurally.
Application: "Credit-burners guess. MustBeViral quotes." / "Galleries of maybes vs. a lineage of approvals."

**Compliance-as-furniture reads as maturity.** SOC2/HIPAA/ISO badges appear quietly, like address
lines, not trophies. Changelog visible = alive and unafraid.
Application: trust markers (private-by-default media, immutable receipts, spend caps) rendered as small mono captions, ever-present, never promoted.

## 2. Type system

- **Display/UI:** Untitled Sans (Klim) — the exact Lightfield face; license it (Klim web license).
  Interim/fallback: Geist Sans (already pinned in repo) — closest available neo-grotesque discipline.
- **Evidence:** DM Mono (Google, free — Lightfield's exact technical face) for every identifier,
  price, timestamp, model route, seed, hash, receipt line.
- Scale (rem): 12 caption-mono · 13 label · 15 body (lh 1.5) · 18 section · 22 panel-title ·
  28 page-title (weight 400, tracking −0.03em). Nothing larger inside the product.

## 3. Space and surface

- Paper: `#F4F4F2` field; pure white `#FFFFFF` only for raised cards; washes at ink-0.04/0.02.
- Radii: 4px controls · 6px inputs · 8px cards · 10px floating panels; pill only for tiny status dots/badges. (Lightfield measured: 2/4/6/8/10 + pill.)
- Borders: ink-0.12 hairlines everywhere; shadows only on floating/transient layers, soft and tight.
- Density: 15px body, 36px controls, 44px touch, 8/12/16/24/32 gaps on a 4px grid — Lightfield's
  compactness with our operational density.
- Signature flourish (used sparingly, marketing/empty states only): product cards tilted 6–8° as
  floating paper, exactly like the Lightfield hero.

## 4. Voice application formulas

- Feature line = capability + evidence: "Quotes before every run. The confirm names the dollar."
- Status line = state + consequence + exit: "static-2 failed. Two verified statics retained. Retry is free."
- Numbers always exact and mono: `$4.20`, `14:32`, `rev 7f3a`, `kimi-2.6 + flux-2-klein`.
- Forbidden: exclamation marks, "magic", "supercharge", "unleash", discount language, fake urgency.

## 5. How this fuses with the research-winning composition

The 9/9/9 research verdict chose the **Review-Approval-Confidence** composition (named-amount confirm
bar, QA jump-links, no-charge retry, version comparison, receipts) with grafts (ledger table in the
receipt drawer; large-node canvas grammar). The Lightfield brand skin carries that composition:
ink-on-paper surfaces make the ONE signal-blue Confirm unmistakable; mono evidence makes receipts feel
notarized; quiet chrome gives the trust moments the silence they need to be felt. Brand and research
agree: the money moment is the brand moment.

## 6. Governance note

The accepted `docs/ux/EXPERIENCE_CONTRACT.md` carries the earlier dark-studio exploration palette; the
operator has directed a Lightfield-inspired identity (this file). Contract amendment
(`docs/ux/**`) is queued for the next packet-scope amendment; until then this brand system governs
SuperDesign exploration, which the contract itself delegates final tokens to.
