import { describe, expect, it } from 'vitest';

import { ProviderError } from './errors';
import { falWebhookFailureCode, providerErrorCodeFromFailure } from './webhook';

describe('fal webhook failure codes', () => {
  it('keeps a short machine code from the error field', () => {
    expect(falWebhookFailureCode({ status: 'ERROR', error: 'content_policy_violation' })).toBe(
      'content_policy_violation',
    );
  });

  it('ignores long free-text errors that could carry prompts or URLs', () => {
    expect(
      falWebhookFailureCode({
        status: 'FAILED',
        error: 'https://fal.example/jobs/abc rejected because the prompt mentioned sleep',
      }),
    ).toBe('fal_webhook_failed');
  });

  it('reads a nested type without storing the rest of the payload', () => {
    expect(
      falWebhookFailureCode({
        status: 'ERROR',
        payload: { error: { type: 'image_too_small' } },
      }),
    ).toBe('image_too_small');
  });

  it('defaults a fixture ProviderError without details to fal_webhook_failed', () => {
    expect(
      providerErrorCodeFromFailure(new ProviderError('provider_error', 'fixture failure', false)),
    ).toBe('fal_webhook_failed');
  });
});
