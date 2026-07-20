import { describe, expect, it } from 'vitest';

import {
  attemptStates,
  attemptTransitionTable,
  isActorType,
  runNodeStates,
  runNodeTransitionTable,
  runStates,
  runTransitionTable,
  TransitionError,
  transitionAttempt,
  transitionRun,
  transitionRunNode,
  type AttemptEvent,
  type AttemptState,
  type RunEvent,
  type RunNodeEvent,
  type RunNodeState,
  type RunState,
} from './index';

const runEvents: readonly RunEvent[] = [
  'dispatch',
  'start',
  'mark_partial_succeeded',
  'succeed',
  'request_cancel',
  'cancel',
  'fail',
  'require_reconciliation',
];

const runNodeEvents: readonly RunNodeEvent[] = [
  'make_ready',
  'enqueue',
  'start',
  'succeed',
  'fail',
  'cancel',
  'skip',
  'require_reconciliation',
];

const attemptEvents: readonly AttemptEvent[] = [
  'begin_submission',
  'confirm_submission',
  'start',
  'succeed',
  'fail',
  'request_cancel',
  'cancel',
  'mark_ambiguous',
];

function assertTransitionMatrix<State extends string, Event extends string>(
  states: readonly State[],
  events: readonly Event[],
  table: Readonly<Record<State, Readonly<Partial<Record<Event, State>>>>>,
  transition: (state: State, event: Event) => State,
): void {
  for (const state of states) {
    for (const event of events) {
      const expected = table[state][event];

      if (expected === undefined) {
        expect(() => transition(state, event)).toThrow(TransitionError);
      } else {
        expect(transition(state, event)).toBe(expected);
      }
    }
  }
}

describe('actor boundary', () => {
  it('recognizes user and explicit machine identities only', () => {
    expect(isActorType('user')).toBe(true);
    expect(isActorType('machine')).toBe(true);
    expect(isActorType('service_role')).toBe(false);
  });
});

describe('run state machine', () => {
  it('implements every legal and illegal state/event pair in the table', () => {
    assertTransitionMatrix<RunState, RunEvent>(
      runStates,
      runEvents,
      runTransitionTable,
      transitionRun,
    );
  });

  it('reports a typed error with allowed events', () => {
    expect.assertions(6);

    try {
      transitionRun('succeeded', 'dispatch');
    } catch (error) {
      expect(error).toBeInstanceOf(TransitionError);
      const transitionError = error as TransitionError<RunState, RunEvent>;
      expect(transitionError.code).toBe('ILLEGAL_TRANSITION');
      expect(transitionError.entity).toBe('run');
      expect(transitionError.state).toBe('succeeded');
      expect(transitionError.event).toBe('dispatch');
      expect(transitionError.allowedEvents).toEqual([]);
    }
  });
});

describe('run node state machine', () => {
  it('implements every legal and illegal state/event pair in the table', () => {
    assertTransitionMatrix<RunNodeState, RunNodeEvent>(
      runNodeStates,
      runNodeEvents,
      runNodeTransitionTable,
      transitionRunNode,
    );
  });
});

describe('attempt state machine', () => {
  it('implements every legal and illegal state/event pair in the table', () => {
    assertTransitionMatrix<AttemptState, AttemptEvent>(
      attemptStates,
      attemptEvents,
      attemptTransitionTable,
      transitionAttempt,
    );
  });

  it('keeps ambiguous attempts fail-closed', () => {
    expect(() => transitionAttempt('ambiguous', 'begin_submission')).toThrow(TransitionError);
  });
});
