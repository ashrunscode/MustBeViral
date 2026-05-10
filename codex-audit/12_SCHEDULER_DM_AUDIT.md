# 12 — Scheduler / DM Audit

## SchedulerProvider interface (`src/server/services/scheduler/index.ts`)

```ts
export type SchedulerProviderId = "manual" | "vista_social" | "buffer";

export interface SchedulerProvider {
  id: SchedulerProviderId;
  schedule(post: SchedulerPost): Promise<SchedulerResult>;
}
```

✅ Clean interface. ✅ Matches `final-strategy/12_FINAL_SCHEDULER_DM_STRATEGY.md`.

## Adapters

| Adapter | Status | Behaviour |
|---|---|---|
| `ManualExportAdapter` | ✅ Real | Returns `{ provider: "manual", status: "manual_export", exportPayload: { postId, brandId, platform, caption, scheduledAt } }` |
| `VistaSocialAdapter` | ⚠️ Stub | `{ provider: "vista_social", status: "failed", message: "Vista Social adapter is a typed skeleton until provider credentials are configured." }` |
| `BufferAdapter` | ⚠️ Stub | `{ provider: "buffer", status: "failed", message: "Buffer adapter is a typed skeleton until provider credentials are configured." }` |

`getSchedulerProvider(id)` selects between the three. ✅ The factory correctly returns ManualExportAdapter as default.

## Scheduler flow (`routes/brands.ts:337-401`)

```ts
brandRoutes.post("/:brandId/scheduler/manual-export", async (c) => {
  ...
  for (const postId of parsed.data.postIds) {
    const post = await getPost(db, brand.id, postId);
    if (!post || post.status !== "approved") {
      return c.json(errorEnvelope("POST_NOT_APPROVED", ...), 409);
    }
    const result = await provider.schedule({...});
    await dbRun(db, `INSERT INTO scheduled_posts (..., scheduler_provider, ..., status, ...) ...`,
                [..., result.provider, ..., result.status, ...]);
    await dbRun(db, `UPDATE content_posts SET status = 'scheduled' WHERE id = ?`, [post.id]);
  }
  ...
});
```

Properties:
* ✅ Approval-before-export guard enforced (line 352-358).
* ✅ Wraps individual post writes with audit log (single rollup at end, line 392-399).
* ✅ Updates `content_posts.status` to `'scheduled'` after export.
* ✅ Stores result payload in `scheduled_posts.metadata_json`.
* ⚠️ No transaction. If the Vista/Buffer adapter fails partway through a multi-post export, earlier posts are scheduled while later ones aren't.
* ⚠️ Manual export does not produce a downloadable file; the payload is stored only in `metadata_json`. Users cannot retrieve the export later via API.

Tests: `tests/unit/scheduler-model.test.ts` covers manual export happy path and external adapter fail-closed. ✅ Adequate for primitives.

## Manual-export reality

The `ManualExportAdapter.schedule()` doesn't actually produce a file or message. It just returns a JSON object that the route stores in `scheduled_posts.metadata_json`. To get the export, a user would have to:

1. Hit the route → receive `{exported: [{postId, scheduledId, result}]}` in response.
2. Or query `scheduled_posts` directly, then parse `metadata_json`.

There is **no `GET /:brandId/scheduler/exports` endpoint**, no CSV download, no email. For a "manual export" feature, this is thin.

## DM rules (`routes/brands.ts:403-452`)

```ts
brandRoutes.post("/:brandId/dm-rules", async (c) => {
  ...
  await dbRun(db,
    `INSERT INTO dm_rules (
       id, brand_id, platform, trigger_type, trigger_value, response_template,
       requires_approval, status, metadata_json
     ) VALUES (?, ?, ?, ?, ?, ?, 1, 'pending_approval', ?)`,
    [ruleId, brand.id, platform, triggerType, triggerValue, responseTemplate,
     toJson({ browserBot: false, providerRequired: true })]);
  ...
});
```

Properties:
* ✅ `requires_approval = 1` hardcoded.
* ✅ `status = 'pending_approval'` hardcoded.
* ✅ `metadata_json.browserBot: false` and `providerRequired: true` make the safety stance explicit.
* ✅ DB schema enforces `CHECK (requires_approval IN (0, 1))` at column level.

## DM execution

There is no code path that:
* Reads `dm_rules.status='approved'`.
* Listens for incoming social platform DM events.
* Drafts responses.
* Sends responses via any provider.

`dm_events` table is empty. **No automation, no browser bot, no platform integration, no risk.** This is the safest possible state for Phase 1, exactly matching the `llms.txt` non-negotiable: *"No browser-bot DMs or bypass platform rules."*

## Required fixes

| ID | Severity | Fix |
|---|---|---|
| SCH-1 | Medium | Wrap multi-post manual-export in a single transaction or per-post try/continue with a rollup status |
| SCH-2 | Medium | Add `GET /:brandId/scheduler/exports?status=&since=` endpoint to retrieve past exports as CSV/JSON |
| SCH-3 | Medium | Document the export payload format (per platform: caption, hashtags, scheduled time, image link) |
| SCH-4 | Low | Add audit log entry on each `scheduled_posts` insert (currently rollup only) |
| SCH-5 | Low | Add tests for approval-before-export guard (`POST_NOT_APPROVED` case) |
| SCH-6 | Low | Add tests for multi-post manual export (mixed approved/unapproved) |
| DM-1 | Medium | Add approval workflow for DM rules: `PATCH /:brandId/dm-rules/:ruleId` with `action: 'approve' | 'reject'` and audit log |
| DM-2 | Low | Document Phase 2 DM execution plan (Meta Graph webhook ingestion, etc.) — currently underspec'd |
| DM-3 | Low | Add tests for DM rule creation defaults (requires_approval=1, status='pending_approval') |

## Verdict

| Dimension | Status |
|---|---|
| SchedulerProvider interface | ✅ Real |
| Manual export | ✅ Real (but thin) |
| Vista Social / Buffer | ⚠️ Stubs (acceptable for Phase 1) |
| Approval-before-export | ✅ Enforced |
| DM rules | ✅ Real and safe-by-default |
| DM execution | ❌ Not implemented (intentional for Phase 1) |
| Browser-bot risk | ✅ None |

This is the cleanest subsystem in the codebase. The scheduler/DM design hits the spec's safety bar with minimal compromise. Improvements are mostly polish (transaction wrapping, export retrieval endpoint, more tests).
