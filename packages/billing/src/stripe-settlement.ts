import { creditLedgerMovement, type LedgerMovementDraft } from './ledger';
import { usdMicros, type UsdMicros } from './money';
import type { SubscriptionStatus } from './entitlements';
import type { VerifiedStripeWebhook } from './stripe-webhook';

export type StripeSettlementEventType =
  | 'checkout.session.completed'
  | 'invoice.paid'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted';

const WALLET_CREDIT_EVENT_TYPES = new Set<StripeSettlementEventType>([
  'checkout.session.completed',
  'invoice.paid',
]);

export function isStripeWalletCreditEvent(
  eventType: string,
): eventType is Extract<StripeSettlementEventType, 'checkout.session.completed' | 'invoice.paid'> {
  return WALLET_CREDIT_EVENT_TYPES.has(eventType as StripeSettlementEventType);
}

function stripeCentsToMicros(cents: number): bigint {
  if (!Number.isFinite(cents) || cents <= 0) return 0n;
  return BigInt(Math.trunc(cents)) * 10_000n;
}

/**
 * Extracts integer USD micros from a verified Stripe webhook payload when the event funds the wallet.
 */
export function extractStripeWalletCreditMicros(
  payload: unknown,
  eventType: string,
): bigint | null {
  if (!isStripeWalletCreditEvent(eventType)) return null;
  if (typeof payload !== 'object' || payload === null) return null;

  const envelope = payload as Readonly<Record<string, unknown>>;
  const dataObject =
    typeof envelope.data === 'object' && envelope.data !== null
      ? (envelope.data as Readonly<Record<string, unknown>>).object
      : undefined;
  const object =
    typeof dataObject === 'object' && dataObject !== null
      ? (dataObject as Readonly<Record<string, unknown>>)
      : envelope;

  const cents =
    eventType === 'checkout.session.completed'
      ? object.amount_total
      : eventType === 'invoice.paid'
        ? object.amount_paid
        : undefined;
  if (typeof cents !== 'number') return null;
  const micros = stripeCentsToMicros(cents);
  return micros > 0n ? micros : null;
}

export interface StripeWalletCreditInput {
  readonly stripeEventId: string;
  readonly amountMicros: bigint;
  readonly eventType: StripeSettlementEventType;
  readonly requestId: string;
}

export interface StripeWalletCreditPlan {
  readonly movement: LedgerMovementDraft;
  readonly walletCreditMicros: UsdMicros;
  readonly eventType: StripeSettlementEventType;
}

const SETUP_FEE_MICROS = 500_000_000n;
const SUBSCRIPTION_MICROS = 149_000_000n;

export function planStripeWalletCredit(
  input: StripeWalletCreditInput,
): StripeWalletCreditPlan | null {
  if (input.amountMicros <= 0n) return null;

  const walletCreditMicros = usdMicros(input.amountMicros);
  const movement = creditLedgerMovement({
    amountMicros: walletCreditMicros,
    causativeKey: `stripe:${input.stripeEventId}`,
    requestId: input.requestId,
    metadata: {
      source: 'stripe_webhook',
      event_type: input.eventType,
      stripe_event_id: input.stripeEventId,
    },
  });

  return Object.freeze({
    movement,
    walletCreditMicros,
    eventType: input.eventType,
  });
}

export function defaultStripeCatalogAmounts(): Readonly<{
  setupFeeMicros: bigint;
  subscriptionMicros: bigint;
}> {
  return Object.freeze({
    setupFeeMicros: SETUP_FEE_MICROS,
    subscriptionMicros: SUBSCRIPTION_MICROS,
  });
}

const STRIPE_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  'none',
  'trialing',
  'active',
  'past_due',
  'canceled',
]);

export function parseStripeSubscriptionStatus(status: string): SubscriptionStatus {
  if (STRIPE_SUBSCRIPTION_STATUSES.has(status as SubscriptionStatus)) {
    return status as SubscriptionStatus;
  }
  if (status === 'incomplete' || status === 'incomplete_expired' || status === 'unpaid') {
    return 'past_due';
  }
  return 'none';
}

export interface StripeSubscriptionUpdateInput {
  readonly stripeEventId: string;
  readonly eventType: Extract<
    StripeSettlementEventType,
    | 'customer.subscription.created'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted'
  >;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly stripeCustomerId: string | null;
  readonly stripeSubscriptionId: string | null;
}

export interface StripeSubscriptionUpdatePlan {
  readonly kind: 'subscription_update';
  readonly eventType: StripeSubscriptionUpdateInput['eventType'];
  readonly subscriptionStatus: SubscriptionStatus;
  readonly stripeCustomerId: string | null;
  readonly stripeSubscriptionId: string | null;
  readonly setupFeePaid: boolean;
}

function stripeObject(payload: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const envelope = payload as Readonly<Record<string, unknown>>;
  const dataObject =
    typeof envelope.data === 'object' && envelope.data !== null
      ? (envelope.data as Readonly<Record<string, unknown>>).object
      : undefined;
  if (typeof dataObject === 'object' && dataObject !== null) {
    return dataObject as Readonly<Record<string, unknown>>;
  }
  return envelope;
}

function readStripeString(object: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = object[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function readStripeUuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null;
}

function readStripeMetadataWorkspaceId(object: Readonly<Record<string, unknown>>): string | null {
  const metadata = object.metadata;
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return null;
  return readStripeUuid((metadata as Readonly<Record<string, unknown>>).workspace_id);
}

/**
 * Resolves the MustBeViral workspace id from a verified Stripe webhook payload when present.
 */
export function extractStripeWorkspaceId(payload: unknown, eventType: string): string | null {
  void eventType;
  const object = stripeObject(payload);
  if (object === null) return null;

  const metadataWorkspaceId = readStripeMetadataWorkspaceId(object);
  if (metadataWorkspaceId !== null) return metadataWorkspaceId;

  const clientReferenceId = readStripeUuid(object.client_reference_id);
  if (clientReferenceId !== null) return clientReferenceId;

  return null;
}

/**
 * Reads the Stripe customer id from a verified webhook payload when present.
 */
export function extractStripeCustomerId(payload: unknown): string | null {
  const object = stripeObject(payload);
  if (object === null) return null;
  return readStripeString(object, 'customer');
}

export function planStripeSubscriptionUpdate(
  input: StripeSubscriptionUpdateInput,
): StripeSubscriptionUpdatePlan {
  const setupFeePaid =
    input.eventType === 'customer.subscription.created' &&
    (input.subscriptionStatus === 'active' || input.subscriptionStatus === 'trialing');
  return Object.freeze({
    kind: 'subscription_update',
    eventType: input.eventType,
    subscriptionStatus: input.subscriptionStatus,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    setupFeePaid,
  });
}

export interface StripeWalletCreditSettlementPlan {
  readonly kind: 'wallet_credit';
  readonly plan: StripeWalletCreditPlan;
}

export interface StripeSettlementIgnoredPlan {
  readonly kind: 'ignored';
  readonly eventType: string;
}

export type StripeSettlementPlan =
  StripeWalletCreditSettlementPlan | StripeSubscriptionUpdatePlan | StripeSettlementIgnoredPlan;

export function settleStripeWebhookEvent(
  input: Readonly<{
    verified: VerifiedStripeWebhook;
    requestId: string;
  }>,
): StripeSettlementPlan {
  const { verified, requestId } = input;
  const walletMicros = extractStripeWalletCreditMicros(verified.payload, verified.eventType);
  if (walletMicros !== null && isStripeWalletCreditEvent(verified.eventType)) {
    const plan = planStripeWalletCredit({
      stripeEventId: verified.eventId,
      amountMicros: walletMicros,
      eventType: verified.eventType,
      requestId,
    });
    if (plan === null) {
      return Object.freeze({ kind: 'ignored', eventType: verified.eventType });
    }
    return Object.freeze({ kind: 'wallet_credit', plan });
  }

  if (
    verified.eventType === 'customer.subscription.created' ||
    verified.eventType === 'customer.subscription.updated' ||
    verified.eventType === 'customer.subscription.deleted'
  ) {
    const object = stripeObject(verified.payload);
    const rawStatus =
      verified.eventType === 'customer.subscription.deleted'
        ? 'canceled'
        : (readStripeString(object ?? {}, 'status') ?? 'none');
    return planStripeSubscriptionUpdate({
      stripeEventId: verified.eventId,
      eventType: verified.eventType,
      subscriptionStatus: parseStripeSubscriptionStatus(rawStatus),
      stripeCustomerId: readStripeString(object ?? {}, 'customer'),
      stripeSubscriptionId: readStripeString(object ?? {}, 'id'),
    });
  }

  return Object.freeze({ kind: 'ignored', eventType: verified.eventType });
}
