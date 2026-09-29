# Route map — ViralGraph cleanroom V2

| Route | File                    | Page                                                                                                     |
| ----- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `/`   | `apps/web/app/page.tsx` | `CleanroomPage` — static placeholder stating that production UI is gated on the approved design artifact |

No other routes, API routes, middleware, or dynamic segments exist in the web application. (The Core Worker exposes `GET /health` at `apps/core`, which is not a UI route.)

Planned P0 surfaces (from `docs/ux/CANVAS_AND_SCREEN_STATES.md`, not yet implemented): campaign brief, canvas, quote/run, output review/comparison, receipt, and responsive review flows.
