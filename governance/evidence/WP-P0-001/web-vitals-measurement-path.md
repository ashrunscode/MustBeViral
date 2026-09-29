# Web Vitals production-segment measurement path

Work packet: WP-P0-001 / p0-007-p0-gate-evaluation  
Recorded: 2026-08-30

No secrets or environment values are recorded here.

## Instrumentation shipped in P0

- `apps/web/src/lib/telemetry/web-vitals.ts` defines LCP, INP, and CLS rating thresholds aligned with Core Web Vitals (p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1).
- `apps/web/src/components/web-vitals-reporter.tsx` registers `web-vitals` listeners in the Next.js root layout.
- Development and preview builds log sanitized JSON to the browser console. Production reporters remain pluggable via `setWebVitalReporter()` for an authorized analytics sink.

## Production-segment measurement (P1a gate)

Production p75 numbers are **not** claimed in P0. After an authorized P1a production deploy with exact Vercel project and deployment IDs:

1. Attach the production-segment reporter (Vercel Speed Insights or equivalent) through `setWebVitalReporter` without exposing customer media or signed URLs.
2. Measure only the agreed authenticated Studio segment (`/studio/*` workflow routes).
3. Do not promote V2 or cut legacy traffic to measure Vitals.

Until that deploy, instrumentation is shipped and fail-closed evidence records `pending` for production-segment thresholds.
