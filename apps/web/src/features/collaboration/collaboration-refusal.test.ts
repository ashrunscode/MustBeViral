import { describe, expect, it } from 'vitest';

import { describeCollaborationRefusal, describeTextDraftRefusal } from './collaboration-refusal';

describe('collaboration refusal wording', () => {
  it('names the limit that refused the change and what the member can do', () => {
    expect(
      describeCollaborationRefusal({
        code: 'CANVAS_LIMIT_REACHED',
        message: 'limit',
        details: { resource: 'text_drafts', scope: 'actor', unit: 'bytes', limit: 100_352 },
      }),
    ).toContain('Checkpoint your drafts');
    expect(
      describeCollaborationRefusal({
        code: 'CANVAS_LIMIT_REACHED',
        message: 'limit',
        details: { resource: 'comments', scope: 'canvas', unit: 'rows', limit: 200 },
      }),
    ).toBe('Comment not posted: this canvas has reached its comment limit.');
    expect(
      describeCollaborationRefusal({
        code: 'FIELD_TOO_LARGE',
        message: 'too large',
        details: { field: 'payload.body', limit: 4_000, unit: 'characters' },
      }),
    ).toBe('Not synced: the text is longer than 4,000 characters.');
    expect(describeCollaborationRefusal({ code: 'FORBIDDEN', message: 'no' })).toContain(
      'your own comments',
    );
    expect(describeTextDraftRefusal('lease_held')).toContain('holds the lease');
    expect(describeTextDraftRefusal('stale')).toBeNull();
  });
});
