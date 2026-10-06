# Local timing sample, 2026-10-06

Classification: one fresh process and one warm composite at each predeclared still size.
Synthetic pixels only. This is not real-media acceptance, not a connected runtime, and not the
ADR-0010 decision. One sample is not a p95. No photograph, logo, font, offer, reel, transfer,
cancellation, cost receipt, or fal call was used.

Checkout `416a19aff54e61d2c3470603dd527668357dc6f4`. Node v24.18.0. sharp 0.34.5. libvips 8.17.3.
Windows. sharp was loaded from `@mustbeviral/artifacts`.

## Method

Each process created a flat RGB image, background `16,32,64`, then composited one rectangle,
`240×160` at `left 80, top 60`, color `220,40,40`, and wrote a PNG. The fresh process did that
once. The warm figure is the second composite inside a separate process that had already done one.
Process wall time includes Node startup and loading sharp. `compositeWallMs` is only the create
and composite. Peak RSS is the highest working set polled every 5 ms, and `maxRSS` is
`process.resourceUsage().maxRSS` in kilobytes. The synthetic metadata object is JSON and contains
no image bytes.

## Results

| Sample          |            Process wall | Composite |       Output | sha256                                                             |  Polled peak RSS |     maxRSS |
| --------------- | ----------------------: | --------: | -----------: | ------------------------------------------------------------------ | ---------------: | ---------: |
| 1080×1350 fresh |                712.4 ms |   36.3 ms | 32,575 bytes | `c935aa79752fe69e8d4c38989e75fe0e59e5fbcd4285b5526da912096590f252` | 69,349,376 bytes |  89,376 KB |
| 1080×1350 warm  | 702.6 ms for both calls |   43.9 ms | 32,575 bytes | same hash                                                          | 96,534,528 bytes | 101,172 KB |
| 1080×1080 fresh |                673.1 ms |   35.5 ms | 26,264 bytes | `c527e5b827de6356422551fb480b77df580ac4dcd58f489213dd76c8c43c4abb` | 70,139,904 bytes |  79,620 KB |
| 1080×1080 warm  | 716.9 ms for both calls |   24.3 ms | 26,264 bytes | same hash                                                          | 79,990,784 bytes |  91,024 KB |

The fresh and warm processes for a size produced the same hash. Metadata JSON was 184 bytes.

The output files are small because the pixels are flat. These byte sizes are not a photograph.

## Against the predeclared caps

The September 29 protocol asks for warm p95 at most 5 seconds, cold p95 at most 10 seconds, a job
at most 60 seconds, peak RSS at most 512 MiB, and metadata at most 32 KiB. These four samples sit
under those caps. They do not satisfy the protocol: there are not 10 fresh and 10 warm samples per
size, there is no hosted cold start, and there is no transfer.
