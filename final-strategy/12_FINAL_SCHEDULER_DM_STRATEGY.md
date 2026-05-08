# Final Scheduler DM Strategy

## Scheduler

Define one `SchedulerProvider` interface and implement:

- `ManualExportAdapter`: Phase 1 default and always available.
- `VistaSocialAdapter`: typed skeleton, disabled until verified.
- `BufferAdapter`: typed skeleton, disabled until verified.

`ApprovalSchedulingWorkflow` always rechecks post approval status before scheduling and falls back to manual export on external failure.

## DM Automation

Phase 1 supports safe DM/comment rule management only:

- draft keyword rules
- FAQ reply templates
- human handoff rules
- approval required by default
- compliance review before activation

Forbidden:
- browser-bot DMs
- bypassing platform rules
- activating unsupported provider automation
