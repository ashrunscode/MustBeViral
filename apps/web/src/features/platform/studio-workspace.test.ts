import { describe, expect, it, vi } from 'vitest';
import { proveStudioWorkspace, studioDirectoryOwnsWorkspace } from './studio-workspace';

const WA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STUDIO = '11111111-1111-4111-8111-111111111111';

describe('studio and workspace association', () => {
  it('is true only when the directory holds a brand in the workspace', () => {
    expect(studioDirectoryOwnsWorkspace([{ workspace_id: WB }, { workspace_id: WA }], WA)).toBe(
      true,
    );
    expect(studioDirectoryOwnsWorkspace([{ workspace_id: WB }], WA)).toBe(false);
    expect(studioDirectoryOwnsWorkspace([], WA)).toBe(false);
  });

  it('pages through the directory until a brand in the workspace is found', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ workspace_id: WB }], next_cursor: 'page-2' })
      .mockResolvedValueOnce({ items: [{ workspace_id: WA }], next_cursor: null });
    await expect(proveStudioWorkspace(STUDIO, WA, list)).resolves.toEqual({
      status: 'associated',
    });
    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls[1]?.[0]).toMatchObject({ cursor: 'page-2', include_archived: true });
  });

  it('refuses when every page is read and none holds a brand in the workspace', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ workspace_id: WB }], next_cursor: 'page-2' })
      .mockResolvedValueOnce({ items: [], next_cursor: null });
    await expect(proveStudioWorkspace(STUDIO, WA, list)).resolves.toEqual({
      status: 'unassociated',
    });
  });

  it('reports a failed read instead of guessing', async () => {
    const list = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await proveStudioWorkspace(STUDIO, WA, list);
    expect(result.status).toBe('error');
  });
});
