# Owner-directed supersession amendment

The owner selected immediate rebaseline and explicitly requested implementation of the September 9
full-platform execution plan. ADR-0008 records the bounded governance procedure. The structured
owner decision records that instruction and the source plan checksum; it authorizes local evidence
commits and supersession, not production effects.

This amendment preserves the exact original WP-P3-009 YAML in
`pre-supersession-work-packet.yaml`, increases the active specification to revision 2, and moves the
uncompleted observation step to pending while the narrowly authorized transition step is current.
Neither observation acceptance nor the owner traffic ruling is passed. WP-P3-010 remains a ready,
unactivated successor revised around the supplied full-platform scope.

Authority-only verification on September 9, 2026:

- Pinned Node 24.18.0 and pnpm 11.12.0; preflight passed before edits.
- `pnpm governance:check` passed: 38 documents, 15 unchanged historical receipts, cleanroom and
  generated references valid.
- `pnpm governance:test` passed: 131 tests, zero failures.
- Prettier passed on the changed authority and decision files and the untouched original snapshot.
- No application, schema migration, provider, financial or production behavior changed.

Next action: implement and verify the ADR-0008 supersession command before activating WP-P3-010.
