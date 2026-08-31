import {
  settleStripeWebhookEvent,
  verifyStripeWebhook,
  StripeWebhookVerificationError,
} from '@mustbeviral/billing';
import { Hono } from 'hono';

import type { CoreBindings, CoreHonoEnvironment } from '../bindings';
import { safeError, safeSuccess } from '../http/responses';
import { normalizeRequestId } from '../http/request-id';
import type { StripeWebhookSettlementResult } from '../composition/stripe-webhook-settlement';

export interface StripeWebhookDependencies {
  readonly webhookSecret: string | undefined;
  readonly recordEvent?: (
    event: Readonly<{ eventId: string; eventType: string; livemode: boolean; payloadHash: string }>,
  ) => Promise<boolean>;
  readonly settleEvent?: (
    input: Readonly<{
      verified: Readonly<{
        eventId: string;
        eventType: string;
        livemode: boolean;
        payload: unknown;
      }>;
      requestId: string;
    }>,
  ) => Promise<StripeWebhookSettlementResult>;
}

export function resolveStripeWebhookDependencies(
  bindings: CoreBindings | undefined,
  recordEvent?: StripeWebhookDependencies['recordEvent'],
  settleEvent?: StripeWebhookDependencies['settleEvent'],
): StripeWebhookDependencies {
  return {
    webhookSecret: bindings?.STRIPE_WEBHOOK_SECRET,
    ...(recordEvent === undefined ? {} : { recordEvent }),
    ...(settleEvent === undefined ? {} : { settleEvent }),
  };
}

export function createStripeWebhookRoute(
  getDependencies: (bindings: CoreBindings, requestId: string) => StripeWebhookDependencies,
) {
  const route = new Hono<CoreHonoEnvironment>();

  route.post('/', async (context) => {
    const deps = getDependencies(context.env, context.get('requestId'));

    if (deps.webhookSecret === undefined || deps.webhookSecret.length === 0) {
      return context.json(
        safeError(context, 'PROVIDER_UNAVAILABLE', 'Stripe webhook ingestion is not configured.'),
        503,
      );
    }

    const signature = context.req.header('stripe-signature');
    if (signature === undefined || signature.length === 0) {
      return context.json(
        safeError(context, 'VALIDATION_ERROR', 'Stripe-Signature header is required.'),
        400,
      );
    }

    const rawBody = await context.req.text();
    try {
      const verified = await verifyStripeWebhook({
        rawBody,
        signatureHeader: signature,
        webhookSecret: deps.webhookSecret,
      });
      const payloadHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawBody));
      const payloadHashHex = [...new Uint8Array(payloadHash)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      const inserted =
        deps.recordEvent === undefined
          ? true
          : await deps.recordEvent({
              eventId: verified.eventId,
              eventType: verified.eventType,
              livemode: verified.livemode,
              payloadHash: payloadHashHex,
            });
      if (!inserted) {
        return context.json(safeSuccess(context, { duplicate: true, acknowledged: true }), 200);
      }

      const requestId = normalizeRequestId(context.get('requestId'));
      const sideEffects =
        deps.settleEvent === undefined ? null : await deps.settleEvent({ verified, requestId });
      const settlement =
        sideEffects?.settlement ?? settleStripeWebhookEvent({ verified, requestId });

      return context.json(
        safeSuccess(context, {
          acknowledged: true,
          event_type: verified.eventType,
          settlement_kind: settlement.kind,
          wallet_credit_micros:
            settlement.kind === 'wallet_credit'
              ? settlement.plan.walletCreditMicros.toString()
              : null,
          persisted: sideEffects?.persisted ?? false,
          email_status: sideEffects?.emailStatus ?? 'not_requested',
        }),
        200,
      );
    } catch (error) {
      if (error instanceof StripeWebhookVerificationError) {
        return context.json(safeError(context, 'VALIDATION_ERROR', error.message), 400);
      }
      throw error;
    }
  });

  return route;
}
