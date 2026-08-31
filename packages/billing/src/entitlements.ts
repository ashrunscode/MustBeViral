export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled';

export interface BillingEntitlementsSnapshot {
  readonly chargingEnabled: boolean;
  readonly generationEnabled: boolean;
  readonly providerRoutesEnabled: boolean;
  readonly walletBalanceMicros: bigint;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly setupFeePaid: boolean;
}

export type BillingEntitlementBlockReason =
  | 'charging_disabled'
  | 'generation_disabled'
  | 'provider_routes_disabled'
  | 'setup_fee_unpaid'
  | 'subscription_inactive'
  | 'insufficient_wallet';

export interface BillingEntitlementOk {
  readonly status: 'ok';
}

export interface BillingEntitlementBlocked {
  readonly status: 'blocked';
  readonly reason: BillingEntitlementBlockReason;
}

export type BillingEntitlementResult = BillingEntitlementOk | BillingEntitlementBlocked;

export const DEFAULT_BILLING_ENTITLEMENTS: BillingEntitlementsSnapshot = Object.freeze({
  chargingEnabled: false,
  generationEnabled: true,
  providerRoutesEnabled: true,
  walletBalanceMicros: 0n,
  subscriptionStatus: 'none',
  setupFeePaid: false,
});

export function evaluateQuoteEntitlements(
  snapshot: BillingEntitlementsSnapshot,
  maximumChargeMicros: bigint,
): BillingEntitlementResult {
  if (!snapshot.generationEnabled) {
    return { status: 'blocked', reason: 'generation_disabled' };
  }
  if (!snapshot.chargingEnabled) {
    return { status: 'ok' };
  }
  if (!snapshot.setupFeePaid) {
    return { status: 'blocked', reason: 'setup_fee_unpaid' };
  }
  if (snapshot.subscriptionStatus !== 'active' && snapshot.subscriptionStatus !== 'trialing') {
    return { status: 'blocked', reason: 'subscription_inactive' };
  }
  if (snapshot.walletBalanceMicros < maximumChargeMicros) {
    return { status: 'blocked', reason: 'insufficient_wallet' };
  }
  return { status: 'ok' };
}

export function evaluateStartRunEntitlements(
  snapshot: BillingEntitlementsSnapshot,
  maximumChargeMicros: bigint,
): BillingEntitlementResult {
  if (!snapshot.generationEnabled) {
    return { status: 'blocked', reason: 'generation_disabled' };
  }
  if (!snapshot.providerRoutesEnabled) {
    return { status: 'blocked', reason: 'provider_routes_disabled' };
  }
  if (!snapshot.chargingEnabled) {
    return { status: 'ok' };
  }
  return evaluateQuoteEntitlements(snapshot, maximumChargeMicros);
}

export interface PlatformKillSwitchSnapshot {
  readonly signupsEnabled: boolean;
  readonly generationEnabled: boolean;
  readonly providerRoutesEnabled: boolean;
  readonly chargingEnabled: boolean;
}

export interface WorkspaceBillingProfileSnapshot {
  readonly walletBalanceMicros: bigint;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly setupFeePaid: boolean;
}

export function buildBillingEntitlementsSnapshot(
  killSwitches: PlatformKillSwitchSnapshot,
  profile: WorkspaceBillingProfileSnapshot | null,
): BillingEntitlementsSnapshot {
  const walletBalanceMicros = profile?.walletBalanceMicros ?? 0n;
  const subscriptionStatus = profile?.subscriptionStatus ?? 'none';
  const setupFeePaid = profile?.setupFeePaid ?? false;
  return Object.freeze({
    chargingEnabled: killSwitches.chargingEnabled,
    generationEnabled: killSwitches.generationEnabled,
    providerRoutesEnabled: killSwitches.providerRoutesEnabled,
    walletBalanceMicros,
    subscriptionStatus,
    setupFeePaid,
  });
}
