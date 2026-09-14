# Connected journey repairs

Prepared 2026-09-14 for current step `w1b-004-journeys-and-successor`. Connected desktop/mobile now passes eight cases. See `journeys-coverage-gap-2026-09-14.md` for proof and remaining acceptance gaps.

## Product repairs

- Read failures no longer claim edits were not saved. Mutation surfaces retain explicit uncertain-save copy. `FORBIDDEN` and concealed `NOT_FOUND` recovery use distinct truthful messages.
- Invitation/revocation confirmation survives parent access refresh. Notice state belongs to the selected studio and is discarded when that studio changes. Refresh still hides controls while loading or denied; stale authorization is not retained for a notice.
- Successful billing content has its shell's skip-link target. This is not complete keyboard/accessibility evidence for loading and error states.
- Billing tests cover integer balances, missing profiles, mismatch and inactive subscriptions.

## Harness repairs and safeguards

- Sign-in waits for the actual `/studio` pathname and loaded heading; `/studio` inside the login query no longer counts as completed login.
- Status assertions select the relevant live region. Invitations additionally verify the persisted recipient and pending role, accepted recipient and revoked access.
- Fixtures use the existing exact local database identity check with private captured output. The TypeScript helper works with the Windows Playwright loader. Credentials, tokens and raw Supabase status are not written into evidence.
- SQL assertions scope wallet and audit checks to the fixture workspace and compare brand/studio counts with the pre-test baseline. They still test the original invariants with unrelated rows retained. All 659 assertions passed afterward.
- Interrupted unsaved leave is distinguished from interrupted in-flight save. Browser fixture proof does not replace missing acceptance.

## Verification attempts

Initial full verification found database tests assuming an empty database. Scoped repairs passed with retained fixtures. Later runs found formatting in local generated shared-memory instruction adapters and stale generated Worker bindings after the disabled queue flag was added to the example. These failures were investigated, not waived.

The three instruction adapters (`AGENTS.md`, `GEMINI.md`, `.agents/rules/shared-memory.md`) are workstation-generated and outside this product change. During verification only, their whitespace was formatted, then exact original bytes restored. No tracked instruction amendment or check bypass is part of this change. Final outcomes and independent-review disposition are recorded with handoff evidence.
