# Studio hierarchy and phone booking refinement

Run: codex-finish-20261002. Base: `29f6e8456287f43a5f279fda84bd92f34d7fda71`.

The owner renewed A1–A11 for this same run on October 5, 2026, answering the explicit renewal question with “all alloqwed for you ,jyst finiosh the platfrom”, then instructed “proceed”. A12 remains unadopted. The renewed instructions retain the database, settings, credit floor and independent review boundaries.

The owner's subsequent supplied execution directive says “I am explicitly authorizing you to make the engineering decisions necessary to complete this project. Use your judgment.” It prioritizes finishing customer-facing implementation and says “Fix responsiveness, spacing, typography, hierarchy, navigation, CTA behavior, forms, booking flows, media, loading states, errors, and edge cases.” This refinement follows that newer visual direction: studio headings are 40 px on phones and 56 px on desktop, superseding the earlier shared 28 px heading instruction for these studio routes only. Product headings retain their existing scale. The English booking CTA now explains the offer before the phone handoff. This changes the earlier immediate-dial interaction on normal English activation; its real telephone href remains the progressive fallback and the secondary action. Spanish retains its original telephone interaction and approved strings.

The hero puts the headline, action and exact prices before the media on phones, and beside the native-aspect poster on desktop. It removes the redundant outer media card and height restriction. Offer spacing, the wide Full Package list and the closing booking panel improve hierarchy using existing semantic tokens and regular Geist. Locked prices, offer lists, disclosures, legal wording and media bytes remain unchanged.

Booking uses the shared Radix dialog. The $700 offer and all five inclusions are visible before “Call 713-899-9346.” The dialog explicitly says nothing is booked or charged on this page. No form, collection, reservation, payment or provider request is added. Escape and Close restore focus; Tab stays inside the dialog. Close has a 48 px minimum target. Modified link activation retains its telephone href.

## Verification

- Before implementation, the new component regression failed both English cases and passed the Spanish preservation case. After implementation, the focused four-file suite passed 31 tests.
- Affected package lint, type checking and tests passed: 483 web tests and 66 shared UI tests. The initial combined check caught unsupported testing-library `exact` options; they were removed without weakening name matching, and the complete affected check passed.
- The optimized build passed and proved eight static marketing documents with no prerendered Studio route.
- Booking Playwright exercised home and pricing at 375, 768, 1280 and 1920, plus Spanish. Initially pricing failed the strict 44 px close-height assertion at 43.999984 px. The control was increased to 48 px; the unchanged pricing test then passed all four widths. The prior home and Spanish passes stand.
- Native Playwright MCP inspection covered the three studio routes and English booking dialogs at all four widths. Twenty axe observations found no violations or horizontal overflow. Dialog `aria-hidden-focus` and `color-contrast` incomplete results require manual interpretation, rather than counting as measured passes; keyboard trapping, focus recovery and readable solid-background dialog content were checked directly.
- Forced colors, reduced motion, dark-mode media emulation, 200% CSS zoom and computed-size text enlargement showed no horizontal overflow. Reduced motion kept the video paused or unmounted. Accessibility trees name the offer, Close control and real phone action.
- Built-page mobile lab observations: home LCP 408 ms, IMG, CLS 0; Spanish LCP 56 ms, IMG, CLS 0; pricing LCP 52 ms, P, CLS 0. Scripted booking event durations were 16–32 ms. These are local browser observations without network throttling, not production field percentiles. Focused built-page observations recorded zero console or page errors.
- An early development-only text-enlargement probe changed inline styles before hydration and caused diagnostic mismatches. Those captures are excluded from release proof. The replacement probe adds a stylesheet after the built page loads and retains all content without horizontal overflow.

## Design assessment

Local route scores, before independent review and live release: accessibility 25, responsive 15, theming 7, motion 10, measured lab performance 20, craft 19: **96/100** for each of `/`, `/es` and `/pricing`. Theming loses three points for the existing light-only metadata treatment; craft loses one for the uneven lengths of the two locked offer lists at tablet width. The approved restrained palette and composed rows are intentional brand choices. These scores do not accept unchanged software or signed-in routes.

## Not crossed

No Core, authentication, permission, schema, dependency, Worker configuration or cloud setting change. No customer data or credentials in captures. No signup, production database write, charge, provider enablement or social publication. This record does not mark the whole platform or active packet complete. Production release and its exact deployment proof are pending.

## Next action

Complete the required local release checks, independent review and guarded staging/production release of this studio refinement, then resume the operator access and software-film work.
