# Saved drafts and invitation implementation contract

Implementation evidence under the existing W1 authorities; no external effects are authorized.

- `/studio` becomes the signed-in portfolio entry. Existing workspace/campaign URLs remain
  supported. Brand URLs carry both the workspace and immutable brand ID. Studio selection and
  portfolio search resolve permitted durable grants; browser storage cannot supply ownership.
- A brand onboarding draft is a workspace/brand record. Starting a draft creates the required
  workspace, brand and explicit selected-studio grant transactionally, or uses an explicitly
  permitted existing workspace. The selected studio is a real membership, not a name match.
  Repeated creation uses the existing durable idempotency store.
- Draft fields contain a supplied website or manually entered description, audience, goals and
  current form step. They are unapproved operator input, not extracted facts or a completed brand
  analysis. Expected versions reject concurrent overwrites. Saved status appears only after the
  database acknowledges the save; interrupted saves retain a recoverable error and navigation guard.
- Brand identity changes use the existing versioned identity operations. Draft edits never create
  approved knowledge or mutate historical campaign revisions. Location editing retains the exact
  brand/workspace parent and time zone; opening hours and coverage are not invented.
- Studio team invitations store an exact normalized recipient email, owner membership, role,
  expiry and state. Only the matching verified Supabase user can accept. Creation alone grants no
  membership. Acceptance, revocation and owner/membership changes serialize on the studio and are
  idempotent and audited. Roles are owner-managed editor/viewer team presets and remain bounded by
  explicit workspace grants. Sending email, external outreach and client publication are excluded.
- Legacy project resolution uses only explicit project-to-brand mappings. It must distinguish
  a missing mapping from a hidden resource and must not infer a brand from a workspace name.
- Billing is read from the existing workspace ledger and billing profile with original-JWT
  authorization. Unknown/unavailable data is not zero. No Stripe mutation, charging, paid execution
  or new ledger authority is introduced.
- Additive schema and old-application compatibility are retained. Local tests use explicitly
  synthetic WashBodega/UnPile records. Production observation, traffic, publication and spending
  obligations remain unchanged.
