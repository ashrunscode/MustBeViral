## Active packet

- Packet ID:
- Current step:
- Authority document IDs:
- Why this change belongs in the packet:

## Outcome

Describe the user-visible or system outcome. List any public API, schema, state-machine, environment, billing, security, or deployment contract changes; write `None` when there are none.

## Boundaries

- [ ] The diff stays within the packet's allowed paths.
- [ ] Unrelated worktree changes were preserved.
- [ ] No accepted decision or packet scope was broadened during implementation.
- [ ] No secret, customer media, token, signed URL, or raw environment value appears in the diff or evidence.

## Evidence

- [ ] `pnpm agent:verify`
- [ ] Every automated acceptance criterion named by the packet
- [ ] Every required manual check, with safe evidence linked below
- [ ] Generated contracts and documentation are current
- [ ] Rollback was verified or the packet explicitly declares it unnecessary

Evidence links or paths:

## External effects and handoff

- External mutations performed: `None`, or list the exact approved resources and rollback evidence.
- Remaining blocker: `None`, or state one concrete blocker.
- Exactly one next action:
