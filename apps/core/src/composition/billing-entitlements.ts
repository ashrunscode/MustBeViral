import {
  buildBillingEntitlementsSnapshot,
  type BillingEntitlementsSnapshot,
  type SubscriptionStatus,
  type WorkspaceBillingProfileSnapshot,
} from '@mustbeviral/billing';

import type { CoreBindings } from '../bindings';
import { createKillSwitchPort } from './kill-switches';

type BillingEntitlementBindings = Pick<
  CoreBindings,
  'SUPABASE_URL' | 'SUPABASE_SECRET_KEY' | 'SUPABASE_SERVICE_ROLE_KEY'
>;

function isBillingProfileRow(value: unknown): value is Readonly<{
  wallet_balance_micros: number;
  subscription_status: string;
  setup_fee_paid_at: string | null;
}> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Readonly<Record<string, unknown>>).wallet_balance_micros === 'number'
  );
}

function subscriptionStatus(value: string): SubscriptionStatus {
  if (
    value === 'none' ||
    value === 'trialing' ||
    value === 'active' ||
    value === 'past_due' ||
    value === 'canceled'
  ) {
    return value;
  }
  return 'none';
}

export function createBillingEntitlementsPort(
  bindings: BillingEntitlementBindings,
  fetchImplementation?: typeof fetch,
): Readonly<{
  getForWorkspace(
    workspaceId: string,
    walletBalanceMicros: bigint,
  ): Promise<BillingEntitlementsSnapshot>;
}> {
  const killSwitches = createKillSwitchPort(bindings, fetchImplementation);
  const baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
  const privilegedKey = bindings.SUPABASE_SECRET_KEY ?? bindings.SUPABASE_SERVICE_ROLE_KEY;
  const boundFetch = fetchImplementation ?? ((input, init) => fetch(input, init));

  return Object.freeze({
    async getForWorkspace(workspaceId, walletBalanceMicros) {
      const switches = await killSwitches.get();
      let profile: WorkspaceBillingProfileSnapshot | null = null;

      if (baseUrl && privilegedKey) {
        try {
          const response = await boundFetch(
            `${baseUrl}/rest/v1/workspace_billing_profiles?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=wallet_balance_micros,subscription_status,setup_fee_paid_at&limit=1`,
            {
              method: 'GET',
              headers: {
                accept: 'application/json',
                apikey: privilegedKey,
                authorization: `Bearer ${privilegedKey}`,
              },
            },
          );
          if (response.ok) {
            const rows = (await response.json()) as unknown;
            if (Array.isArray(rows) && rows.length > 0 && isBillingProfileRow(rows[0])) {
              const row = rows[0];
              profile = Object.freeze({
                walletBalanceMicros: BigInt(row.wallet_balance_micros),
                subscriptionStatus: subscriptionStatus(row.subscription_status),
                setupFeePaid: row.setup_fee_paid_at !== null,
              });
            }
          }
        } catch {
          profile = null;
        }
      }

      const snapshot = buildBillingEntitlementsSnapshot(switches, profile);
      if (walletBalanceMicros > 0n) {
        return Object.freeze({
          ...snapshot,
          walletBalanceMicros,
        });
      }
      return snapshot;
    },
  });
}
