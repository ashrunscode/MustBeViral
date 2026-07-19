---
doc_id: platform-playbooks
---

# Canonical Platform Playbooks — Distribution-Algorithm Reverse-Engineering (2025-2026)

Scope: drives MustBeViral launch-pack QA rules and per-platform export presets. Priority is current 2025-2026 behavior; items tagged **[HYPOTHESIS]** are inferred, leaked, or third-party-unconfirmed and must not become hard blocks. Primary launch destination is Meta (Instagram/Facebook); other destinations follow.

---

## 1. TikTok (For You feed + Spark Ads / TikTok Shop)

### Ranking signals (weight order)

- **Watch-time / completion / rewatch** — single strongest signal (official: finishing a longer video is weighted above weak signals). ~40-50% of ranking weight [HYPOTHESIS on exact %]; 2025-26 virality bar risen to **~70%+ average completion** (was ~50% in 2023-24). Replays stack on first-view completion.
- **Shares (esp. DM/off-platform re-shares)** — 2025 shift: shares and saves now **outweigh likes**; a share = high-value social proof.
- **Saves / favorites** — high-weight utility signal; save-worthy content pushed as evergreen.
- **Comments** — high weight, 2025 emphasis on comment _quality_ over volume; threads extend session time.
- **Likes** — moderate, explicitly down-weighted vs shares/saves/completion.
- **Follows earned from a video** — strong interest signal.
- **Video information** (captions, sounds, hashtags, on-screen/spoken keywords) — moderate; drives interest-graph matching AND in-app **search** ranking.
- **Rising/trending sound participation** — content pooled into a sound's shared distribution set; trending audio ~+21% impressions, strongest in the sound's first ~24-48h.
- **Commerce/conversion signals (Shop)** — product-card clicks, add-to-cart, checkout, purchase; GMV Max optimizes to **purchases**, not clicks/impressions.
- **Device/account settings** (language, country, device) — weak tie-breakers only (official).
- **NOT direct factors** (official): follower count; whether the account had prior hits — every video is re-tested.
- **Originality gate** — since **15 Sep 2025**, reused/recycled/other-app-watermarked clips lose recommendations, search ranking, organic reach, and Creator Rewards eligibility.
- **Intentional diversity injection** — system seeds out-of-graph content, so a strong hook can break a cold audience.
- **Negative signals** — fast swipe-away / low first-3s retention, "Not interested," hide, report suppress reach.

### Format specs

9:16, 1080x1920, MP4/MOV, H.264/H.265, 30fps+; in-feed ad file <=500 MB. Statics also 4:5 (1080x1350) and 1:1 (1080x1080), but 9:16 is native. Base runtime **6-10s** (complete, loopable); opportunity variants 21-34s and 60-180s (education/demo/Shop, being distributed wider in 2025-26; feed supports up to 10 min). Safe zones (approximate/**[HYPOTHESIS]** — re-verify vs live UI): top ~130px, bottom ~484px, right ~120-140px. Hook window: brand/product legible by **~3.0s** (frame <=90 @30fps). Caption up to ~2,200 chars incl. hashtags; lead with primary search keyword in first 1-3 words; 3-5 hashtags (1 broad + 1-2 niche). Audio effectively required; paid/Spark use must draw from the **Commercial Music Library** or cleared original audio (trending consumer sounds often not licensable). No third-party watermarks. Spark Ads promote an existing organic post (engagement compounds); can exceed 60s / non-9:16.

### Tactics (why they work)

- **3-Second Scroll-Stop Hook** — open on payoff/pattern-interrupt/curiosity gap in frame 1, product legible by ~3s. _First-3s retention gates surviving the initial ~300-500 test batch; the strongest official signal._
- **Completion-Engineered Runtime** — cut to what content can hold (tight 6-10s loop, or trim 30s to 21-24s) to clear ~70%. _Completion is the dominant input; a fully-watched short beats a half-watched long._
- **Seamless Loop / Rewatch Bait** — engineer last 0.5s back into frame 1, or withhold a detail. _Replays stack on completion, inflating effective watch-time._
- **Emerging-Sound Ride** — attach a rising commercial sound in its first 24-48h. _Shared-pool distribution; early participation up to ~3x views, +21% impressions._
- **Signature Original-Audio Branding** — founder VO / branded intro phrase for demo/Shop content. _Builds audio brand, satisfies originality gate, outperforms mismatched trending audio on product-led content._
- **TikTok-SEO Keyword Layering** — say the keyword, show it on-screen in first 3s, lead the caption with it. _Feeds interest graph + in-app search (major Gen-Z channel) for evergreen discovery._
- **Save/Share Trigger** — one explicit "save this before you buy" / send-worthy moment. _Shares and saves now outweigh likes._
- **Comment-Bait Open Loop** — plant a question/unstated detail viewers finish in comments. _Substantive comments up-weighted in 2025; threads extend session time._
- **Native Watermark-Free Originality** — real person/product on-screen, clean export. _Post-15-Sep-2025 unoriginal content is de-recommended and demonetized — originality is an eligibility gate._
- **Shoppable Winner → Spark/GMV Max Ladder** — tag product, prove organically, amplify top performers via Spark, feed GMV Max (aim 20-50 creatives/product). _Commerce feeds/GMV Max optimize to purchases; Spark compounds engagement (~+30% completion, ~+142% engagement); creative volume drives 3-4x GMV._

### Strategies

- **Test-Batch Survival Cadence** — treat every post as a fresh audition; post 1-2 quality videos/day; protect first 30-60 min (~300-500-user batch → 1k-5k → 10k-50k → 100k+ cascade); ship 3-5 variants/concept (20-50/product for Shop); reply to early comments; don't delete underperformers.
- **Hook-Retention-Payoff Arc** — storyboard to the retention curve: 0-3s hook+keyword+product; 3-8s deliver on the promise (hold ~60% at 15s / ~50% at 30s); land payoff/CTA at the loop seam; QA on measured 3s-hold and average completion.
- **Dual-Discovery: Sound + Search** — Engine 1 (spike): version onto 1-2 emerging commercial sounds in-window; Engine 2 (evergreen): same clip optimized for TikTok SEO for a long search tail.
- **Organic-to-Commerce Amplification Ladder** — (1) tagged shoppable organics → (2) rank by completion + save/share + product clicks → (3) re-run winners as Spark Ads → (4) graduate into GMV Max; keep 20-50 creatives/product; monitor Creative Hub for GMV drivers.

### Platform QA (TikTok-specific)

9:16 & >=1080x1920, MP4/MOV, H.264/H.265, >=30fps. Duration 6-10s, one loopable idea (flag opportunity to also render 21-34s / 60-180s). Hook <=3.0s and brand/product visible by <=3.0s. Safe zones: nothing critical in top 130px / bottom 484px / right 140px. Audio present & non-silent full duration; paid/Spark/GMV Max audio MUST be Commercial Music Library or cleared original (block consumer trending sounds on paid). No third-party/editor watermark in any frame. Caption keyword in first 1-3 words; <=2200 chars; 3-5 hashtags with >=1 niche. On-screen text restates keyword in first 3s, legible. Loop: final 0.5s visually continuous with first 0.5s. Shoppable: product tag/CTA inside safe zone (above bottom 484px band). Reject if measured 3s hold < 50% functional-hook floor (where preview data exists).

### Sources

TikTok Newsroom "How TikTok recommends videos" (official); TikTok originality policy + integrity/authenticity (official); GMV Max help + ads blog (official); Hootsuite/Sprout 2026 algorithm guides; The Conversation academic explainer; Opus.pro length/retention + hook data; d3mfollow test-batch mechanics; Dash Social trending-sound data; admanage.ai ad specs/safe zones; bigseller unoriginal-content enforcement; dataslayer GMV Max performance.

---

## 2. Instagram (Reels + Feed) & Facebook — Meta (PRIMARY destination)

### Ranking signals

- **Reels — Watch time / avg watch time** — **#1 driver** (Mosseri, Jan 2025); retention past 3s gates further reach; highest weight for cold reach.
- **Reels — Sends per reach (DM shares)** — strongest amplification signal, materially above likes (~3-5x [HYPOTHESIS on multiple]); Mosseri names "sends" as what he'd optimize.
- **Reels — Likes per reach** — normalized like-_rate_ is an explicit quality signal; rewards small accounts.
- **Reels — "Your activity"** — officially the single most important input for _who_ sees a reel (personalization).
- **History of interacting with the poster** — relationship strength; boosts warm-audience delivery.
- **Information about the reel** — audio, visuals, popularity. **Information about the poster** — follower count/engagement (minor).
- **Feed ranking order** — (1) your activity, (2) post info incl. popularity + recency, (3) poster info, (4) your history with them.
- **Explore** — engagement velocity matters _much_ more than Feed; the cold-discovery surface.
- **Stories** — viewing/engagement history + closeness; recency-weighted; favors connected audience.
- **Facebook Feed** — meaningful interactions (comments/back-and-forth) weighted far above passive likes; reshares strong.
- **Originality weighting** — original favored; near-duplicate/aggregated reels demoted; IG may replace a repost's recommendation with the original. ~10 reposts/30 days ≈ de-recommendation **[HYPOTHESIS on threshold]**.
- **Quality demotions (official)** — low-res, watermarked (esp. other-app logos), muted, or bordered reels made "less visible."
- **Engagement-bait demotion (official)** — like/share/comment/tag/vote-baiting demoted across FB & IG.
- **Ads/Advantage+** — creative diversity is a serving signal; native 9:16 sound-on in-safe-zone gets ~2x Reels delivery, lower CPR.
- **Ads — sound** — audio is a ranking input + performance driver (up to ~13% higher incremental conversions; 70-80% viewed sound-on).

### Format specs

Reels/Stories/vertical: 9:16, >=1080x1920 (export 1440x2560 HD), H.264/H.265 MP4/MOV, 30fps+, <=4GB. Unified 2026 safe zone: text/logo/CTA out of top ~14% and bottom ~20% organic / ~35% ads; sides ~6%; keep key content in middle ~80% horizontally (Smart Zoom on 20:9). Feed images/carousels: 4:5 (1080x1350) recommended, 3:4 (1080x1440) native since May 2025, 1:1 legacy. Grid renders ~3:4 — keep elements off top/bottom edges. Motion-clip target 6-10s, sound-on, hook in frame 1; ads best under ~15s. Ad copy: primary ~125 chars (~40 visible on Reels/Stories before "more" — front-load), headline ~27-40, description ~27 **[HYPOTHESIS on exact truncation]**. 20%-text rule retired but keep on-image text minimal and in safe zone. Reels default Sound On; avoid muted. Advantage+ Creative: `enable_standard_enhancements` deprecated (API v22, Jan 2025); since Feb 2025 new Sales/Leads/App campaigns launch with enhancements pre-selected — review per asset.

### Tactics (why they work)

- **3-Second Hold Hook** — strongest visual/verbal payoff in frame 1 + burned-in hook line, never a logo card. _Avg watch time is #1; ~50% drop in first 3s; strong hooks up to ~89% higher completion._
- **Send-Worthy Payoff** — one "you have to see this" moment per clip. _Sends per reach is the heaviest cold-reach amplifier._
- **Made-for-Meta Native Cut** — clean 9:16, no other-app watermark, no borders, full-bleed, native captions, sound-on. _Meta demotes watermarked/bordered/muted/low-res; native earns ~34.5% lower CPR, ~2x delivery._
- **Sound-On Design** — licensed/trending audio or clear VO; caption for sound-off but never silent. _Audio is an explicit ranking input; music/VO up to ~13% higher conversions._
- **Loop & Rewatch Engineering** — match final frame to first, or end on a replay-rewarding cliff. _Watch time counts replays cumulatively._
- **Carousel Swipe-Depth** — 4:5 multi-slide: hook slide → value → CTA. _Carousels average ~1.4x single-static reach._
- **Conversation-Sparking Caption** — genuine specific question, never "tag a friend/like if." _FB weights real threads; but engagement-bait is demoted, so the ask must be authentic._
- **Creative Diversification Set** — >=3 distinct variations (hooks, 4:5 vs 9:16, static vs motion, all copy sets) into one Advantage+ ad set. _AI treats variety as a matching signal._
- **Trial Reels Hook A/B** — two hook variants to non-followers, promote the higher watch-time/sends winner. _Clean cold-audience read with no follower bias._
- **Safe-Zone Text Discipline** — captions/price/logo/CTA inside the unified safe zone. _UI occlusion kills comprehension/completion; safe-zone drives lower CPR._

### Strategies

- **Retention-First Launch Cadence** — build the 6-10s clip with frame-1 hook + seamless loop; run two hooks as Trial Reels 24-48h; keep higher 3s-hold + sends-per-reach; publish winner, then boost. Post several Reels/week; re-test hooks each launch.
- **Original-Only Distribution Hygiene** — never repost/aggregate on the primary handle; strip watermarks/borders; full-bleed >=1080x1920 with audio; keep repost ratio near zero (~10/30 days threshold **[HYPOTHESIS]**); scrub engagement-bait phrasing.
- **Advantage+ Creative Feeding** — upload the full matrix (4:5 + 1:1 + 9:16 statics, motion clip, all 3 copy sets); review each Standard Enhancement per asset (music/animation/text-reposition on by default since Feb 2025); read at ad-set level; refresh lowest-delivery weekly.
- **Cross-Surface Format Matrix** — 9:16 motion → Reels/Explore (cold reach); 4:5 carousels → Feed depth (1.4x reach); Stories → warm audience + link taps; FB → comment-thread posts. Ship 9:16, 4:5, 1:1 every launch.

### Platform QA (Meta-specific)

9:16 & >=1080x1920 (prefer 1440x2560); duration 6-15s (target 6-10s); has_audio true (reject muted); no watermark; no letterbox/pillarbox; safe zone top 14% / bottom 20% (35% for ad CTA) / sides 6%; hook within first 3s, no logo-only open; statics include 4:5 AND 9:16 (1:1 optional, reject if only 1:1); caption has no engagement-bait regex `(tag a friend|like if|share if|double[- ]?tap if|comment .{0,15} (below|to (get|enter|win))|vote (for|below)|follow (for|to))`; primary_text <=125 chars with value in first ~40, headline <=40; creative_variation_count >=3; container mp4/mov, codec h264/h265, fps>=30, <=4GB.

### Sources

Instagram official "ranking explained"; Meta Transparency Center engagement-bait + FB ranking; Meta for Business Reels ad specs; Meta Advantage+ / Standard Enhancements help; SocialMediaToday relay of Meta hook/diversification guidance; scheduling-tool IG + FB 2026; Hootsuite IG 2026 (Trial Reels, originality); Later per-surface + carousel; Jon Loomer Advantage+ behavior; adsuploader safe zones; dataslayer Mosseri-signal relay + repost [HYPOTHESIS]; posteverywhere Trial Reels.

---

## 3. YouTube Shorts

### Ranking signals

- **Viewed vs Swiped Away (VVSA)** — primary stop-power signal; native analytics metric; best performers 70-90%, sub-~60% rarely scale. HIGH.
- **Engaged views** (conscious multi-second watch) — governs monetization/YPP, NOT total views. HIGH for revenue.
- **Average percentage viewed / retention** — loops push effective retention past 100%. HIGH.
- **Total views** (any playback/replay, since **Mar 31, 2025**) — now a vanity/reach counter, decoupled from earnings. LOW for distribution.
- **Personalization / watch-history relevance** — Shorts ranked by video+topic, not channel (Ritchie: "We look at video and topic"). HIGH.
- **Explore/exploit** — every Short tested on a small audience regardless of channel (Vollucci). Structural.
- **Direct engagement** (likes/comments/shares/replays) — feeds exploit. MEDIUM.
- **Metadata/topic relevance** (speech, captions, on-screen text, title, description, hashtags analyzed together) — MEDIUM, matters most for search.
- **Thumbnail + title CTR** — ZERO in-feed (autoplay, no thumbnail); MEDIUM on off-feed surfaces (search, channel grid, home shelf, subscriptions, suggested).
- **Content ID gate** — a Short over 60s with an active Content ID claim is blocked globally / not monetizable. Pass/fail.
- **Shorts↔long-form separation** — separated recommendation systems; a weak Short no longer drags long-form.
- **[HYPOTHESIS]** newness/freshness boost reported ~Dec 2025 — unverified lore.

### Format specs

9:16 (1080x1920 target) or 1:1; wider = long-form. Max length to classify as Short: **3 min** (standard channels since Oct 15 2024; Official Artist Channels since Dec 8 2025). Studio's 6-10s is favorable for VVSA/replays. Audio over 60s: use Audio Library / royalty-free only (Content ID over-60s = global block). Safe area: clear right ~12% (action rail) and bottom ~15-20% (caption/CTA). Hashtags 3-5; **hard limit — >60 total hashtags = all ignored**; #Shorts optional. Description: first ~125 chars shown — front-load keyword. Custom 9:16 thumbnail affects off-feed only. Since Mar 31 2025 any playback = a public view; engaged views separate.

### Tactics (why they work)

- **1.5-Second Stop-Scroll Hook** — visual pattern interrupt + one promise in first ~1.3-1.8s. _Targets VVSA; 50-60% drop in first 3s; immediate hook retains ~19% more._
- **Seamless Loop Close** — final frame flows into opening. _Feeds retention; every replay counts as a new view since Mar 2025._
- **One-Promise Title Card** — single present-tense active-verb promise on-screen. _Drives the conscious continue-watch behind engaged views; clarifies topic._
- **2-4 Second Cut Cadence** — change visual every 2-4s (6-12 states per 20s). _Sustains hold power; high-retention Shorts average ~1 cut / 2-4s._
- **Spoken-Keyword Triple Match** — keyword in title + first 125 chars of description + spoken/captions. _YT analyzes speech/captions/text/metadata together._
- **Off-Feed Thumbnail Craft** — legible 9:16 thumbnail for evergreen Shorts. _CTR lever on off-feed surfaces only; wasted on the autoplay feed._
- **Topic-Coherent Single-Payload** — one tight topic per Short. _Ranked by video+topic; gives small channels an independent shot._
- **Content-ID-Safe Audio Swap** — royalty-free for anything over 60s; licensed songs only in under-60s cuts. _Over-60s + Content ID = global block/demonetization._
- **Shorts-to-Long Funnel Pin** — end/pin a CTA to related long-form. _Exploits the separation; discovery without long-form risk._
- **Consistent Fresh-Drop Cadence** — steady topic-varied volume. _Maximizes the explore lottery + any newness boost [HYPOTHESIS]._

### Strategies

- **Explore/Exploit Volume Engine** — each Short an independent lottery ticket; ship 2-4/week (DTC), varied topics; when one clears ~70-90% VVSA, produce 2-3 variants; read VVSA + avg % viewed in first 24-48h; kill/iterate under 60% VVSA.
- **Dual-Format Discovery-to-Depth Funnel** — Shorts as reach layer, long-form/PDP as depth, linked both ways; post aggressively (systems separated); Short hooks → pinned/end CTA routes to long-form/store.
- **Retention-First Creative System** — standardized stack: 1.5s hook (VVSA) → one promise (engaged views) → 2-4s cuts (hold) → seamless loop (replays); QA each export.
- **Engaged-View Monetization Optimization** — optimize for engaged views not raw views; prioritize first-3s hold + clear single promise; protect audio/rights compliance for >60s; report engaged-view rate + VVSA.

### Platform QA (Shorts-specific)

9:16 (1080x1920) or 1:1; duration <=180s (default 6-10s passes); if >60s, audio MUST be royalty-free/Audio Library (hard fail otherwise); hook within first 1.5s (text overlay OR scene cut within ~45 frames @30fps); cut cadence <=4s between scene changes; title <=100 chars with primary keyword; keyword in first 125 chars of description; hashtags 1-5, HARD FAIL if >60 total; safe area right 12% / bottom 20% clear; caption/subtitle track present; loop continuity last↔first frame; evergreen Shorts require a custom 9:16 thumbnail; report VVSA + engaged-view rate NOT raw views.

### Sources

YouTube Help "three-minute Shorts" + longer-Shorts FAQ (official); Sprout/PPC.land Mar 31 2025 view-count change; TubeBuddy engaged-views; The Leap (Ritchie/Vollucci quotes, Galloway VVSA thresholds); TrueFutureMedia; vidIQ + air.io Shorts↔long-form separation; Opus.pro hook + retention data; Shortimize explore/exploit; wbcomdesigns + miraflow off-feed thumbnails; crklr SEO; joinbrands 60-hashtag limit; Hootsuite overview.

---

## 4. YouTube (long-form / 16:9 on-demand)

### Ranking signals

- **CTR** — HIGH at impression/gating layer; necessary not sufficient.
- **Average View Duration / avg % viewed** — HIGH ranking-layer; ranking network predicts expected watch time via weighted logistic regression (Covington 2016).
- **CTR × AVD (watch-time share)** — HIGH; Test & Compare picks winner by watch-time share, NOT raw CTR — scored jointly.
- **Viewer-satisfaction signals** (surveys, likes, shares, "Not interested," dislikes) — RISING/HIGH; official second objective; 2025-26 explainers claim satisfaction at/above raw watch time **[HYPOTHESIS on weight]**.
- **Session contribution** — HIGH for Browse/Suggested; REINFORCE off-policy work (Chen 2019) optimizes cumulative session reward. Why series/playlists win.
- **Viewer personalization** (watch/search history, subs) — HIGH but viewer-side (candidate generation).
- **Interest affinity / co-watch** ("viewers of A also watched B") — MEDIUM-HIGH, primary Suggested driver.
- **Keyword/semantic relevance** (title, description, transcript, tags) — HIGH for Search; tags LOW.
- **Early velocity** (first 24-48h) — MEDIUM; expansion trigger, mechanism **[HYPOTHESIS]**.
- **Channel reputation/quality** — CONTEXTUAL, heaviest on borderline/YMYL.
- **Freshness/cadence** — LOW; YT explicitly does not favor by upload timing except time-sensitive queries.
- **Return/new-viewer mix** — MEDIUM; healthy channels >10% returning.

### Format specs

Thumbnail 1280x720, 16:9, min 640px wide, <=2MB, JPG/PNG/GIF, sRGB; keep bottom-right ~120x40px clear (duration stamp). Master 16:9, >=1920x1080 up to 4K, H.264 MP4, AAC-LC, 24-60fps, ~8Mbps 1080p SDR. Title max 100 chars (truncates ~40-50 on mobile). Description max 5000, ~157 chars above fold. Tags max 500 chars (low weight). Shorts cutoff <=3 min. Mid-roll needs >=8:00. Chapters: min 3, first at 00:00, each >=10s. End screens: final 5-20s. Captions/transcript recommended.

### Tactics (why they work)

- **Curiosity-Gap Packaging** — thumbnail shows stakes, title states payoff; no duplicated on-image text. _Maximizes CTR at gating; Test & Compare rewards highest CTR×AVD._
- **8-Second Value Hook / Cold Open** — core promise in first 8-15s, no intro. _Attacks the 10-20s cliff (~55% first-minute churn); lifts early retention._
- **Retention Re-hook Pattern** — new open loop / pattern-interrupt every 30-60s, chaptered payoffs. _Sustains AVD, the dominant ranking signal, esp. past minute 8._
- **Session-Extending Series & Playlists** — named series + end screen + pinned playlist. _Maximizes session contribution (REINFORCE objective)._
- **Co-Watch Targeting for Suggested** — mirror topic/length/packaging of the buyer's current videos. _Earns Suggested via interest-affinity._
- **Search-Intent Anchoring (SEO spine)** — title + first description line + spoken opening around a real autosuggest query. _Keyword relevance is the primary Search factor; captures bottom-funnel buyers._
- **Native Test & Compare Variants** — 2-3 thumbnail + 2-3 title variants, auto-select over ~7-14 days. _Optimizes the exact CTR×AVD metric; ~37% avg CTR lift, winner in ~70% of tests._
- **Satisfaction-Signal Prompts** — like/share ask at a genuine high-satisfaction beat; honest title-content match. _Feeds satisfaction objective; mismatch depresses satisfaction even at high CTR._
- **DTC Front-Loaded Demo & Founder Story** — product-in-use payoff in opening frames; open founder story on conflict, not timeline. _Lifts first-30s retention on high-consideration content (video converts better at $40+ AOV)._
- **Review-Seeding Co-Watch Web** — seed product to mid-tier reviewers (<150k subs); link owned content. _Builds co-watch graph, adds high-retention Suggested + External traffic._

### Strategies

- **Traffic-Source Portfolio** — Search-anchored evergreen (bottom-funnel), Browse-optimized weekly series (top-funnel), Suggested co-watch content; target Browse 25-40% / Search 15-30% / Suggested 15-25% / External 5-15% / returning >10%; diagnose per video (low CTR→packaging, low AVD→retention, low Search→SEO).
- **Packaging-First Production** — lock title + thumbnail + hook before filming; validate the curiosity gap; always launch 2-3 Test & Compare variants; at 7-14 days iterate packaging if CTR below median, re-cut only if AVD is failing.
- **Retention-Engineered Edit** — cold-open (0-8s) → restated promise (8-15s) → re-hook every 30-60s → chaptered payoffs → mid-roll only at high-retention beat (>=8:00) → 20s end screen (subscribe + next-video/playlist); benchmark relative retention, re-edit steepest drop.
- **DTC Consideration Funnel** — founder story (trust/Browse) → demo & deep review (Search) → comparison/FAQ/objection (bottom-funnel Search) → seeded third-party reviews; PDP in first description line + pinned comment; UTM tracking; cross-link via end screens.

### Platform QA (long-form-specific)

Thumbnail exactly 1280x720, 16:9, sRGB, <2MB, JPG/PNG; bottom-right ~120x40px clear; on-image text <=4 words / <=30 chars, glyph >=45px, contrast >=4.5:1; >=2 (ideally 3) thumbnail + >=2 title variants; title <=100 chars, keyword in first 40; title text does not duplicate thumbnail text; description >=200 chars (<=5000) with keyword + hook + CTA link in first 150; video 16:9 >=1920x1080 H.264 MP4 AAC-LC 24-60fps; runtime >=3:01 (>=8:00 if mid-roll); value delivered within first 15s, no intro >5s; >=3 chapters (first 00:00, each >=10s); end screen 5-20s with exactly one subscribe + one next-video/playlist element; every video in >=1 named series/playlist; SRT attached.

### Sources

YouTube Help recommendation system + "How recommendations work" (official); "How YouTube Works" + YouTube Blog (satisfaction); Covington 2016 (watch-time prediction); Chen 2019 (REINFORCE session value); influencermarketinghub Test & Compare; humbleandbrag traffic sources; retentionrabbit 2025 benchmark; prepublish first-30s; marketingagent satisfaction 2025; Hootsuite + vidIQ; itsfundoingmarketing DTC ($40+ AOV, <150k seeding); PPC.land home-feed change **[HYPOTHESIS]**.

---

## 5. X (Twitter) — For You feed + X Ads (Grok era)

2023 open-source Heavy Ranker is the still-valid numeric baseline; 2026 xai-org repo confirms direction; exact 2026 weights undisclosed **[HYPOTHESIS on magnitudes]**.

### Ranking signals (leaked weights, like=0.5 baseline)

- **Reply-engaged-by-author** (you reply back) = **75.0** (~150x a like) — strongest positive. CONFIRMED.
- **Reply** = 13.5 (~27x a like). CONFIRMED; 2026 ~27x [HYPOTHESIS].
- **Good profile click** = 12.0. **Good click / dwell** = 11.0; **2+ min dwell** = 10.0. CONFIRMED — dwell heavily rewarded.
- **Repost** = 1.0 (2x a like); 2026 ~20x [HYPOTHESIS]. **Like** = 0.5. CONFIRMED.
- **Bookmark** — high-weight "lasting value," ~10-12x a like [HYPOTHESIS on magnitude], existence CONFIRMED.
- **Video watch** — video-50% = 0.005 per-prob but volume-dominant; Grok watches every video; ~80% of sessions include video.
- **New 2026 positive actions** (xai-org): favorite, reply, repost, quote, click, profile click, video view, photo expand, share, dwell, follow-author (15 actions; Final Score = Σ weight × P(action)).
- **Negatives** — "Not interested" = **-74.0**; report = **-369.0** (strongest penalty); block/mute strong negatives (block ~-74, mute ~-31 [HYPOTHESIS]). CONFIRMED (existence).
- **Engagement velocity (first 15-30 min)** — ~10+ engagements → out-of-network expansion; <3 → dies. Direction CONFIRMED, thresholds [HYPOTHESIS].
- **Recency** — visibility halves ~every 6h [HYPOTHESIS on half-life], strong recency CONFIRMED.
- **Author reputation (TweepCred)** — gates reach; two-tower User Tower. CONFIRMED.
- **Premium/Verified multiplier** — ~4x in-network / ~2x out; scheduling-tool 18.8M-post study measured ~10x median impressions (Premium+ ~15x). CONFIRMED.
- **External-link penalty** — outbound URL in body cuts reach ~50-90%; free accounts ~0% median engagement on link posts since Mar 2025. CONFIRMED — a top lever.
- **Out-of-network retrieval** — ~50% in-network (Thunder) / ~50% out (Phoenix two-tower embeddings). CONFIRMED.
- **Grok semantic match** — Grok reads every post/watches every video; heuristics/hashtags deprecated; on-image text, spoken audio, product shown, alt text drive topical matching. CONFIRMED.
- **New candidate sources (May 2026)** — mutual-follow graph + curated "starter packs" [HYPOTHESIS on magnitude].
- **Author diversity** — one-post-per-author-style diversification per session. CONFIRMED (structural).

### Format specs

In-stream single image renders ~16:9 and auto-crops otherwise (1600x900 or 1200x675). Ship statics: 16:9 (1600x900), 1:1 (1080x1080), 4:5 (1080x1350), 9:16 (1080x1920); JPG/PNG <=5MB; GIF <=15MB; min ad width 800px. Native video: MP4/MOV, H.264+AAC, 16:9/1:1/9:16, non-Premium max 2:20, 30fps recommended, muted autoplay (captions required). Motion clip: 6-10s, 9:16, exactly 1080x1920, burned-in captions, product/offer visible + spoken (Grok-readable). Ad image >=800px, 1.91:1 (>=800x418) or 1:1 (800x800). Link-card image 1200x628. Carousel/Collection 2-6 slides, 1.91:1 or 1:1. Live DTC ad products: Promoted, Vertical Video, Amplify pre-roll, Dynamic Product Ads, Collection, Follower, Takeover, X Live. Safe area: logos/text out of top 10% and bottom 10%; hook in first ~200 chars / 2 lines. Free body cap 280 chars (Premium 25,000, feed-truncated).

### Tactics (why they work)

- **Reply-Bait + Author Reply-Back Loop** — end a variant with an open question, brand replies to early replies in first 30-60 min. _Stacks reply (13.5) + reply-engaged-by-author (75.0), the two highest in-network signals._
- **Link-in-First-Reply (never body)** — PDP URL only in the author's first/pinned reply. _In-body links cut reach 50-90%; free accounts ~0% since Mar 2025._
- **Native Vertical Motion Clip** — 9:16 1080x1920 native with burned-in captions. _Video in ~80% of sessions; Grok watches every video; maximizes dwell + 50%-playback; captions cover muted autoplay._
- **First-15-Minute Ignition** — publish at peak, seed 3-10 genuine engagements fast. _Velocity in first 15-30 min is the strongest amplifier (~10+ → Phoenix expansion); ~6h decay._
- **Grok-Readable Creative** — product name/claim/offer in on-image text, audio, caption, alt text. _Hashtag heuristics deleted; two-tower matches literal readable/watchable content._
- **Bookmark-Worthy Save Asset** — spec sheet / sizing guide / "save before it sells out." _Bookmarks ~10-12x a like and correlate with 2+ min dwell (10-11)._
- **Quote-and-Thread Anchor** — 2-3 post thread (hero → proof/UGC → CTA), quote-post the hero. _Reposts/quotes are positives; threads multiply dwell + reply surface; author-diversity allows one anchor._
- **Premium-Verified Launch Handle** — every launch from Premium/Premium+. _~2x-4x boost; ~10x median impressions (Premium+ ~15x); reply-thread priority._
- **Hook-Above-the-Fold Copy** — strongest claim in first ~200 chars / 2 lines, body near 280. _Profile clicks (12.0) + good clicks (11.0) depend on a visible hook._
- **Three-Ratio Static Set** — 1:1, 4:5, 16:9 so the timeline never hard-crops. _Protects the photo-expand positive action and dwell._

### Strategies

- **Conversation-First Organic Launch** — (1) link-free hero static/native clip at peak; (2) PDP link as first reply; (3) 3-post thread; (4) reply to every reply for 30-60 min (triggers the 75 weight); (5) watch 15-min velocity, amplify variants clearing ~10 engagements; cadence 1-2 high-intent posts/day, avoid ~10x/day dilution.
- **Paid Amplification Ladder (DTC)** — top: Promoted Vertical Video (<=15s); mid: Collection carousel (15-25% higher engagement but 10-15% weaker click-to-purchase — watch abandonment); bottom: Dynamic Product Ads retargeting; optional Amplify pre-roll; keep X a minority of paid-social vs Meta.
- **Premium Distribution Base** — consolidate on one Premium+ handle; enforce link-free bodies; tight topical consistency for the embeddings; pursue starter-pack / mutual-follow inclusion.
- **Signal-Weighted Creative QA Gate** — grade each asset: reply CTA present? body URL-free? native 9:16 with captions? hook above fold? keyworded alt text? all three ratios? <=2 hashtags? Hard-reject in-body URL or missing 9:16 export; A/B hook openers on first-15-min velocity.

### Platform QA (X-specific)

Body contains zero outbound URLs (regex: body must NOT match `https?://`; links only in first reply); motion clip 9:16 exactly 1080x1920, MP4/H.264+AAC, 6-10s (hard max 140s non-Premium); burned-in captions; static set includes 1:1 + 4:5 + 16:9, each JPG/PNG <=5MB; every static has non-empty alt text containing product/offer keyword; hook within first 200 chars / 2 lines (free body <=280); >=1 copy variant ends with a reply-eliciting prompt (`?` or explicit CTA); logos/text out of top 10% and bottom 10%; hashtags <=2 per post; ad images >=800px, 1.91:1 or 1:1, <=5MB; link-card 1200x628; video fps <=30, aspect 16:9/1:1/9:16.

### Sources

twitter/the-algorithm-ml Heavy Ranker (primary leak); xai-org/x-algorithm (primary 2026 repo); igorbrigadir awesome-twitter-algo; SocialMediaToday Grok switch; Sprout 2026 factors; scheduling-tool Premium 18.8M-post study; SMT Premium reach; X Premium help (official); business.x.com ad specs + Dynamic Product Ads (official); quickframe video specs; heyorca 2026 organic specs; teract.ai [SECONDARY]; posteverywhere [SECONDARY].

---

## 6. Cross-Platform Synthesis

### Shared principles (encode once; every launch-pack preset inherits)

1. **Watch-time/retention is the master signal everywhere.** TikTok completion (~70% bar), Reels avg watch time (#1), Shorts VVSA/avg % viewed, X dwell (11.0). Every motion asset is storyboarded to a retention curve, not a runtime.
2. **The first ~1.5-3 seconds are the gate.** All video surfaces test on a cold micro-audience and 50-60% drop in the first 3s. Frame-1 hook, product/brand legible by ~3s, no logo/intro card. (Shorts tighter: ~1.5s.)
3. **Loop / rewatch engineering compounds watch-time for free** on TikTok, Reels, and Shorts (replays count). Match final frame to first.
4. **Shares/sends/saves/bookmarks now outrank likes as intent signals.** TikTok shares+saves > likes; Reels sends per reach; X bookmarks ~10-12x a like. Engineer one send/save moment per asset.
5. **Originality is an eligibility gate, not a nicety.** TikTok (15 Sep 2025), IG/Meta (watermark/border/muted demotion + repost de-recommendation) both punish recycled/other-app-watermarked content. Export clean, full-bleed, native, no third-party watermark, sound-on.
6. **Sound-on is required.** TikTok non-silent mandatory, Reels muted=demotion, X muted autoplay needs captions, Shorts captions aid topic + silent viewing. Always ship audio + burned-in captions.
7. **Semantic/keyword readability drives discovery**, and hashtags are declining. TikTok SEO, Shorts triple-match, X Grok-readable creative, YouTube search anchoring. Bake the keyword into spoken audio, on-screen text, caption/description, and (X) alt text.
8. **Cold-audience testing is structural** — TikTok test batch, IG Trial Reels, Shorts explore/exploit, X first-15-min velocity, YouTube Test & Compare + early velocity. Ship multiple variants, protect the launch window, promote measured winners.
9. **Follower count is not a direct ranking factor** on TikTok and Shorts (video+topic wins); every post re-auditions. Cadence + variant volume beats reliance on account authority.
10. **Creative volume/diversity is itself a serving signal** in AI-optimized ad systems (Meta Advantage+, TikTok GMV Max). Feed abundance: full ratio matrix + all copy sets.
11. **Safe zones are mandatory** on every vertical surface — UI overlays occlude text/CTA and kill comprehension/completion.
12. **Engagement-bait and clickbait mismatch are penalized.** Meta demotes explicit bait; YouTube satisfaction signals punish title-content mismatch. CTAs must be authentic.

### Per-platform divergences the presets MUST encode

- **Primary aspect ratio:** 9:16 for TikTok, Reels/Stories, Shorts, X motion; **16:9** for YouTube long-form; 4:5 for IG Feed carousels.
- **Link handling:** X is unique — outbound links **must** leave the post body (first reply only). Other platforms tolerate in-caption links/CTAs.
- **Thumbnail:** decisive for YouTube long-form (1280x720, CTR gate) and off-feed Shorts; **irrelevant in-feed** for TikTok/Reels/Shorts autoplay.
- **Runtime target:** 6-10s launch base for TikTok/Reels/Shorts/X; **>=3:01** (and >=8:00 for mid-roll) for YouTube long-form — never auto-classify a long-form asset as a Short.
- **Audio licensing:** paid TikTok (Spark/GMV Max) and Shorts-over-60s require commercial-library/royalty-free audio; consumer trending sounds allowed organic-only.
- **Hashtags:** TikTok 3-5; Shorts 3-5 with a **60-tag hard kill**; X **<=2** (3+ = spam suppression); IG scrub bait, not count-limited.
- **Copy truncation:** X hook <=200 chars / body <=280 free; Meta primary <=125 (value in first ~40); YouTube title keyword in first 40, description hook in first ~150.
- **Amplification ladder:** TikTok Spark→GMV Max (to purchases); Meta Advantage+ creative feeding; X Promoted Vertical→Collection→Dynamic Product Ads; keep X a minority of paid vs Meta.
- **Signal to over-index per surface:** TikTok completion+shares/saves; Reels watch-time+sends; Shorts VVSA+engaged views; YouTube CTR×AVD+session; X reply-back(75)+dwell, link-free body.
- **Reporting KPIs:** Shorts must report VVSA + engaged-view rate (not total views); YouTube reads traffic-source split; TikTok reads test-batch cascade + GMV via Creative Hub.

Everything tagged **[HYPOTHESIS]** (exact TikTok completion weight and pixel safe-zone margins; IG send multiplier and repost threshold; Shorts freshness boost; YouTube satisfaction weight and early-velocity mechanism; all 2026 X numeric weights, velocity thresholds, and decay half-life) stays a soft/non-blocking flag in QA and export presets, never a hard reject, until confirmed against live platform behavior.

## Consolidated launch-pack QA rules

MACHINE-CHECKABLE QA RULES (by platform; [HYPOTHESIS] items = soft/non-blocking flags).

SHARED (all vertical video): aspect 9:16 & >=1080x1920; has_audio==true (reject muted); no third-party/editor watermark; no letterbox/pillarbox (full-bleed); burned-in captions present; hook element (on-screen text OR scene cut) within first ~3s (Shorts ~1.5s / <=45 frames @30fps); loop continuity (final ~0.5s visually continuous with first, flag hard cut-to-black); safe-zone: no critical text/logo/CTA under platform UI bands.

TIKTOK: 9:16 >=1080x1920, MP4/MOV H.264/H.265 >=30fps; duration 6-10s one loopable idea (flag optional 21-34s / 60-180s renders); brand/product visible <=3.0s; safe zone top 130px / bottom 484px / right 140px [HYPOTHESIS margins]; audio non-silent full duration, paid/Spark/GMV Max audio MUST be Commercial Music Library or cleared original (block consumer trending on paid); caption primary keyword in first 1-3 words, <=2200 chars, 3-5 hashtags with >=1 niche; on-screen text restates keyword in first 3s; shoppable variant product tag/CTA inside safe zone; reject if measured 3s hold <50%.

META (IG/FB): 9:16 >=1080x1920 (prefer 1440x2560), mp4/mov h264/h265 fps>=30 <=4GB; duration 6-15s (target 6-10s); no watermark; safe zone top 14% / bottom 20% (35% for ad CTA) / sides 6%; hook in first 3s, no logo-only open; statics include 4:5(1080x1350) AND 9:16(1080x1920) (reject if only 1:1); caption no engagement-bait regex (tag a friend|like if|share if|double[- ]?tap if|comment .{0,15} (below|to (get|enter|win))|vote (for|below)|follow (for|to)); primary_text <=125 chars value in first ~40; headline <=40; creative_variation_count >=3.

YOUTUBE SHORTS: 9:16(1080x1920) or 1:1; duration <=180s; if >60s audio MUST be royalty-free/Audio Library (hard fail); hook within first 1.5s; scene change every <=4s; title <=100 chars w/ primary keyword; keyword in first 125 chars of description; hashtags 1-5, HARD FAIL if total >60; safe area right 12% + bottom 20% clear; caption/subtitle track present; evergreen Shorts require custom 9:16 thumbnail; KPIs report VVSA + engaged-view rate (not raw views).

YOUTUBE LONG-FORM: thumbnail exactly 1280x720 16:9 sRGB <2MB JPG/PNG, bottom-right ~120x40px clear, on-image text <=4 words/<=30 chars glyph>=45px contrast>=4.5:1; >=2 thumbnail + >=2 title variants (Test & Compare); title <=100 chars keyword in first 40, not duplicating thumbnail text; description >=200 (<=5000) chars with keyword+hook+CTA link in first 150; video 16:9 >=1920x1080 H.264 MP4 AAC-LC 24-60fps; runtime >=3:01 (>=8:00 if mid-roll); value delivered within first 15s, no intro >5s; >=3 chapters (first 00:00, each >=10s); end screen 5-20s with exactly 1 subscribe + 1 next-video/playlist; >=1 named series/playlist; SRT attached.

X (TWITTER): post body MUST NOT match https?:// (links in first reply only); motion clip 9:16 exactly 1080x1920 MP4 H.264+AAC 6-10s (hard max 140s non-Premium); burned-in captions; static set includes 1:1(1080x1080)+4:5(1080x1350)+16:9(1600x900), each JPG/PNG <=5MB; every static non-empty alt text w/ product/offer keyword; copy hook <=200 chars / 2 lines (free body <=280); >=1 copy variant ends with reply prompt ('?' or CTA); logos/text out of top 10% + bottom 10%; hashtags <=2 per post; ad image >=800px 1.91:1 (>=800x418) or 1:1(800x800) <=5MB; link-card 1200x628; video fps <=30 aspect in {16:9,1:1,9:16}.
