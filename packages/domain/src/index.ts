export const actorTypes = ['user', 'machine', 'system'] as const;

export type ActorType = (typeof actorTypes)[number];

export interface Actor {
  readonly id: string;
  readonly type: ActorType;
}

export function isActorType(value: string): value is ActorType {
  return actorTypes.some((candidate) => candidate === value);
}

export const runStates = [
  'queued',
  'dispatching',
  'running',
  'partial_succeeded',
  'succeeded',
  'cancel_requested',
  'canceled',
  'failed',
  'reconciliation_required',
] as const;

export const runNodeStates = [
  'pending',
  'ready',
  'queued',
  'running',
  'succeeded',
  'failed',
  'canceled',
  'skipped',
  'reconciliation_required',
] as const;

export const attemptStates = [
  'created',
  'submitting',
  'submitted',
  'running',
  'succeeded',
  'failed',
  'cancel_requested',
  'canceled',
  'ambiguous',
] as const;

export type RunState = (typeof runStates)[number];
export type RunNodeState = (typeof runNodeStates)[number];
export type AttemptState = (typeof attemptStates)[number];

export type RunEvent =
  | 'dispatch'
  | 'start'
  | 'mark_partial_succeeded'
  | 'succeed'
  | 'request_cancel'
  | 'cancel'
  | 'fail'
  | 'require_reconciliation';

export type RunNodeEvent =
  | 'make_ready'
  | 'enqueue'
  | 'start'
  | 'succeed'
  | 'fail'
  | 'cancel'
  | 'skip'
  | 'require_reconciliation';

export type AttemptEvent =
  | 'begin_submission'
  | 'confirm_submission'
  | 'start'
  | 'succeed'
  | 'fail'
  | 'request_cancel'
  | 'cancel'
  | 'mark_ambiguous';

type TransitionTable<State extends string, Event extends string> = Readonly<
  Record<State, Readonly<Partial<Record<Event, State>>>>
>;

export const runTransitionTable = {
  queued: {
    dispatch: 'dispatching',
    request_cancel: 'cancel_requested',
    fail: 'failed',
    require_reconciliation: 'reconciliation_required',
  },
  dispatching: {
    start: 'running',
    request_cancel: 'cancel_requested',
    fail: 'failed',
    require_reconciliation: 'reconciliation_required',
  },
  running: {
    mark_partial_succeeded: 'partial_succeeded',
    succeed: 'succeeded',
    request_cancel: 'cancel_requested',
    fail: 'failed',
    require_reconciliation: 'reconciliation_required',
  },
  partial_succeeded: {
    succeed: 'succeeded',
    cancel: 'canceled',
    fail: 'failed',
  },
  succeeded: {},
  cancel_requested: {
    cancel: 'canceled',
    fail: 'failed',
    require_reconciliation: 'reconciliation_required',
  },
  canceled: {},
  failed: {},
  reconciliation_required: {},
} as const satisfies TransitionTable<RunState, RunEvent>;

export const runNodeTransitionTable = {
  pending: {
    make_ready: 'ready',
    fail: 'failed',
    cancel: 'canceled',
    skip: 'skipped',
  },
  ready: {
    enqueue: 'queued',
    fail: 'failed',
    cancel: 'canceled',
    skip: 'skipped',
  },
  queued: {
    start: 'running',
    fail: 'failed',
    cancel: 'canceled',
    skip: 'skipped',
    require_reconciliation: 'reconciliation_required',
  },
  running: {
    succeed: 'succeeded',
    fail: 'failed',
    cancel: 'canceled',
    skip: 'skipped',
    require_reconciliation: 'reconciliation_required',
  },
  succeeded: {},
  failed: {},
  canceled: {},
  skipped: {},
  reconciliation_required: {},
} as const satisfies TransitionTable<RunNodeState, RunNodeEvent>;

export const attemptTransitionTable = {
  created: {
    begin_submission: 'submitting',
    fail: 'failed',
    request_cancel: 'cancel_requested',
    cancel: 'canceled',
  },
  submitting: {
    confirm_submission: 'submitted',
    fail: 'failed',
    request_cancel: 'cancel_requested',
    cancel: 'canceled',
    mark_ambiguous: 'ambiguous',
  },
  submitted: {
    start: 'running',
    fail: 'failed',
    request_cancel: 'cancel_requested',
    cancel: 'canceled',
    mark_ambiguous: 'ambiguous',
  },
  running: {
    succeed: 'succeeded',
    fail: 'failed',
    request_cancel: 'cancel_requested',
    cancel: 'canceled',
    mark_ambiguous: 'ambiguous',
  },
  succeeded: {},
  failed: {},
  cancel_requested: {
    cancel: 'canceled',
    fail: 'failed',
    mark_ambiguous: 'ambiguous',
  },
  canceled: {},
  ambiguous: {},
} as const satisfies TransitionTable<AttemptState, AttemptEvent>;

export type TransitionEntity = 'run' | 'run_node' | 'attempt';

export class TransitionError<
  State extends string = string,
  Event extends string = string,
> extends Error {
  readonly code = 'ILLEGAL_TRANSITION';

  constructor(
    readonly entity: TransitionEntity,
    readonly state: State,
    readonly event: Event,
    readonly allowedEvents: readonly Event[],
  ) {
    super(`Illegal ${entity} transition: ${state} + ${event}`);
    this.name = 'TransitionError';
  }
}

function transition<State extends string, Event extends string>(
  entity: TransitionEntity,
  table: TransitionTable<State, Event>,
  state: State,
  event: Event,
): State {
  const transitions = table[state];
  const nextState = transitions[event];

  if (nextState === undefined) {
    throw new TransitionError(entity, state, event, Object.keys(transitions) as Event[]);
  }

  return nextState;
}

export function transitionRun(state: RunState, event: RunEvent): RunState {
  return transition('run', runTransitionTable, state, event);
}

export function transitionRunNode(state: RunNodeState, event: RunNodeEvent): RunNodeState {
  return transition('run_node', runNodeTransitionTable, state, event);
}

export function transitionAttempt(state: AttemptState, event: AttemptEvent): AttemptState {
  return transition('attempt', attemptTransitionTable, state, event);
}
