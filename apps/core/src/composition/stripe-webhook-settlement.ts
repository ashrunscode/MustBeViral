import {
  extractStripeCustomerId,
  extractStripeWorkspaceId,
  settleStripeWebhookEvent,
  type StripeSettlementPlan,
  type VerifiedStripeWebhook,
} from '@mustbeviral/billing';

import type { CoreBindings } from '../bindings';
import { createCoreEmailPort } from './core-email';
import { readPermanentRejection } from './postgrest-rejection';

export class StripeWebhookSettlementUnavailableError extends Error {
  override readonly name = 'StripeWebhookSettlementUnavailableError';
}

/**
 * A settlement RPC refused this event, for example P0001 STRIPE_EVENT_WORKSPACE_MISMATCH or
 * SQLSTATE 22023. Sending the same event again fails the same way until the data or the event
 * changes, so this is not an outage. Core's error log records the RPC, status, code and reason, and
 * the message is handed to exception telemetry, so both carry only the RPC name, the HTTP status, a
 * well-formed error code and an upper-case reason token, never PostgREST's message or details,
 * which can echo row values.
 */
export class StripeWebhookSettlementRpcRejectedError extends Error {
  override readonly name = 'StripeWebhookSettlementRpcRejectedError';

  constructor(
    readonly rpc: string,
    readonly status: number,
    readonly code: string,
    readonly reason: string | undefined,
  ) {
    super(
      `Stripe webhook settlement RPC ${rpc} rejected the event with HTTP ${status} (${code})${
        reason === undefined ? '' : `: ${reason}`
      }.`,
    );
  }
}

export class StripeWebhookSettlementForbiddenError extends Error {
  override readonly name = 'StripeWebhookSettlementForbiddenError';
}

export interface StripeWalletCreditPersistenceResult {
  readonly workspaceId: string;
  readonly transactionId: string;
  readonly replayed: boolean;
  readonly walletBalanceMicros: bigint;
}

export interface StripeSubscriptionPersistenceResult {
  readonly workspaceId: string;
  readonly replayed: boolean;
  readonly subscriptionStatus: string;
  readonly setupFeePaid: boolean;
}

function isWalletCreditResult(value: unknown): value is Readonly<{
  workspace_id: string;
  transaction_id: string;
  replayed: boolean;
  wallet_balance_micros: number | string;
}> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Readonly<Record<string, unknown>>;
  return (
    typeof record.workspace_id === 'string' &&
    typeof record.transaction_id === 'string' &&
    typeof record.replayed === 'boolean' &&
    (typeof record.wallet_balance_micros === 'number' ||
      typeof record.wallet_balance_micros === 'string')
  );
}

function isSubscriptionUpdateResult(value: unknown): value is Readonly<{
  workspace_id: string;
  replayed: boolean;
  subscription_status: string;
  setup_fee_paid: boolean;
}> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Readonly<Record<string, unknown>>;
  return (
    typeof record.workspace_id === 'string' &&
    typeof record.replayed === 'boolean' &&
    typeof record.subscription_status === 'string' &&
    typeof record.setup_fee_paid === 'boolean'
  );
}

export function createStripeWebhookSettlementPort(
  bindings: CoreBindings,
  fetchImplementation?: typeof fetch,
): Readonly<{
  applyWalletCredit(
    input: Readonly<{
      workspaceId: string | null;
      stripeEventId: string;
      stripeCustomerId: string | null;
      amountMicros: bigint;
      eventType: string;
      requestId: string;
      metadata?: Readonly<Record<string, unknown>>;
    }>,
  ): Promise<StripeWalletCreditPersistenceResult>;
  applySubscriptionUpdate(
    input: Readonly<{
      workspaceId: string | null;
      stripeEventId: string;
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      subscriptionStatus: string;
      setupFeePaid: boolean;
      requestId: string;
    }>,
  ): Promise<StripeSubscriptionPersistenceResult>;
}> {
  const baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
  const privilegedKey = bindings.SUPABASE_SECRET_KEY ?? bindings.SUPABASE_SERVICE_ROLE_KEY;
  const boundFetch = fetchImplementation ?? ((input, init) => fetch(input, init));

  async function rpc(
    functionName: string,
    body: Readonly<Record<string, unknown>>,
  ): Promise<unknown> {
    if (!baseUrl || !privilegedKey) {
      throw new StripeWebhookSettlementUnavailableError(
        'Stripe webhook settlement is unavailable without Supabase credentials.',
      );
    }

    let response: Response;
    try {
      response = await boundFetch(`${baseUrl}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          apikey: privilegedKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new StripeWebhookSettlementUnavailableError('Stripe webhook settlement RPC failed.', {
        cause,
      });
    }

    if (response.status === 401 || response.status === 403) {
      throw new StripeWebhookSettlementForbiddenError(
        'Stripe webhook settlement rejected the privileged credential.',
      );
    }
    const rejection = await readPermanentRejection(response);
    if (rejection !== null) {
      throw new StripeWebhookSettlementRpcRejectedError(
        functionName,
        response.status,
        rejection.code,
        rejection.reason,
      );
    }
    if (!response.ok) {
      throw new StripeWebhookSettlementUnavailableError(
        `Stripe webhook settlement RPC returned HTTP ${response.status}.`,
      );
    }

    try {
      return (await response.json()) as unknown;
    } catch (cause) {
      throw new StripeWebhookSettlementUnavailableError(
        'Stripe webhook settlement RPC returned invalid JSON.',
        { cause },
      );
    }
  }

  return Object.freeze({
    async applyWalletCredit(input) {
      const body = await rpc('apply_stripe_wallet_credit', {
        p_workspace_id: input.workspaceId,
        p_stripe_event_id: input.stripeEventId,
        p_stripe_customer_id: input.stripeCustomerId,
        p_amount_micros: input.amountMicros.toString(10),
        p_event_type: input.eventType,
        p_request_id: input.requestId,
        p_metadata: input.metadata ?? {},
      });
      if (!isWalletCreditResult(body)) {
        throw new StripeWebhookSettlementUnavailableError(
          'apply_stripe_wallet_credit returned an unexpected shape.',
        );
      }
      return Object.freeze({
        workspaceId: body.workspace_id,
        transactionId: body.transaction_id,
        replayed: body.replayed,
        walletBalanceMicros: BigInt(body.wallet_balance_micros),
      });
    },
    async applySubscriptionUpdate(input) {
      const body = await rpc('apply_stripe_subscription_update', {
        p_workspace_id: input.workspaceId,
        p_stripe_event_id: input.stripeEventId,
        p_stripe_customer_id: input.stripeCustomerId,
        p_stripe_subscription_id: input.stripeSubscriptionId,
        p_subscription_status: input.subscriptionStatus,
        p_setup_fee_paid: input.setupFeePaid,
        p_request_id: input.requestId,
      });
      if (!isSubscriptionUpdateResult(body)) {
        throw new StripeWebhookSettlementUnavailableError(
          'apply_stripe_subscription_update returned an unexpected shape.',
        );
      }
      return Object.freeze({
        workspaceId: body.workspace_id,
        replayed: body.replayed,
        subscriptionStatus: body.subscription_status,
        setupFeePaid: body.setup_fee_paid,
      });
    },
  });
}

export interface StripeWebhookSettlementResult {
  readonly settlement: StripeSettlementPlan;
  readonly emailStatus: 'disabled' | 'sent' | 'not_requested';
  readonly persisted: boolean;
}

export function createStripeWebhookSettlementHandler(
  bindings: CoreBindings,
  fetchImplementation?: typeof fetch,
): (
  input: Readonly<{
    verified: VerifiedStripeWebhook;
    requestId: string;
    operatorEmail?: string;
  }>,
) => Promise<StripeWebhookSettlementResult> {
  const persistence = createStripeWebhookSettlementPort(bindings, fetchImplementation);
  const email = createCoreEmailPort(bindings, fetchImplementation);

  return async ({ verified, requestId, operatorEmail }) => {
    const settlement = settleStripeWebhookEvent({ verified, requestId });
    let persisted = false;
    let walletCreditReplayed = false;

    if (settlement.kind === 'wallet_credit') {
      const workspaceId = extractStripeWorkspaceId(verified.payload, verified.eventType);
      const stripeCustomerId = extractStripeCustomerId(verified.payload);
      const credit = await persistence.applyWalletCredit({
        workspaceId,
        stripeEventId: verified.eventId,
        stripeCustomerId,
        amountMicros: settlement.plan.walletCreditMicros,
        eventType: verified.eventType,
        requestId,
        metadata: settlement.plan.movement.metadata,
      });
      persisted = true;
      walletCreditReplayed = credit.replayed;
    } else if (settlement.kind === 'subscription_update') {
      const workspaceId = extractStripeWorkspaceId(verified.payload, verified.eventType);
      const stripeCustomerId =
        settlement.stripeCustomerId ?? extractStripeCustomerId(verified.payload);
      await persistence.applySubscriptionUpdate({
        workspaceId,
        stripeEventId: verified.eventId,
        stripeCustomerId,
        stripeSubscriptionId: settlement.stripeSubscriptionId,
        subscriptionStatus: settlement.subscriptionStatus,
        setupFeePaid: settlement.setupFeePaid,
        requestId,
      });
      persisted = true;
    }

    // Stripe retries and redeliveries replay settlement, so only the delivery that credited the
    // wallet notifies the operator.
    if (
      settlement.kind !== 'wallet_credit' ||
      operatorEmail === undefined ||
      walletCreditReplayed
    ) {
      return Object.freeze({ settlement, emailStatus: 'not_requested' as const, persisted });
    }

    const emailStatus = await email.send({
      to: operatorEmail,
      subject: 'MustBeViral wallet credit received',
      text: `Stripe event ${verified.eventId} credited ${settlement.plan.walletCreditMicros.toString()} micros.`,
    });
    return Object.freeze({ settlement, emailStatus, persisted });
  };
}
