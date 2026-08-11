import { describe, expect, it } from 'vitest';

import type {
  HarnessResult,
  HarnessTransport,
  HarnessTransportOperation,
} from '../../tools/launch-pack-harness-lib';
import { pollRunUntilTerminal } from '../../tools/washbodega-pack-run';

function ok(data: Readonly<Record<string, unknown>>): HarnessResult {
  return { ok: true, data };
}

describe('WashBodega pack progress polling', () => {
  it('reports authoritative run and receipt progress until terminal success', async () => {
    const statuses = ['queued', 'running', 'succeeded'];
    const artifacts = [0, 3, 16];
    let poll = 0;
    let now = Date.parse('2026-08-11T12:00:00.000Z');
    const lines: string[] = [];
    const transport: HarnessTransport = {
      async call(operation: HarnessTransportOperation): Promise<HarnessResult> {
        if (operation === 'get_run') return ok({ run: { status: statuses[poll] } });
        const result = ok({
          receipt: {
            run: { status: statuses[poll] },
            reservation: { captured_micros: String(poll * 1_000_000), released_micros: '0' },
            artifacts: Array.from({ length: artifacts[poll] ?? 0 }, (_, index) => ({ index })),
          },
        });
        poll += 1;
        return result;
      },
    };

    const terminal = await pollRunUntilTerminal(
      transport,
      () => ({ request_id: 'test' }),
      'run-1',
      {
        timeoutMs: 10_000,
        pollIntervalMs: 1_000,
        now: () => now,
        sleep: async (milliseconds) => {
          now += milliseconds;
        },
        stderr: (line) => lines.push(line),
      },
    );

    expect(terminal.status).toBe('succeeded');
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.stringContaining('PROGRESS status=queued artifacts=0'),
        expect.stringContaining('PROGRESS status=running artifacts=3'),
        expect.stringContaining('PROGRESS status=succeeded artifacts=16'),
      ]),
    );
    expect(lines.join('\n')).not.toContain('STATUS unknown');
  });

  it('fails with the last real progress at the explicit timeout', async () => {
    let now = Date.parse('2026-08-11T12:00:00.000Z');
    const transport: HarnessTransport = {
      async call(operation: HarnessTransportOperation): Promise<HarnessResult> {
        return operation === 'get_run'
          ? ok({ run: { status: 'running' } })
          : ok({
              receipt: {
                run: { status: 'running' },
                reservation: { captured_micros: '1000000', released_micros: '0' },
                artifacts: [{ id: 'artifact-1' }],
              },
            });
      },
    };

    await expect(
      pollRunUntilTerminal(transport, () => ({ request_id: 'test' }), 'run-timeout', {
        timeoutMs: 2_500,
        pollIntervalMs: 1_000,
        heartbeatMs: 1_000,
        now: () => now,
        sleep: async (milliseconds) => {
          now += milliseconds;
        },
        stderr: () => undefined,
      }),
    ).rejects.toThrow(
      'explicit 2-second timeout (last status: running, artifacts: 1, captured_micros: 1000000, released_micros: 0)',
    );
  });
});
