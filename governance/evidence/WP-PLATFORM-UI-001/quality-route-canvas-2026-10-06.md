# Route inspection and local canvas proof

Run: codex-finish-20261002.

The released web source is `cf64d3bd2616a2b18df01ee7727503aeaf17b4b3`. Production deployment `dpl_FEoD9y2NR1Wu9j5vBd6n9sqttgF3` serves it. The documentation merge `2dceffe7b4a01f6986511d563ba72c16bacf37b8` does not change that application, and this record must not deploy.

## Signed-out production routes

Checked on 2026-10-06 against the live apex. These routes returned 200 with no `Set-Cookie`: `/`, `/es`, `/pricing`, `/software`, `/software/pricing`, `/privacy`, `/terms`, `/advertising`, `/login`, `/signup`, `/forgot-password`, `/verify-email`, `/maintenance`, `/unauthorized`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, and `/api/core/health`. Health status was `ok`. `/reset-password` returned 307 to a Location beginning `/forgot-password?notice=expired_link`. `/studio` returned 307 to `/login?next=`. An unknown path returned 404. `https://www.mustbeviral.com/` returned 308 to `https://mustbeviral.com/`. The homepage response included the locked prices, the phone number, an apex canonical, CSP with `frame-ancestors`, and no `X-Powered-By`. The software page included a poster. The response carried `data-dpl-id="dpl_FEoD9y2NR1Wu9j5vBd6n9sqttgF3"`. No form was submitted.

## Local 500-node canvas

Optimized local web on `127.0.0.1:3116` and local Core on `127.0.0.1:8789`, providers and queues off, preview bypass false. The synthetic workspace `d2416bd2-8b60-4797-9f2c-39af5f9bf133` already held the project and canvas. The corrected patch key `c11-native-canvas-patch-v2-37be948` produced revision `0fd049f8-39b3-4caf-ac5e-5bf631206e5e`. The stored graph has 500 nodes and 499 edges. The signed-in page, opened with its studio and brand in the link, showed `30 / 500 nodes mounted`.

Native headless Chromium panned the persisted graph for at least five seconds at four widths. Collaboration sockets were not force-closed. Presence rendered unavailable. This is local frame cadence during DOM panning, not a physical device and not customer acceptance.

| Width | Frames per second | Elapsed ms | Transform mutations | Overflow |
| ----- | ----------------- | ---------- | ------------------- | -------- |
| 375   | 60.00             | 5550       | 331                 | no       |
| 768   | 59.64             | 5550       | 328                 | no       |
| 1280  | 60.00             | 5550       | 330                 | no       |
| 1920  | 60.00             | 5533       | 329                 | no       |

## Still unproven

Primary-flows stay pending. Release-smoke stays pending: the public route check above is not the signed-in founder journey. The full quality pass, fresh-clone gates, production lab vitals, dependency review, and the 72-hour observation are not claimed. No acceptance row was marked passed.

## Next action

Supersede WP-PLATFORM-UI-001 into WP-PLATFORM-RENDER-001 under A2, carrying primary-flows, release-smoke, and the unfinished quality pass without marking them passed.
