# Films credits and terminal quality decisions

Run: codex-finish-20261002. Historical S0 spending: **215.24 credits**, recorded in its approved October 2 report. S0 is the existing public studio plate; no new S0 generation occurred here.

The Higgsfield app used existing Ultra credits. The account balance was 2,665.26 before these jobs and 2,452.76 after every job reached a terminal state and was downloaded. The difference is **212.50 credits**, reconciled to the accepted quotes below. No credit purchase, subscription change or free-trial activation occurred. The 200-credit floor held. These are Higgsfield credits, separate from the development-spend money ledger.

| Film / shot         | Attempt | Exact quote and spent | Balance before → after | Job                                    | QC                                                                                  |
| ------------------- | ------- | --------------------- | ---------------------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| P1 / p1-b1          | 1       | 60                    | 2,665.26 → 2,605.26    | `25010abb-f20f-4edc-861c-0095e002f09e` | Fail: altered file-name letters and reframed cards                                  |
| S1 / arrival still  | 1       | 2.50                  | 2,605.26 → 2,602.76    | `f29f11b8-3a31-4203-a61d-442e4ab9d540` | Still passes visual and palette checks                                              |
| P1 / p1-b1          | 2       | 60                    | 2,602.76 → 2,542.76    | `f82abc6e-ef8e-49d5-95a7-9cdaa51587b2` | Fail: altered file-name letters and invented blue marks                             |
| S1 / arrival motion | 1       | 48                    | 2,542.76 → 2,494.76    | `7c70f913-fa65-41dc-8e76-27336abcbf15` | Fail: first-frame SSIM 0.665863, 43 brightness reversals and top-wall palette drift |
| P2 / p2-b1          | 1       | 8.75                  | 2,494.76 → 2,486.01    | `69b73a9f-38d5-41d7-bddc-e80202158044` | Fail: added red card-top line and softened interface                                |
| P3 / p3-b1          | 1       | 8.75                  | 2,486.01 → 2,477.26    | `41a54294-4825-4580-8e50-7cc8df04e038` | Fail: changed Waiting letters and amber motion on card sides and bottom             |
| S1 / arrival motion | 2       | 7                     | 2,477.26 → 2,470.26    | `3bba8888-7230-4d4b-95b7-e18280d4ffaa` | Fail: required dimensions and isolated duplicate ratio 0.0412 above 0.02            |
| P2 / p2-b1          | 2       | 8.75                  | 2,470.26 → 2,461.51    | `330978e4-1de5-4dea-8a17-6bb624af2adf` | Fail: thick amber outline on multiple edges and oversized blue connector marks      |
| P3 / p3-b1          | 2       | 8.75                  | 2,461.51 → 2,452.76    | `b9b897fb-7da3-482c-9b9a-de83189ec873` | Fail: invented long blue stroke inside Brand B and amber outlines on multiple edges |

P1 spent 120 credits; S1 spent 57.50; P2 and P3 spent 17.50 each. S0 plus this batch totals 427.74 credits. Motion models were Seedance 2.5 for P1 and the first S1 motion, and Kling 3.0 for the remaining interface pilots and retries. The S1 still was Seedream v5 pro. P2 and P3 retries used the verbatim product-beat prompt from section 8 after their initial adapted prompts failed to preserve the required motion.

Each original was downloaded privately beneath `C:/dev/mbv-films/<film>/clips/` or `stills/`. Per-film `log.jsonl` records quotes, jobs, local paths, source hashes and terminal decisions without result URLs. Native frames established the visual failures. S1 machine measurements retain the existing S0 SSIM, stall, brightness-series, cuts, banding and palette thresholds; only duration and frame count reflect its specified four-second shot.

Each first shot failed its one allowed creative retry. Under D4, **P1, S1, P2 and P3 are discarded**. No later shots were submitted; no passing film master, poster, caption or reduced-motion deliverable is claimed. P0 cannot be cut from discarded P1 and was not generated or published. No failed clip replaced public media. The existing S0 public files remain byte-identical.

The account has no unresolved submission or uncollected job from this batch. These terminal decisions satisfy the film stop rule; they do not claim the software-film replacement or full platform is complete.

## Not crossed

No customer files, people presented as a founder or client, real-business generation, social publication, remote database write, new resource or purchase. Generated S1 room imagery was private illustrative footage. Account credentials and media URLs are absent from this record.

## Next action

Continue the active packet's operator-access and remaining application work. Carry the software-film outcome and any unavailable contract through the governed transition without marking them passed.
