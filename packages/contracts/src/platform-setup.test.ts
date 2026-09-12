import { describe, expect, it, vi } from 'vitest';
import { createPlatformHandlers, PLATFORM_OPERATIONS, type PlatformPort } from './platform';

const context = { actor_id: 'a4000000-0000-4000-8000-000000000001', request_id: 'setup-test' };
const studio = 'b4000000-0000-4000-8000-000000000001';
const identity = { workspace_id: studio, brand_id: context.actor_id };
const input = {
  ...identity,
  expected_version: 1,
  website_url: '',
  description: '',
  audience: '',
  goals: '',
  current_step: 'identity',
};

describe('saved setup contracts', () => {
  it.each([
    { website_url: 'javascript:alert(1)' },
    { website_url: 'https://user:pass@example.test' },
    { website_url: ' https://example.test' },
    { website_url: 'https://example.test/has space' },
    { website_url: 'not a website' },
    { description: 'x'.repeat(2001) },
    { current_step: 'approved' },
    { expected_version: 0 },
    { approved: true },
    { created_by: studio },
  ])('rejects invalid draft values before persistence: %s', async (invalid) => {
    const execute = vi.fn<PlatformPort['execute']>();
    expect(
      await createPlatformHandlers({ execute }).execute(
        'save_brand_draft',
        { ...input, ...invalid },
        context,
        'key',
      ),
    ).toEqual({ status: 'error', code: 'VALIDATION_FAILED' });
    expect(execute).not.toHaveBeenCalled();
  });
  it('accepts manual entry without a website and keeps progress as unapproved operator input', () => {
    expect(PLATFORM_OPERATIONS.save_brand_draft.input.parse(input)).toEqual(input);
  });
  it.each(['Person@example.test', ' person@example.test', 'invalid', 'person@example.test '])(
    'requires exact normalized recipient %s',
    (recipient_email) => {
      expect(
        PLATFORM_OPERATIONS.create_studio_invitation.input.safeParse({
          studio_id: studio,
          expected_version: 1,
          recipient_email,
          role: 'editor',
        }).success,
      ).toBe(false);
    },
  );
  it('does not expose an owner role invitation or accept arbitrary target users', () => {
    expect(
      PLATFORM_OPERATIONS.create_studio_invitation.input.safeParse({
        studio_id: studio,
        expected_version: 1,
        recipient_email: 'person@example.test',
        role: 'owner',
      }).success,
    ).toBe(false);
    expect(
      PLATFORM_OPERATIONS.accept_studio_invitation.input.safeParse({
        invitation_id: studio,
        expected_version: 1,
        user_id: studio,
      }).success,
    ).toBe(false);
  });
  it('keeps presentation queries in the shared registry and fails closed when unavailable', async () => {
    expect(PLATFORM_OPERATIONS.get_studio_access.rpc).toBe('platform_presentation');
    expect(PLATFORM_OPERATIONS.list_brand_studios.rpc).toBe('platform_presentation');
    expect(PLATFORM_OPERATIONS.list_studio_team.rpc).toBe('platform_presentation');
    expect(
      PLATFORM_OPERATIONS.get_studio_access.input.safeParse({ studio_id: studio }).success,
    ).toBe(true);
    expect(
      PLATFORM_OPERATIONS.list_brand_studios.input.safeParse({
        workspace_id: studio,
        brand_id: context.actor_id,
        limit: 101,
      }).success,
    ).toBe(false);
    expect(
      PLATFORM_OPERATIONS.list_studio_team.output.safeParse({
        items: [
          {
            id: studio,
            studio_id: studio,
            user_id: context.actor_id,
            role: 'owner',
            status: 'active',
            version: 1,
            created_at: '2026-09-10T20:00:00.000Z',
            revoked_at: null,
          },
        ],
        next_cursor: null,
      }).success,
    ).toBe(false);
    expect(
      await createPlatformHandlers({
        execute: async () => {
          throw new Error('unavailable');
        },
      }).execute('get_studio_access', { studio_id: studio }, context),
    ).toEqual({ status: 'error', code: 'INTERNAL_ERROR' });
    expect(
      await createPlatformHandlers({
        execute: async () => {
          throw new Error('unavailable');
        },
      }).execute('list_brand_studios', identity, context),
    ).toEqual({ status: 'error', code: 'INTERNAL_ERROR' });
  });
  it('keeps billing micros on the wire as decimal strings and fails closed', async () => {
    expect(PLATFORM_OPERATIONS.get_workspace_billing.rpc).toBe('platform_billing');
    expect(
      PLATFORM_OPERATIONS.get_workspace_billing.output.safeParse({
        workspace_id: studio,
        profile_present: true,
        charging_enabled: false,
        subscription_status: 'active',
        wallet_balance_micros: 250000000,
        ledger_wallet_available_micros: '250000000',
        usage_expense_micros: '0',
        balances_match: true,
      }).success,
    ).toBe(false);
    expect(
      PLATFORM_OPERATIONS.get_workspace_billing.output.parse({
        workspace_id: studio,
        profile_present: false,
        charging_enabled: false,
        subscription_status: null,
        wallet_balance_micros: null,
        ledger_wallet_available_micros: '0',
        usage_expense_micros: '0',
        balances_match: null,
      }).profile_present,
    ).toBe(false);
    expect(
      await createPlatformHandlers({
        execute: async () => {
          throw new Error('unavailable');
        },
      }).execute('get_workspace_billing', { workspace_id: studio }, context),
    ).toEqual({ status: 'error', code: 'INTERNAL_ERROR' });
  });
  it('preserves a missing draft as null but fails closed on unavailable database', async () => {
    expect(
      await createPlatformHandlers({
        execute: async () => ({ status: 'ok', data: { record: null } }),
      }).execute('get_brand_draft', identity, context),
    ).toEqual({ status: 'ok', data: { record: null } });
    expect(
      await createPlatformHandlers({
        execute: async () => {
          throw new Error('unavailable');
        },
      }).execute('get_brand_draft', identity, context),
    ).toEqual({ status: 'error', code: 'INTERNAL_ERROR' });
  });
});
