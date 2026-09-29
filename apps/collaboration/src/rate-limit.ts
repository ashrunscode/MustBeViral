/**
 * Message rate limits for one canvas coordination object.
 *
 * Every client message spends tokens from two buckets: one for its socket and one for its bound
 * actor across all of that actor's sockets on this canvas. A message is processed only when both
 * buckets can pay; otherwise it is refused with `RATE_LIMITED` and nothing is spent. Each refusal
 * (and each oversized frame) adds a strike to the socket. Strikes drain at a fixed rate, so a client
 * that keeps sending faster than it may accumulates them, and the socket is closed once they pass
 * the limit.
 *
 * The state lives in the object's memory. Eviction resets it, which can only hand a client one
 * fresh burst: an object is evicted only after it has been idle, and a bucket refills in seconds.
 */

export interface TokenBucketPolicy {
  readonly capacity: number;
  readonly refillPerSecond: number;
}

/**
 * Normal editing sends at most about five messages a second: text drafts sync 180 ms after the last
 * keystroke, and leases are taken and released on focus and blur. A socket may burst 30 messages and
 * sustain 10 a second. An actor may burst 60 and sustain 20 a second across all its sockets.
 */
export const SOCKET_MESSAGE_BUCKET: TokenBucketPolicy = { capacity: 30, refillPerSecond: 10 };
export const ACTOR_MESSAGE_BUCKET: TokenBucketPolicy = { capacity: 60, refillPerSecond: 20 };

/** A full snapshot costs far more to send than a mutation, so reading one spends more tokens. */
export const MESSAGE_TOKEN_COST = 1;
export const SNAPSHOT_TOKEN_COST = 5;
/**
 * Frames that are refused before they do anything still cost the object work, so they spend more
 * than a valid message: an oversized frame 10 tokens (a full second of a socket's refill) and a
 * frame that is not valid JSON or fails the protocol schema 5. A well-behaved client sends neither:
 * it checks the same limits before sending.
 */
export const OVERSIZED_FRAME_TOKEN_COST = 10;
export const INVALID_FRAME_TOKEN_COST = 5;

/** Undrained strikes beyond this close the socket with a policy violation. */
export const ABUSE_STRIKE_LIMIT = 20;
export const ABUSE_STRIKE_DRAIN_PER_SECOND = 1;
/**
 * Strikes per event. A refusal for rate adds 1. An oversized frame adds 5 and an invalid frame 2, so
 * sending them faster than one every five seconds (oversized) or two seconds (invalid) accumulates
 * strikes faster than they drain and ends in a close: one oversized frame a second closes the
 * socket within five seconds.
 */
export const RATE_REFUSAL_STRIKES = 1;
export const OVERSIZED_FRAME_STRIKES = 5;
export const INVALID_FRAME_STRIKES = 2;

/** Broadcasts are coalesced to at most one full snapshot per canvas per interval. */
export const BROADCAST_MIN_INTERVAL_MS = 100;

interface BucketState {
  tokens: number;
  updatedAtMs: number;
}

function refill(state: BucketState, policy: TokenBucketPolicy, nowMs: number): void {
  const elapsedSeconds = Math.max(0, nowMs - state.updatedAtMs) / 1_000;
  state.tokens = Math.min(policy.capacity, state.tokens + elapsedSeconds * policy.refillPerSecond);
  state.updatedAtMs = nowMs;
}

export type RateDecision =
  | Readonly<{ allowed: true }>
  | Readonly<{
      allowed: false;
      scope: 'socket' | 'actor';
      retryAfterMs: number;
      /** True when the socket's strikes passed the limit and it must be closed. */
      abusive: boolean;
    }>;

export class CanvasRateLimiter {
  readonly #sockets = new Map<string, BucketState & { strikes: number; strikesAtMs: number }>();
  readonly #actors = new Map<string, BucketState>();
  readonly #now: () => number;

  constructor(now: () => number = Date.now) {
    this.#now = now;
  }

  #socket(socketId: string, nowMs: number) {
    let state = this.#sockets.get(socketId);
    if (state === undefined) {
      state = {
        tokens: SOCKET_MESSAGE_BUCKET.capacity,
        updatedAtMs: nowMs,
        strikes: 0,
        strikesAtMs: nowMs,
      };
      this.#sockets.set(socketId, state);
    }
    refill(state, SOCKET_MESSAGE_BUCKET, nowMs);
    const drained =
      (Math.max(0, nowMs - state.strikesAtMs) / 1_000) * ABUSE_STRIKE_DRAIN_PER_SECOND;
    state.strikes = Math.max(0, state.strikes - drained);
    state.strikesAtMs = nowMs;
    return state;
  }

  #actor(actorId: string, nowMs: number): BucketState {
    let state = this.#actors.get(actorId);
    if (state === undefined) {
      state = { tokens: ACTOR_MESSAGE_BUCKET.capacity, updatedAtMs: nowMs };
      this.#actors.set(actorId, state);
    }
    refill(state, ACTOR_MESSAGE_BUCKET, nowMs);
    return state;
  }

  /** Spends `cost` tokens from both buckets, or refuses and records a strike. */
  consume(socketId: string, actorId: string, cost = MESSAGE_TOKEN_COST): RateDecision {
    const nowMs = this.#now();
    const socket = this.#socket(socketId, nowMs);
    const actor = this.#actor(actorId, nowMs);
    if (socket.tokens >= cost && actor.tokens >= cost) {
      socket.tokens -= cost;
      actor.tokens -= cost;
      return { allowed: true };
    }
    const scope = socket.tokens < cost ? 'socket' : 'actor';
    const bucket = scope === 'socket' ? socket : actor;
    const policy = scope === 'socket' ? SOCKET_MESSAGE_BUCKET : ACTOR_MESSAGE_BUCKET;
    const retryAfterMs = Math.ceil(((cost - bucket.tokens) / policy.refillPerSecond) * 1_000);
    return {
      allowed: false,
      scope,
      retryAfterMs,
      abusive: this.strike(socketId, RATE_REFUSAL_STRIKES),
    };
  }

  /** Spends tokens from an actor's bucket for a request that has no socket, such as a snapshot read. */
  consumeActor(actorId: string, cost: number): RateDecision {
    const actor = this.#actor(actorId, this.#now());
    if (actor.tokens >= cost) {
      actor.tokens -= cost;
      return { allowed: true };
    }
    const retryAfterMs = Math.ceil(
      ((cost - actor.tokens) / ACTOR_MESSAGE_BUCKET.refillPerSecond) * 1_000,
    );
    return { allowed: false, scope: 'actor', retryAfterMs, abusive: false };
  }

  /** Records a refused frame against a socket. Returns true once the socket must be closed. */
  strike(socketId: string, weight: number): boolean {
    const socket = this.#socket(socketId, this.#now());
    socket.strikes += weight;
    return socket.strikes > ABUSE_STRIKE_LIMIT;
  }

  forgetSocket(socketId: string): void {
    this.#sockets.delete(socketId);
  }

  /** Drops actor buckets that have refilled completely, so the map only holds recent senders. */
  pruneIdleActors(): void {
    const nowMs = this.#now();
    for (const [actorId, state] of this.#actors) {
      refill(state, ACTOR_MESSAGE_BUCKET, nowMs);
      if (state.tokens >= ACTOR_MESSAGE_BUCKET.capacity) this.#actors.delete(actorId);
    }
  }
}
