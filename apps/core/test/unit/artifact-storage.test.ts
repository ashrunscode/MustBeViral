import { describe, expect, it, vi } from 'vitest';

import { sha256Hex } from '../../../../packages/artifacts/src/index';
import { putPrivateCanonicalBytes } from '../../src/composition/artifact-storage';

describe('private canonical export storage', () => {
  it('asks R2 to verify and retain the export SHA-256 during PUT', async () => {
    const bytes = new TextEncoder().encode('deterministic export bytes');
    const contentHash = await sha256Hex(bytes);
    const put = vi.fn(async () => undefined);

    await putPrivateCanonicalBytes({ put } as never, {
      objectKey: 'workspaces/workspace-1/runs/run-1/exports/hash.zip',
      bytes,
      mimeType: 'application/zip',
      workspaceId: 'workspace-1',
      runId: 'run-1',
      contentHash,
    });

    expect(put).toHaveBeenCalledWith('workspaces/workspace-1/runs/run-1/exports/hash.zip', bytes, {
      httpMetadata: { contentType: 'application/zip' },
      customMetadata: {
        visibility: 'private',
        workspace_id: 'workspace-1',
        run_id: 'run-1',
      },
      sha256: Uint8Array.from(contentHash.match(/.{2}/gu) ?? [], (pair) =>
        Number.parseInt(pair, 16),
      ),
    });
  });
});
