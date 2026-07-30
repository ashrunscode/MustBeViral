import { ProviderError } from './errors';
import type { ProviderSubmission, VersionedProviderDriver } from './types';

export interface PendingProviderOutboxEvent {
  readonly eventId: string;
  readonly workspaceId: string;
  readonly runId: string;
  readonly attemptId: string;
  readonly providerRegistrationId: string;
  readonly routeId: string;
  readonly billingIdempotencyKey: string;
  readonly payload: unknown;
  readonly executionPlanLine: unknown;
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

    const eventsByRunEvent = new Map<string, PendingProviderOutboxEvent[]>();
    for (const event of events) {
      const group = eventsByRunEvent.get(event.eventId) ?? [];
      group.push(event);
      eventsByRunEvent.set(event.eventId, group);
    }

    for (const runEvents of eventsByRunEvent.values()) {
      let failure: Readonly<{ event: PendingProviderOutboxEvent; error: ProviderError }> | null =
        null;
      let publishedResult: ProviderSubmission | Readonly<{ reconciliationRequired: true }> | null =
        null;

      for (const event of runEvents) {
        const existing = await this.outbox.findSubmissionByBillingKey(event.billingIdempotencyKey);
        if (existing !== null) {
          publishedResult = existing;
          replayed += 1;
          continue;
        }
        const driver = this.driversByRoute.get(event.routeId);
        if (driver === undefined) {
          const error = new ProviderError(
            'provider_error',
            'no driver is registered for the route',
            false,
            {
              routeId: event.routeId,
            },
          );
          failure ??= { event, error };
          failed += 1;
          continue;
        }
        try {
          const result = await driver.submit({
            billingIdempotencyKey: event.billingIdempotencyKey,
            payload: event.payload,
          });
          await this.outbox.recordSubmission(event, result);
          publishedResult = result;
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
            publishedResult = { reconciliationRequired: true };
            reconciliationRequired += 1;
          } else {
            failure ??= { event, error };
            failed += 1;
          }
        }
      }

      if (failure !== null) {
        await this.outbox.recordFailure(failure.event, failure.error);
      } else {
        const first = runEvents[0];
        if (first !== undefined && publishedResult !== null) {
          await this.outbox.markPublished(first, publishedResult);
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

/** Providers whose jobs can be reconciled. OpenRouter joined when copy moved off Moonshot. */
export type SettleableProvider = 'fal' | 'openrouter' | 'moonshot';

export interface PendingProviderReconciliationJob {
  readonly providerJobId: string;
  readonly provider: SettleableProvider;
  readonly routeId: string;
  readonly providerRequestId: string;
  readonly status: 'submitted' | 'unknown';
}

export interface ProviderReconciliationPort {
  listPending(limit: number): Promise<readonly PendingProviderReconciliationJob[]>;
  recordStatus(
    job: PendingProviderReconciliationJob,
    status: Awaited<ReturnType<NonNullable<VersionedProviderDriver['status']>>>,
  ): Promise<void>;
  recordFailure(job: PendingProviderReconciliationJob, error: ProviderError): Promise<void>;
}

export interface ProviderReconciliationSummary {
  readonly checked: number;
  readonly updated: number;
  readonly failed: number;
}

export class ProviderReconciler {
  private readonly driversByRoute: ReadonlyMap<string, VersionedProviderDriver>;

  constructor(
    drivers: readonly VersionedProviderDriver[],
    private readonly reconciliation: ProviderReconciliationPort,
  ) {
    this.driversByRoute = new Map(
      drivers.map((driver) => [driver.descriptor.routeId, driver] as const),
    );
  }

  async reconcilePending(limit: number): Promise<ProviderReconciliationSummary> {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new ProviderError('payload_invalid', 'reconciliation limit must be positive', false);
    }
    const jobs = await this.reconciliation.listPending(limit);
    let updated = 0;
    let failed = 0;
    for (const job of jobs) {
      const driver = this.driversByRoute.get(job.routeId);
      if (driver?.status === undefined) {
        await this.reconciliation.recordFailure(
          job,
          new ProviderError(
            'provider_error',
            'no status-capable driver is registered for the route',
            false,
            { routeId: job.routeId },
          ),
        );
        failed += 1;
        continue;
      }
      try {
        const status = await driver.status(job.providerRequestId);
        await this.reconciliation.recordStatus(job, status);
        updated += 1;
      } catch (cause) {
        const error =
          cause instanceof ProviderError
            ? cause
            : new ProviderError(
                'provider_error',
                'provider reconciliation failed unexpectedly',
                true,
                {},
                { cause },
              );
        await this.reconciliation.recordFailure(job, error);
        failed += 1;
      }
    }
    return { checked: jobs.length, updated, failed };
  }
}
