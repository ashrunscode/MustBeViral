import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as fixtures from '../scripts/platform-journey-fixtures';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));

const users = Array.from({ length: 12 }, (_, index) => ({
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  email: `w1b004-cleanup-${index}@synthetic.example.test`,
}));
const runtime = {
  database: { host: '127.0.0.1', port: 56322, database: 'postgres', password: 'FAKE_CANARY_LOCAL' },
  api: { url: 'http://127.0.0.1:56321', serviceRoleKey: 'FAKE_CANARY_SERVICE' },
};
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(execFileSync).mockReturnValue(JSON.stringify(runtime));
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (input, init) => {
    const user = users.find((candidate) => String(input).endsWith(`/${candidate.id}`));
    return init?.method === 'GET'
      ? Response.json({ email: user?.email })
      : new Response(null, { status: 200 });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('local synthetic journey cleanup', () => {
  it('cleans a suite batch under one verified runtime without repeated credential subprocesses', async () => {
    const results = await fixtures.deleteSyntheticUsers(users);
    expect(results).toHaveLength(users.length);
    expect(results.every((result) => result.deleted)).toBe(true);
    expect(execFileSync).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(users.length * 2);
    expect(
      fetchMock.mock.calls.every(([url]) =>
        String(url).startsWith(`${runtime.api.url}/auth/v1/admin/users/`),
      ),
    ).toBe(true);
  });

  it('rejects a non-synthetic email or malformed identity before any request', async () => {
    for (const user of [
      { ...users[0]!, email: 'real@example.test' },
      { ...users[0]!, id: '../another-user' },
    ]) {
      await expect(fixtures.deleteSyntheticUsers([user])).rejects.toThrow('synthetic');
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(execFileSync).not.toHaveBeenCalled();
  });

  it('fails closed on runtime ownership failure and redacts subprocess diagnostics', async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('FAKE_CANARY_PRIVATE_OUTPUT');
    });
    await expect(fixtures.deleteSyntheticUsers(users)).rejects.toThrow(
      'verified MustBeViral local runtime is unavailable',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves an account when its current server identity differs from the recorded synthetic user', async () => {
    fetchMock.mockResolvedValue(Response.json({ email: 'someone-else@example.test' }));
    const results = await fixtures.deleteSyntheticUsers([users[0]!]);
    expect(results[0]).toMatchObject({ deleted: false, status: 409 });
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
  });

  it('reports an absent user as already removed and preserves failed deletions', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    fetchMock.mockResolvedValueOnce(Response.json({ email: users[1]!.email }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const results = await fixtures.deleteSyntheticUsers(users.slice(0, 2));
    expect(results.map(({ deleted, status }) => ({ deleted, status }))).toEqual([
      { deleted: true, status: 404 },
      { deleted: false, status: 500 },
    ]);
  });
});
