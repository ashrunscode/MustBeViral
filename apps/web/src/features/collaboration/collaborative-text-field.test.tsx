import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { createPreviewCollaborationSnapshot } from '@mustbeviral/collaboration';

import { CollaborativeTextField, resolveLeaseState } from './collaborative-text-field';

describe('collaborative text field', () => {
  const snapshot = createPreviewCollaborationSnapshot('preview-canvas', 'canvas');

  it('renders lease held, contested, and released accessibility states', () => {
    expect(
      resolveLeaseState({
        snapshot,
        nodeId: '7',
        actorId: 'maya-chen',
        requiresLease: true,
      }),
    ).toBe('held');
    expect(
      resolveLeaseState({
        snapshot,
        nodeId: '7',
        actorId: 'local-preview',
        requiresLease: true,
      }),
    ).toBe('contested');
    const html = renderToStaticMarkup(
      <CollaborativeTextField
        actorId="local-preview"
        fieldLabel="Generation prompt"
        fieldPath="parameters.prompt"
        localValue=""
        nodeId="7"
        nodeKind="image_generation"
        placeholder="Draft prompt"
        snapshot={snapshot}
        onAcquireLease={() => undefined}
        onChange={() => undefined}
        onReleaseLease={() => undefined}
        onSyncDraft={() => undefined}
      />,
    );
    expect(html).toContain('Edit lease contested');
    expect(html).toContain('role="status"');
    expect(html).toContain('Retry lease');
  });
});
