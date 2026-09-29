---
doc_id: gtm-consent-and-suppression
---

# Consent and suppression

**Marketing contact is BLOCKED.** No marketing email, no outbound sequence and no marketing SMS may be sent for this brand until the consent record and the suppression list described here exist, are populated and are enforced by a pre-send check. This is a requirement, not a description of something that exists. Nothing in this document claims any part of it is built.

Only transactional mail within its exact scope is eligible today, through the fail-closed adapter in `packages/email/src/index.ts` (`brand/context.md` sections 8 and 9).

## 1. Why this is blocked

- No consent record exists anywhere in the repository. Consent is per contact point, per channel and per purpose. A row in a purchased list, a CRM flag, an import, a business card or a past conversation is not consent.
- No suppression list exists. Unsubscribe, complaint, hard bounce, do-not-contact and invalid contact point all override any grant, and there is nowhere to record them.
- No unsubscribe mechanism exists. A marketing send needs a working `List-Unsubscribe` header, a one-click link and a footer postal address before the first send (`brand/context.md` section 8).
- No street postal address is on file. `[OWNER-INPUT-NEEDED]` — What street address, suite or mailbox may appear in the email footer and on legal pages? Houston, Texas alone is not a valid postal address (owner decision 2026-09-15).

## 2. Data model

### 2.1 Consent record

One row per contact point, channel and purpose. Append-only: a change of state writes a new row and stamps the previous one revoked. Rows are never edited in place and never deleted.

- `id` — surrogate key.
- `contact_point` — the normalised email address or phone number the grant applies to. Normalisation is lowercase and trimmed for email, and E.164 for phone.
- `channel` — `email` or `sms`. One row per channel; a grant is never bundled across channels.
- `purpose` — `marketing` or `transactional`. A transactional grant never authorises marketing.
- `basis` — `verified-purpose-grant`, `transactional-exact-scope` or `blocked-legacy-unknown`. Unknown fails closed.
- `source` — where the grant was captured: `site-form`, `reply-opt-in`, `event`, `manual`. Never `import` and never `purchased-list`.
- `wording_shown` — the exact text the person saw when they granted it, stored verbatim, not summarised, not a label, not a template id. The Spanish surface stores the Spanish wording actually displayed.
- `captured_at` — timestamp with time zone, UTC.
- `ip_address`, `user_agent` — recorded where the grant came from a web surface; null for a grant captured any other way, with the method named in `source`.
- `proof_url` — pointer to the stored proof, such as the form submission record.
- `recorded_by` — the human or system that wrote the row.
- `revoked_at` — timestamp, null while live. A revocation also writes a suppression entry.

### 2.2 Suppression entry

One row per suppressed contact point and channel. Permanent by default.

- `id` — surrogate key.
- `contact_point` — normalised the same way as the consent record, so a lookup on either table matches.
- `channel` — `email` or `sms`, or `all` for a do-not-contact request covering everything.
- `reason` — `unsubscribe`, `complaint`, `hard-bounce`, `do-not-contact` or `invalid`.
- `suppressed_at` — timestamp with time zone, UTC.
- `permanent` — boolean, default true. Only `invalid` may be non-permanent, and only when the owner records why.
- `source` — the webhook, form, reply or person that caused it.
- `notes` — free text, no customer content pasted in.

Suppression is never deleted. Removing a row would re-enable contact, so the table is append-only and any correction is a new row, not a delete.

## 3. Where it lives

- **Supabase Postgres is authoritative** for both tables. It already owns identity-linked relational truth and audit events (`docs/architecture/SYSTEM_OVERVIEW.md`), and the migration and row-level-security conventions already in `supabase/` apply here without exception.
- **HubSpot holds a mirror, never the authority.** The contact properties `mbv_consent_basis`, `mbv_consent_recorded_at`, `mbv_consent_proof_url`, `mbv_suppressed` and `mbv_suppression_reason` in `docs/gtm/hubspot-mapping.md` are written from Supabase after the fact. A HubSpot edit never creates consent, never upgrades a basis and never clears a suppression flag.
- The mirror is one-way. If the two disagree, Supabase wins and the mirror is corrected.
- No secrets, no media, no signed URLs and no Supabase rows beyond the mirrored fields cross into HubSpot.

## 4. Pre-send check

Runs immediately before every individual send, including every follow-up inside a sequence, not once per campaign. It fails closed.

1. Normalise the contact point exactly as the tables store it.
2. Look up the suppression list for that contact point on that channel and on `all`. Any hit stops the send permanently. This check runs first, before consent is even read.
3. Look up a live consent record for that exact contact point, channel and purpose. No row, a revoked row, or a `blocked-legacy-unknown` basis stops the send.
4. Confirm the send's purpose matches the record's purpose. A transactional grant never carries a marketing send.
5. If the consent store is unreachable, stop. An unreachable store is a block, never a pass.
6. Log the outcome: the consent record id, the suppression result, the channel, the purpose, the timestamp and the message identity. The log is the evidence that the check ran.

No agent bypasses this check, and no agent sends. A human sends, after the check has passed (`docs/gtm/outbound-target-lists.md`, section 5).

## 5. Retention

- Consent records are kept for as long as the relationship lasts and for a defined period after the last contact, because the record is the proof that a send was lawful. `[OWNER-INPUT-NEEDED]` — What retention period after last contact applies to consent records?
- Suppression entries are kept permanently. They are the only thing standing between a past unsubscribe and a future send, so they outlive the contact record, the deal and the CRM.
- A rights request that asks for erasure still leaves the suppression entry in place, reduced to the minimum needed to keep honouring the request. `[OWNER-INPUT-NEEDED]` — Confirm this handling with the legal review described in `docs/gtm/legal-input-pack.md`.
- Proofs referenced by `proof_url` follow the same retention as the record that points at them.

## 6. Acceptance tests

The blocker lifts when all of these pass against the real implementation.

1. A send to a contact point with no consent record is refused.
2. A send to a suppressed contact point is refused even when a live consent grant exists.
3. The suppression lookup runs before the consent lookup, and its result cannot be overridden by any import, CRM edit or manual flag.
4. An unsubscribe writes a suppression entry within the same request and is idempotent when clicked twice.
5. A complaint webhook and a hard-bounce webhook each write a suppression entry.
6. The consent record stores the exact wording shown, and a test that changes the form wording produces a different stored string.
7. Contact-point normalisation collapses case and whitespace for email and E.164 for phone, so an address stored one way is still matched when submitted another way.
8. A HubSpot property change does not create, upgrade or revive consent in Supabase.
9. Deleting a HubSpot contact does not delete the Supabase suppression entry.
10. The pre-send check fails closed when the consent store is unreachable.
11. Every send writes a log line carrying the consent record id and the suppression result; a send with no such line is a test failure.
12. A Spanish-language send stores the Spanish wording that was actually displayed, not an English original.
13. A marketing send with only a transactional grant is refused.
14. A send without a footer postal address and a working one-click unsubscribe is refused.

## 7. Capture surface defect

The shipped "Request access" call to action links to a page that collects nothing: the page states that enrollment is closed and no request is recorded there (`apps/web/app/signup/page.tsx`; `brand/context.md` section 7). The call to action therefore promises a request will be received when none is.

Fix, either one, owner's choice:

- Replace the destination with a real form that writes a consent record as specified above and returns honest confirmation copy; or
- Remove the call to action until that form exists.

Do not build the form as part of this change. Recorded here as a defect so it is fixed deliberately, and because the form is the first surface that would write a consent record.

## 8. Open items

- 2026-09-15 Marketing contact is blocked until this data model, the pre-send check and the acceptance tests exist — open
- 2026-09-15 Street postal address for the footer and legal pages — open
- 2026-09-15 Retention period for consent records after last contact — open
- 2026-09-15 The "Request access" call to action points at a page that collects nothing — open
