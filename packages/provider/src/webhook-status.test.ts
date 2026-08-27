import { describe, expect, it } from 'vitest';

import { errorFromHttpStatus, ProviderError } from './errors';
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

  it('walks official fal ERROR detail arrays for the machine type', () => {
    expect(
      falWebhookFailureCode({
        status: 'ERROR',
        error: 'Invalid status code: 422',
        payload: {
          detail: [
            {
              loc: ['body', 'prompt'],
              msg: 'The content could not be processed because it contained material flagged by a content checker.',
              type: 'content_policy_violation',
              input: 'a prompt that must never be persisted as the error code',
            },
          ],
        },
      }),
    ).toBe('content_policy_violation');
  });

  it('reads a request-level error_type without storing the detail sentence', () => {
    expect(
      falWebhookFailureCode({
        status: 'ERROR',
        payload: { detail: 'Request timed out', error_type: 'request_timeout' },
      }),
    ).toBe('request_timeout');
  });

  it('maps a bare HTTP wrapper only when no machine type is present', () => {
    expect(
      falWebhookFailureCode({
        status: 'ERROR',
        error: 'Invalid status code: 422',
        payload: { detail: [] },
      }),
    ).toBe('http_422');
  });

  it('defaults a fixture ProviderError without details to fal_webhook_failed', () => {
    expect(
      providerErrorCodeFromFailure(new ProviderError('provider_error', 'fixture failure', false)),
    ).toBe('fal_webhook_failed');
  });

  it('sanitizes HTTP failures instead of retaining provider response bodies', () => {
    const error = errorFromHttpStatus(
      'fal',
      422,
      JSON.stringify({
        detail: [
          {
            type: 'content_policy_violation',
            msg: 'Rejected private customer prompt.',
            input: 'signed-url-or-customer-prompt',
          },
        ],
      }),
    );

    expect(error.details).toEqual({
      provider: 'fal',
      status: 422,
      provider_error_code: 'content_policy_violation',
    });
    expect(JSON.stringify(error.details)).not.toContain('private customer');
    expect(JSON.stringify(error.details)).not.toContain('signed-url');
  });
});
