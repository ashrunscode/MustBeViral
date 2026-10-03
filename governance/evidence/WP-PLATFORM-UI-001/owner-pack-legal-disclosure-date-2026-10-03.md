# Advertising disclosure date correction input

Run: codex-finish-20261002

Facts only; no legal advice or revised policy. PR #71 merged at 2026-10-03T12:27:19Z, source `f97488dc220c6f1b6686f4c0642b2203baab156e`, replacing the approved S0 paragraph on `/advertising`. `advertisingCopy` in `apps/web/src/components/legal-copy.ts` still displays `Last changed 2026-10-02` and describes the page as of that date. The staging capture in `browser-proof-2026-10-03-s0-release/staging/advertising-375.png` records that unchanged date beside the newly approved paragraph. The film's own October 2 generation date is correct and must remain unchanged.

The adopted A8 directive says no other legal wording changes. The release therefore preserves these date fields; they were not silently corrected. This is a minor factual metadata mismatch, distinct from the existing attorney/legal-review requirement. Privacy and terms were not changed by S0, and their dates are outside this proposed correction.

Exact clearing sentence: “Update only the /advertising last-changed and as-of dates to 2026-10-03 to reflect the S0 disclosure release; keep the film's October 2 generation date and all other legal wording unchanged.”

Once granted, change only those two advertising date fields, add a regression tied to the publication date, and pass the normal review/release gates. No consent, privacy, rights, liability or other legal provision changes. The general legal-review item remains open.
