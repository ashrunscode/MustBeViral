# Production-segment Web Vitals sequencing — 2026-08-26

Work packet: WP-P0-001, current step `p0-007-p0-gate-evaluation`

No credential, signed URL, customer media, or raw environment value is recorded. No GB-02 spend.

## Decision

The canvas-and-web-performance gate has two parts. Lab/browser FPS on the 100-node and 500-node
fixtures is already proven. Production-segment p75 LCP ≤ 2.5s, INP ≤ 200ms, and CLS ≤ 0.1 **cannot
be marked passed during P0**.

ViralGraph V2 production is not provisioned. Staging and local Playwright are not the agreed
production measurement segment. Passing those numbers from staging would promote V2 or pretend
legacy V1 traffic is V2.

Sequence:

1. Keep the lab FPS evidence as the canvas half of the gate (already recorded).
2. Keep the Core Web Vitals half **pending** through P0 exit documentation.
3. Measure p75 LCP/INP/CLS on the isolated P1a production web origin after that packet provisions
   it, before owner-first customer admission.
4. Do not cut over legacy V1 traffic to gather Vitals.

This file records the sequencing decision. It does not pass the combined gate.
