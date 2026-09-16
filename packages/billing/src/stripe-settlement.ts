import { creditLedgerMovement, type LedgerMovementDraft } from './ledger';
import { usdMicros, type UsdMicros } from './money';
import type { SubscriptionStatus } from './entitlements';
import type { VerifiedStripeWebhook } from './stripe-webhook';

export type StripeSettlementEventType =
  | 'checkout.session.completed'
  | 'checkout.session.async_payment_succeeded'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted';

export type StripeWalletCreditEventType = Extract<
  StripeSettlementEventType,
  'checkout.session.completed' | 'checkout.session.async_payment_succeeded'
>;

/**
 * Checkout Session `metadata.purpose` that marks a prepaid usage wallet top-up. Only a paid
 * payment-mode Checkout Session carrying this marker funds the wallet (ADR-0007). The setup fee,
 * subscription invoices and every other payment never do.
 */
export const STRIPE_WALLET_TOP_UP_PURPOSE = 'wallet_top_up';

const WALLET_CREDIT_EVENT_TYPES = new Set<string>([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
]);

export function isStripeWalletCreditEvent(
  eventType: string,
): eventType is StripeWalletCreditEventType {
  return WALLET_CREDIT_EVENT_TYPES.has(eventType);
}

/** One wallet credit per Checkout Session, whichever event or redelivery settles it first. */
export function stripeWalletCreditCausativeKey(checkoutSessionId: string): string {
  return `stripe:checkout_session:${checkoutSessionId}`;
}

/**
 * Stripe may change object id prefixes and lengths (docs.stripe.com/upgrades), so a Checkout
 * Session id is checked by character set only. Its causative key must fit the ledger's
 * 240-character limit, which leaves 216 characters for the id.
 */
const CHECKOUT_SESSION_ID_PATTERN = /^[A-Za-z0-9_]{1,216}$/u;
const STRIPE_CENTS_TO_MICROS = 10_000n;

export type StripeWalletTopUpIgnoredReason =
  'not_wallet_top_up' | 'payment_pending' | 'no_payment_required';

export type StripeWalletTopUpRejectedReason =
  | 'payment_not_paid'
  | 'invalid_checkout_session_id'
  | 'unsupported_currency'
  | 'invalid_amount'
  | 'missing_workspace_id'
  | 'invalid_workspace_id'
  | 'conflicting_workspace_ids';

export type StripeWalletTopUp =
  | Readonly<{
      kind: 'paid';
      checkoutSessionId: string;
      workspaceId: string;
      amountMicros: bigint;
    }>
  | Readonly<{ kind: 'ignored'; reason: StripeWalletTopUpIgnoredReason }>
  | Readonly<{ kind: 'rejected'; reason: StripeWalletTopUpRejectedReason }>;

/**
 * Reads a wallet top-up from a verified `checkout.session.*` payload. Returns null for event types
 * that never fund the wallet.
 *
 * A session that is not a marked payment-mode top-up, or whose payment has not settled yet, is
 * ignored. A marked top-up that Stripe reports as paid but that cannot be credited exactly is
 * rejected: money was received, so settlement must fail loudly rather than acknowledge it.
 */
export function readStripeWalletTopUp(
  payload: unknown,
  eventType: string,
): StripeWalletTopUp | null {
  if (!isStripeWalletCreditEvent(eventType)) return null;
  const session = stripeObject(payload) ?? {};

  if (
    session.mode !== 'payment' ||
    readStripeMetadata(session).purpose !== STRIPE_WALLET_TOP_UP_PURPOSE
  ) {
    return Object.freeze({ kind: 'ignored', reason: 'not_wallet_top_up' });
  }

  if (session.payment_status !== 'paid') {
    if (eventType === 'checkout.session.completed' && session.payment_status === 'unpaid') {
      return Object.freeze({ kind: 'ignored', reason: 'payment_pending' });
    }
    if (
      eventType === 'checkout.session.completed' &&
      session.payment_status === 'no_payment_required'
    ) {
      return Object.freeze({ kind: 'ignored', reason: 'no_payment_required' });
    }
    return Object.freeze({ kind: 'rejected', reason: 'payment_not_paid' });
  }

  const checkoutSessionId = session.id;
  if (
    typeof checkoutSessionId !== 'string' ||
    !CHECKOUT_SESSION_ID_PATTERN.test(checkoutSessionId)
  ) {
    return Object.freeze({ kind: 'rejected', reason: 'invalid_checkout_session_id' });
  }
  if (session.currency !== 'usd') {
    return Object.freeze({ kind: 'rejected', reason: 'unsupported_currency' });
  }
  const amountCents = session.amount_total;
  if (typeof amountCents !== 'number' || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return Object.freeze({ kind: 'rejected', reason: 'invalid_amount' });
  }

  // Our server sets both fields on a top-up. Either one names the workspace, but a value that is
  // present must be a workspace id and the two must agree.
  const rawMetadataWorkspaceId = readStripeMetadata(session).workspace_id;
  const rawReferenceWorkspaceId = session.client_reference_id;
  const metadataWorkspaceId = readStripeUuid(rawMetadataWorkspaceId);
  const referenceWorkspaceId = readStripeUuid(rawReferenceWorkspaceId);
  if (
    (rawMetadataWorkspaceId != null && metadataWorkspaceId === null) ||
    (rawReferenceWorkspaceId != null && referenceWorkspaceId === null)
  ) {
    return Object.freeze({ kind: 'rejected', reason: 'invalid_workspace_id' });
  }
  if (
    metadataWorkspaceId !== null &&
    referenceWorkspaceId !== null &&
    metadataWorkspaceId.toLowerCase() !== referenceWorkspaceId.toLowerCase()
  ) {
    return Object.freeze({ kind: 'rejected', reason: 'conflicting_workspace_ids' });
  }
  const workspaceId = metadataWorkspaceId ?? referenceWorkspaceId;
  if (workspaceId === null) {
    return Object.freeze({ kind: 'rejected', reason: 'missing_workspace_id' });
  }

  return Object.freeze({
    kind: 'paid',
    checkoutSessionId,
    workspaceId,
    amountMicros: BigInt(amountCents) * STRIPE_CENTS_TO_MICROS,
  });
}

export interface StripeWalletCreditInput {
  readonly stripeEventId: string;
  readonly stripeCheckoutSessionId: string;
  readonly workspaceId: string;
  readonly amountMicros: bigint;
  readonly eventType: StripeWalletCreditEventType;
  readonly requestId: string;
}

export interface StripeWalletCreditPlan {
  readonly movement: LedgerMovementDraft;
  readonly walletCreditMicros: UsdMicros;
  readonly eventType: StripeWalletCreditEventType;
  readonly checkoutSessionId: string;
  readonly workspaceId: string;
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
    causativeKey: stripeWalletCreditCausativeKey(input.stripeCheckoutSessionId),
    requestId: input.requestId,
    metadata: {
      source: 'stripe_webhook',
      event_type: input.eventType,
      stripe_event_id: input.stripeEventId,
      stripe_checkout_session_id: input.stripeCheckoutSessionId,
    },
  });

  return Object.freeze({
    movement,
    walletCreditMicros,
    eventType: input.eventType,
    checkoutSessionId: input.stripeCheckoutSessionId,
    workspaceId: input.workspaceId,
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

function readStripeMetadata(
  object: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const metadata = object.metadata;
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return {};
  return metadata as Readonly<Record<string, unknown>>;
}

function readStripeMetadataWorkspaceId(object: Readonly<Record<string, unknown>>): string | null {
  return readStripeUuid(readStripeMetadata(object).workspace_id);
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

export type StripeSettlementIgnoredReason =
  'unsupported_event_type' | StripeWalletTopUpIgnoredReason;

export interface StripeSettlementIgnoredPlan {
  readonly kind: 'ignored';
  readonly eventType: string;
  readonly reason: StripeSettlementIgnoredReason;
}

/** A paid wallet top-up that cannot be credited. Settlement must fail so Stripe retries. */
export interface StripeSettlementRejectedPlan {
  readonly kind: 'rejected';
  readonly eventType: StripeWalletCreditEventType;
  readonly reason: StripeWalletTopUpRejectedReason;
}

export type StripeSettlementPlan =
  | StripeWalletCreditSettlementPlan
  | StripeSubscriptionUpdatePlan
  | StripeSettlementIgnoredPlan
  | StripeSettlementRejectedPlan;

export function settleStripeWebhookEvent(
  input: Readonly<{
    verified: VerifiedStripeWebhook;
    requestId: string;
  }>,
): StripeSettlementPlan {
  const { verified, requestId } = input;
  const eventType = verified.eventType;

  if (isStripeWalletCreditEvent(eventType)) {
    const topUp = readStripeWalletTopUp(verified.payload, eventType);
    if (topUp === null || topUp.kind === 'ignored') {
      return Object.freeze({
        kind: 'ignored',
        eventType,
        reason: topUp?.reason ?? 'unsupported_event_type',
      });
    }
    if (topUp.kind === 'rejected') {
      return Object.freeze({ kind: 'rejected', eventType, reason: topUp.reason });
    }
    const plan = planStripeWalletCredit({
      stripeEventId: verified.eventId,
      stripeCheckoutSessionId: topUp.checkoutSessionId,
      workspaceId: topUp.workspaceId,
      amountMicros: topUp.amountMicros,
      eventType,
      requestId,
    });
    if (plan === null) {
      return Object.freeze({ kind: 'rejected', eventType, reason: 'invalid_amount' });
    }
    return Object.freeze({ kind: 'wallet_credit', plan });
  }

  if (
    eventType === 'customer.subscription.created' ||
    eventType === 'customer.subscription.updated' ||
    eventType === 'customer.subscription.deleted'
  ) {
    const object = stripeObject(verified.payload);
    const rawStatus =
      eventType === 'customer.subscription.deleted'
        ? 'canceled'
        : (readStripeString(object ?? {}, 'status') ?? 'none');
    return planStripeSubscriptionUpdate({
      stripeEventId: verified.eventId,
      eventType,
      subscriptionStatus: parseStripeSubscriptionStatus(rawStatus),
      stripeCustomerId: readStripeString(object ?? {}, 'customer'),
      stripeSubscriptionId: readStripeString(object ?? {}, 'id'),
    });
  }

  return Object.freeze({ kind: 'ignored', eventType, reason: 'unsupported_event_type' });
}
