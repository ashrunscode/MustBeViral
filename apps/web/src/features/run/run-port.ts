export type RunAttemptState = 'queued' | 'running' | 'complete' | 'failed' | 'cancelled';

export interface RunAttempt {
  readonly id: string;
  readonly node: string;
  readonly provider: string;
  readonly state: RunAttemptState;
  readonly detail: string;
}

export type RunState = 'running' | 'reviewable' | 'complete' | 'failed' | 'cancelled';

export interface RunSnapshot {
  readonly runId: string;
  readonly revision: string;
  readonly sequence: number;
  readonly state: RunState;
  readonly firstReviewable: boolean;
  readonly attempts: readonly RunAttempt[];
}

export type RunPortResult =
  | { readonly type: 'ok'; readonly snapshot: RunSnapshot }
  | { readonly type: 'conflict'; readonly actual_state: RunState }
  | { readonly type: 'not_found'; readonly run_id: string };

export interface RunPort {
  read(runId: string): RunPortResult;
  advance(runId: string, expectedSequence: number): RunPortResult;
  cancel(runId: string, expectedSequence: number): RunPortResult;
  subscribe(listener: (snapshot: RunSnapshot) => void): () => void;
}

const fixtureFrames = [
  [
    {
      id: 'concept',
      node: 'Concept logic',
      provider: 'kimi-2.6',
      state: 'running',
      detail: 'Reasoning route pinned',
    },
    {
      id: 'assets',
      node: 'Asset generation',
      provider: 'flux-2-klein',
      state: 'queued',
      detail: '3 variants queued',
    },
    {
      id: 'copy',
      node: 'Copy sets',
      provider: 'kimi-2.6',
      state: 'queued',
      detail: '3 sets queued',
    },
    {
      id: 'motion',
      node: 'Motion',
      provider: 'seedance-1.0',
      state: 'queued',
      detail: '6 second render queued',
    },
  ],
  [
    {
      id: 'concept',
      node: 'Concept logic',
      provider: 'kimi-2.6',
      state: 'complete',
      detail: 'Approved route produced',
    },
    {
      id: 'assets',
      node: 'Asset generation',
      provider: 'flux-2-klein',
      state: 'running',
      detail: 'Variant 2 of 3',
    },
    {
      id: 'copy',
      node: 'Copy sets',
      provider: 'kimi-2.6',
      state: 'running',
      detail: 'Set 1 reviewable',
    },
    {
      id: 'motion',
      node: 'Motion',
      provider: 'seedance-1.0',
      state: 'queued',
      detail: 'Waiting on hero asset',
    },
  ],
  [
    {
      id: 'concept',
      node: 'Concept logic',
      provider: 'kimi-2.6',
      state: 'complete',
      detail: 'Approved route produced',
    },
    {
      id: 'assets',
      node: 'Asset generation',
      provider: 'flux-2-klein',
      state: 'complete',
      detail: '3 variants reviewable',
    },
    {
      id: 'copy',
      node: 'Copy sets',
      provider: 'kimi-2.6',
      state: 'complete',
      detail: '3 sets reviewable',
    },
    {
      id: 'motion',
      node: 'Motion',
      provider: 'seedance-1.0',
      state: 'running',
      detail: 'Rendering frame 96 of 144',
    },
  ],
  [
    {
      id: 'concept',
      node: 'Concept logic',
      provider: 'kimi-2.6',
      state: 'complete',
      detail: 'Approved route produced',
    },
    {
      id: 'assets',
      node: 'Asset generation',
      provider: 'flux-2-klein',
      state: 'complete',
      detail: '3 variants reviewable',
    },
    {
      id: 'copy',
      node: 'Copy sets',
      provider: 'kimi-2.6',
      state: 'complete',
      detail: '3 sets reviewable',
    },
    {
      id: 'motion',
      node: 'Motion',
      provider: 'seedance-1.0',
      state: 'complete',
      detail: '6 second render reviewable',
    },
  ],
] as const satisfies readonly (readonly RunAttempt[])[];

function snapshotFor(sequence: number, attempts: readonly RunAttempt[]): RunSnapshot {
  const completeCount = attempts.filter((attempt) => attempt.state === 'complete').length;
  const failed = attempts.some((attempt) => attempt.state === 'failed');
  return {
    runId: 'run-lumen-0007',
    revision: '7f3a',
    sequence,
    state: failed
      ? 'failed'
      : completeCount === attempts.length
        ? 'complete'
        : completeCount > 0
          ? 'reviewable'
          : 'running',
    firstReviewable: completeCount > 0,
    attempts,
  };
}

export class InMemoryRunPort implements RunPort {
  #snapshot = snapshotFor(0, fixtureFrames[0]);
  readonly #listeners = new Set<(snapshot: RunSnapshot) => void>();
  readonly #scenario: 'normal' | 'failed';

  constructor(scenario: 'normal' | 'failed' = 'normal') {
    this.#scenario = scenario;
  }

  read(runId: string): RunPortResult {
    return runId === this.#snapshot.runId
      ? { type: 'ok', snapshot: this.#snapshot }
      : { type: 'not_found', run_id: runId };
  }

  advance(runId: string, expectedSequence: number): RunPortResult {
    const current = this.read(runId);
    if (current.type !== 'ok') return current;
    if (expectedSequence !== current.snapshot.sequence || current.snapshot.state === 'cancelled') {
      return { type: 'conflict', actual_state: current.snapshot.state };
    }
    const nextIndex = Math.min(current.snapshot.sequence + 1, fixtureFrames.length - 1);
    const fixtureFrame = fixtureFrames[nextIndex] ?? fixtureFrames[0];
    const nextAttempts =
      this.#scenario === 'failed' && nextIndex === 2
        ? fixtureFrame.map((attempt) =>
            attempt.id === 'motion'
              ? {
                  ...attempt,
                  state: 'failed' as const,
                  detail: 'Provider output failed; no charge accepted',
                }
              : attempt,
          )
        : fixtureFrame;
    this.#snapshot = snapshotFor(nextIndex, nextAttempts);
    this.#emit();
    return { type: 'ok', snapshot: this.#snapshot };
  }

  cancel(runId: string, expectedSequence: number): RunPortResult {
    const current = this.read(runId);
    if (current.type !== 'ok') return current;
    if (expectedSequence !== current.snapshot.sequence || current.snapshot.state === 'complete') {
      return { type: 'conflict', actual_state: current.snapshot.state };
    }
    this.#snapshot = {
      ...current.snapshot,
      sequence: current.snapshot.sequence + 1,
      state: 'cancelled',
      attempts: current.snapshot.attempts.map((attempt) =>
        attempt.state === 'queued' || attempt.state === 'running'
          ? {
              ...attempt,
              state: 'cancelled' as const,
              detail: 'Cancelled before provider completion',
            }
          : attempt,
      ),
    };
    this.#emit();
    return { type: 'ok', snapshot: this.#snapshot };
  }

  subscribe(listener: (snapshot: RunSnapshot) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit() {
    for (const listener of this.#listeners) listener(this.#snapshot);
  }
}
