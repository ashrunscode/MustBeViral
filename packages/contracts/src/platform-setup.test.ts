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
