import { describe, expect, it, vi } from 'vitest';

import { InMemoryRunPort } from './run-port';

describe('InMemoryRunPort', () => {
  it('streams queued, running, first-reviewable, partial, and complete stages', () => {
    const port = new InMemoryRunPort();
    const listener = vi.fn();
    port.subscribe(listener);

    const initial = port.read('run-lumen-0007');
    expect(initial.type).toBe('ok');
    if (initial.type !== 'ok') return;
    expect(initial.snapshot.attempts.map((attempt) => attempt.state)).toEqual([
      'running',
      'queued',
      'queued',
      'queued',
    ]);

    const partial = port.advance(initial.snapshot.runId, 0);
    expect(partial.type).toBe('ok');
    if (partial.type !== 'ok') return;
    expect(partial.snapshot.state).toBe('reviewable');
    expect(partial.snapshot.firstReviewable).toBe(true);
    expect(partial.snapshot.attempts.map((attempt) => attempt.state)).toContain('running');

    port.advance(partial.snapshot.runId, 1);
    const complete = port.advance(partial.snapshot.runId, 2);
    expect(complete.type === 'ok' && complete.snapshot.state).toBe('complete');
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('supports a failed terminal branch', () => {
    const port = new InMemoryRunPort('failed');
    port.advance('run-lumen-0007', 0);
    const result = port.advance('run-lumen-0007', 1);
    expect(result.type).toBe('ok');
    if (result.type !== 'ok') return;
    expect(result.snapshot.state).toBe('failed');
    expect(result.snapshot.attempts.find((attempt) => attempt.id === 'motion')?.state).toBe(
      'failed',
    );
  });

  it('cancels active attempts into a terminal state', () => {
    const port = new InMemoryRunPort();
    const result = port.cancel('run-lumen-0007', 0);
    expect(result.type).toBe('ok');
    if (result.type !== 'ok') return;
    expect(result.snapshot.state).toBe('cancelled');
    expect(result.snapshot.attempts.every((attempt) => attempt.state === 'cancelled')).toBe(true);
  });

  it('renders every result union branch', () => {
    const port = new InMemoryRunPort();
    expect(port.read('missing')).toEqual({ type: 'not_found', run_id: 'missing' });
    expect(port.advance('run-lumen-0007', 99)).toEqual({
      type: 'conflict',
      actual_state: 'running',
    });
  });
});
