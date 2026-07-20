import { ProviderError } from './errors';
import type { ProviderSubmission, VersionedProviderDriver } from './types';

export interface PendingProviderOutboxEvent {
  readonly eventId: string;
  readonly attemptId: string;
  readonly routeId: string;
  readonly billingIdempotencyKey: string;
  readonly payload: unknown;
}

export interface ProviderOutboxPort {
  claimPending(limit: number): Promise<readonly PendingProviderOutboxEvent[]>;
  findSubmissionByBillingKey(billingIdempotencyKey: string): Promise<ProviderSubmission | null>;
  recordSubmission(event: PendingProviderOutboxEvent, result: ProviderSubmission): Promise<void>;
  recordAmbiguity(event: PendingProviderOutboxEvent, error: ProviderError): Promise<void>;
  recordFailure(event: PendingProviderOutboxEvent, error: ProviderError): Promise<void>;
  markPublished(
    event: PendingProviderOutboxEvent,
    result: ProviderSubmission | Readonly<{ reconciliationRequired: true }>,
  ): Promise<void>;
}

export interface OutboxDispatchSummary {
  readonly claimed: number;
  readonly submitted: number;
  readonly replayed: number;
  readonly reconciliationRequired: number;
  readonly failed: number;
}

export class OutboxDispatcher {
  private readonly driversByRoute: ReadonlyMap<string, VersionedProviderDriver>;

  constructor(
    drivers: readonly VersionedProviderDriver[],
    private readonly outbox: ProviderOutboxPort,
  ) {
    const entries = drivers.map((driver) => [driver.descriptor.routeId, driver] as const);
    this.driversByRoute = new Map(entries);
    if (this.driversByRoute.size !== entries.length) {
      throw new ProviderError('provider_error', 'duplicate provider route registration', false);
    }
  }

  async dispatchPending(limit: number): Promise<OutboxDispatchSummary> {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new ProviderError('payload_invalid', 'outbox dispatch limit must be positive', false);
    }
    const events = await this.outbox.claimPending(limit);
    let submitted = 0;
    let replayed = 0;
    let reconciliationRequired = 0;
    let failed = 0;

    for (const event of events) {
      const existing = await this.outbox.findSubmissionByBillingKey(event.billingIdempotencyKey);
      if (existing !== null) {
        await this.outbox.markPublished(event, existing);
        replayed += 1;
        continue;
      }
      const driver = this.driversByRoute.get(event.routeId);
      if (driver === undefined) {
        await this.outbox.recordFailure(
          event,
          new ProviderError('provider_error', 'no driver is registered for the route', false, {
            routeId: event.routeId,
          }),
        );
        failed += 1;
        continue;
      }
      try {
        const result = await driver.submit({
          billingIdempotencyKey: event.billingIdempotencyKey,
          payload: event.payload,
        });
        await this.outbox.recordSubmission(event, result);
        await this.outbox.markPublished(event, result);
        submitted += 1;
      } catch (cause) {
        const error =
          cause instanceof ProviderError
            ? cause
            : new ProviderError(
                'provider_error',
                'provider driver failed unexpectedly',
                true,
                {},
                {
                  cause,
                },
              );
        if (error.code === 'ambiguous_submit') {
          await this.outbox.recordAmbiguity(event, error);
          await this.outbox.markPublished(event, { reconciliationRequired: true });
          reconciliationRequired += 1;
        } else {
          await this.outbox.recordFailure(event, error);
          failed += 1;
        }
      }
    }
    return {
      claimed: events.length,
      submitted,
      replayed,
      reconciliationRequired,
      failed,
    };
  }
}
