# 13_SCHEDULER_DM_AUDIT.md

## Scheduler Verdict

The intended approach is correct: a `SchedulerProvider` interface with three implementations — **`ManualExportAdapter` (always available)**, `VistaSocialAdapter` (Phase 1 if API supports posting), `BufferAdapter` (Phase 1 if API supports posting). No code exists.

**Risk:** the `SchedulerProvider` interface is mentioned in `PROMPT_ROADMAP.md` (prompt 53) but never defined in any spec doc. Implementers will invent ad hoc shapes and lock in technical debt.

## Provider Adapter Status

| Adapter | Status | Real-world capability |
|---|---|---|
| ManualExportAdapter | spec only | Trivial — write rows to `scheduled_posts` with `provider='manual'`, expose CSV/JSON download in UI. |
| VistaSocialAdapter | spec only | Vista Social *does* expose a Publishing API for scheduled posts (reasonable for the MVP scheduling path). DM-rules API is unverified — assume **NOT supported** until proven. |
| BufferAdapter | spec only | Buffer's API supports scheduling posts to most platforms (Threads/Bluesky support varies). Buffer does not provide DM automation — DMs are entirely out of scope here. |
| Direct Meta/X/TikTok APIs | Phase 2+ per `PRODUCT_DNA.md` | Each platform has app-review hurdles; not suitable for early MVP. |

## Required `SchedulerProvider` Interface

This is the contract the spec leaves out. Lock it in early:

```ts
// src/server/services/scheduler/types.ts
export interface SchedulerSchedulePostInput {
  brandId: string;
  postId: string;
  platform: "instagram"|"facebook"|"x"|"linkedin"|"tiktok"|"threads"|"youtube"|"google_business";
  caption: string;
  hashtags: string[];
  mediaUrls: string[];          // Cloudflare Images / R2-signed URLs
  scheduledAt: string;          // ISO 8601
  metadata?: Record<string, unknown>;
}

export interface SchedulerScheduleResult {
  externalId?: string;
  status: "scheduled"|"manual_export"|"failed";
  failureReason?: string;
}

export interface SchedulerProvider {
  readonly id: "manual"|"vista_social"|"buffer";
  readonly capabilities: {
    posting: boolean;
    stories: boolean;
    reels: boolean;
    dms: boolean;
    analyticsIngest: boolean;
  };
  schedulePost(input: SchedulerSchedulePostInput): Promise<SchedulerScheduleResult>;
  cancelScheduledPost(externalId: string): Promise<void>;
  getScheduledPostStatus(externalId: string): Promise<SchedulerScheduleResult>;
}
```

The `ApprovalSchedulingWorkflow` uses the active provider and falls back to `ManualExportAdapter` on hard failure.

## Manual Export Status

`ManualExportAdapter` MUST work end-to-end on day 1:

- Write `scheduled_posts` row with `provider='manual'`, `status='manual_export'`, `external_id=null`.
- UI: `Approvals → Schedule` action triggers ApprovalSchedulingWorkflow → adapter writes the row.
- UI: `/app/brands/:brandId/scheduled` shows the queue and offers `Download CSV` / `Copy to clipboard` per platform.
- No external dependency; always succeeds.

## Publishing Safety

| Concern | Fix |
|---|---|
| Re-publishing on retry | `external_id` uniqueness must be enforced (`UNIQUE(scheduler_provider, external_id)` if external_id is non-null) |
| Posting before approval | `ApprovalSchedulingWorkflow` re-reads `content_posts.status === 'approved'` per post; skips with audit log if not |
| Wrong account | Adapter must look up the `brand_social_profiles` for the platform; fail closed if no connected account in non-manual providers |
| Platform compliance | Adapter must reject content over per-platform char limits; surface as workflow failure |
| Time zone confusion | Always store and pass UTC ISO-8601; UI converts to local on display |
| Doubled retries | Retry budget enforced inside Workflow; `scheduled_posts.retry_count` exposed in admin |
| Scheduler outage | Fall back to `ManualExportAdapter` and notify user via banner + audit_log |

## DM Automation Safety

`AGENT_SPEC.md` says "no browser-bot DMs"; `ARCHITECTURE.md` says "send to Vista Social adapter where available".

**Reality check:** I cannot verify Vista Social exposes a DM-rules / first-comment API as the spec assumes. Recommend:

| Decision | Recommendation |
|---|---|
| Build DM rule CRUD in DB / UI | Yes (table + UI for drafting/editing) |
| Activate DM rule on a provider | **Block until provider capability is confirmed end-to-end with a real account.** Until then, all DM rules sit in `status='draft'` or `status='manual'` |
| Auto-reply via Cloudflare worker bot impersonating user | **Forbidden.** Spec is explicit. Do not implement. |
| First-comment / pinned-comment automation | Treat same as DMs — provider-capable only |
| Sensitive intent rules (price, custom quote, complaint) | Always require human approval; never auto-reply, even if provider supports it |

## Missing Retry Logic

| Workflow path | Retry story |
|---|---|
| `ApprovalSchedulingWorkflow.schedulePost` step | Retry with exponential backoff (3 attempts: 5s, 30s, 5m); on final failure, fall back to manual export |
| `getScheduledPostStatus` polling for stuck posts | Cron-driven cleanup workflow checks `scheduled_posts WHERE status='scheduled' AND scheduled_at < now() - 1h` and pulls status |
| Provider-token refresh | If using OAuth tokens, refresh before each call; on `401 invalid_token`, mark `brand_social_profiles.connected_status='disconnected'` and surface a banner |
| Webhook ingestion (provider → us) | Idempotent via external event id; replay safe |

## Required Implementation Plan

1. Create `src/server/services/scheduler/types.ts` with the interface above.
2. Implement `ManualExportAdapter` first; ship `/app/brands/:brandId/scheduled` UI.
3. Implement `ApprovalSchedulingWorkflow` calling the active adapter, writing to `scheduled_posts`.
4. Implement `VistaSocialAdapter` (posting only) with environment flag `VISTA_SOCIAL_ENABLED`. Default off.
5. Implement `BufferAdapter` (posting only) with environment flag.
6. Build provider connect UI under brand settings (OAuth handshakes per provider).
7. Implement provider status reconciliation cron.
8. **Defer** DM automation provider sending. CRUD only in MVP. Re-evaluate when at least one provider's DM API is verified end-to-end on a real account.

## Provider Connect Flow (placeholder)

For each provider, `brand_social_profiles.connected_status` transitions: `not_connected` → `connecting` → `connected` (or `failed`). Tokens stored encrypted (use `wrangler secret` per workspace? — heavy; alternative: use a single workspace-level KMS key and encrypt per-row). Token storage design is a Phase 1.5 detail; the MVP can ship without provider posting and rely on `ManualExportAdapter`.
