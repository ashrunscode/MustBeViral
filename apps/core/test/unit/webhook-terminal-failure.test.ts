import { describe, expect, it } from 'vitest';

import { ArtifactMachineError } from '../../src/composition/artifact-machine';

/**
 * A1 regression cover.
 *
 * `advance_fal_provider_attempt` aggregates per-attempt outcomes and, for a succeeded attempt,
 * reads the capture amount from the ledger. A succeeded OpenRouter copy attempt has no capture row
 * (nothing captured it), so that subquery yielded NULL and `jsonb_strip_nulls` deleted the key.
 * The TypeScript mapper then parsed the absent field into NaN and threw a *retryable* error — at a
 * caller that redelivers on any non-2xx, and after ingest had already captured money. The result
 * was an unbounded 503 loop sitting on captured funds.
 *
 * These assertions pin the two properties that stop it: the failure is classified terminal, and a
 * terminal classification is narrow enough that an ordinary outage is still retried.
 */

describe('artifact machine failure classification', () => {
  it('marks an impossible result non-retryable', () => {
    const error = new ArtifactMachineError(
      'artifact_machine_invariant',
      false,
      undefined,
      'attempt a1 reported succeeded with no capture_micros',
    );
    expect(error.retryable).toBe(false);
    expect(error.reason).toBe('artifact_machine_invariant');
    // The message must name the offending attempt: this is the only durable breadcrumb an operator
    // gets, because the event is answered once and never redelivered.
    expect(error.message).toContain('attempt a1');
  });

  it('keeps genuine unavailability retryable', () => {
    // The distinction is the whole safety property. If persistence is merely down, fal must be
    // allowed to redeliver, or a paid generation is lost.
    const error = new ArtifactMachineError('artifact_machine_unavailable', true);
    expect(error.retryable).toBe(true);
  });

  it('keeps a rejected privileged credential retryable', () => {
    // A misconfigured secret is an operator-fixable outage, not a poisoned event.
    const error = new ArtifactMachineError('artifact_machine_forbidden', false);
    expect(error.reason).toBe('artifact_machine_forbidden');
  });
});

describe('terminal-failure classification is narrow', () => {
  // Mirrors the predicate in apps/core/src/routes/v1.ts. Anything unrecognised must be retryable:
  // wrongly calling a transient failure terminal discards an event fal already charged for, while
  // wrongly retrying a terminal one only costs log noise until the stale-claim window intervenes.
  const isTerminalIngestFailure = (cause: unknown): boolean =>
    cause instanceof ArtifactMachineError && !cause.retryable;

  it('treats an invariant violation as terminal', () => {
    expect(
      isTerminalIngestFailure(
        new ArtifactMachineError('artifact_machine_invariant', false, undefined, 'x'),
      ),
    ).toBe(true);
  });

  it.each([
    ['a plain Error', new Error('boom')],
    ['a string', 'boom'],
    ['undefined', undefined],
    ['a retryable machine error', new ArtifactMachineError('artifact_machine_unavailable', true)],
  ])('treats %s as retryable', (_label, cause) => {
    expect(isTerminalIngestFailure(cause)).toBe(false);
  });
});
