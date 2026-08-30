import { describe, expect, it } from 'vitest';

import {
  classifyProviderErrorCode,
  launchPackRetryDecision,
  runFailureRecoveryCopy,
  type LaunchPackFailEvaluation,
} from './fail-evaluation';

const ready: LaunchPackFailEvaluation = {
  failedRunId: 'f5fa333f-df35-4ce8-99f2-90ee9a78b7c7',
  kind: 'content_policy_violation',
  cause: 'Image prompt named doctor/sleep/medical as negatives.',
  oneChange: 'imageSafeText on every image fragment; Worker 1c4b0b41.',
  changeDeployed: true,
  bannedConceptStillInImagePrompt: false,
  imageProbeSucceeded: false,
  retryDecision: 'retry',
};

describe('launchPackRetryDecision', () => {
  it('allows a same-day image probe when the fail is evaluated and the change is live', () => {
    expect(launchPackRetryDecision(ready)).toEqual({
      allowed: true,
      reason: 'evaluated_retry',
      nextSpend: 'failed_image_probe',
    });
  });

  it('blocks a full pack until the failed image nodes have a succeeded probe', () => {
    expect(launchPackRetryDecision(ready, 'full_pack')).toEqual({
      allowed: false,
      reason: 'full_pack_blocked_until_image_probe',
      nextSpend: 'failed_image_probe',
    });
  });

  it('allows a full pack only after the image probe succeeded', () => {
    expect(launchPackRetryDecision({ ...ready, imageProbeSucceeded: true }, 'full_pack')).toEqual({
      allowed: true,
      reason: 'evaluated_retry',
      nextSpend: 'full_pack',
    });
  });

  it('refuses a retry with no evaluation', () => {
    expect(launchPackRetryDecision(null)).toEqual({
      allowed: false,
      reason: 'no_fail_evaluation',
      nextSpend: null,
    });
  });

  it('refuses a retry that would resubmit the banned image words', () => {
    expect(
      launchPackRetryDecision({
        ...ready,
        bannedConceptStillInImagePrompt: true,
      }),
    ).toEqual({
      allowed: false,
      reason: 'same_banned_image_prompt',
      nextSpend: 'failed_image_probe',
    });
  });

  it('refuses a retry before the named change is deployed', () => {
    expect(launchPackRetryDecision({ ...ready, changeDeployed: false })).toEqual({
      allowed: false,
      reason: 'change_not_deployed',
      nextSpend: 'failed_image_probe',
    });
  });

  it('maps content_policy_violation to customer-safe recovery copy', () => {
    const copy = runFailureRecoveryCopy('content_policy_violation');
    expect(copy.kind).toBe('content_policy_violation');
    expect(copy.title).toBe('Image blocked');
    expect(copy.spend).toMatch(/No charge was accepted/u);
    expect(copy.nextAction).toMatch(/Do not resubmit the same prompt/u);
    expect(copy.attemptDetail).not.toMatch(/fal|payload|prompt dump/iu);
  });

  it('treats an unknown or unsafe code as a generic failure', () => {
    expect(runFailureRecoveryCopy('not a code').kind).toBe('other');
    expect(runFailureRecoveryCopy().kind).toBe('other');
    expect(classifyProviderErrorCode('ambiguous_submit')).toBe('ambiguous');
  });

  it.each([
    ['content_policy_violation', 'content_policy_violation'],
    ['http_422', 'http_422'],
    ['fal_webhook_failed', 'fal_webhook_failed'],
    ['timeout', 'timeout'],
    ['provider_timeout', 'timeout'],
    ['ambiguous', 'ambiguous'],
    ['ambiguous_submit', 'ambiguous'],
    ['reconciliation_required', 'ambiguous'],
    ['unsafe code https://signed.example.test/object?token=secret', 'other'],
  ] as const)('maps %s to safe %s recovery copy', (code, kind) => {
    const copy = runFailureRecoveryCopy(code);
    expect(copy.kind).toBe(kind);
    expect(copy.title).not.toBe('');
    expect(copy.whatFailed).not.toMatch(/payload|signed url|token=|secret/iu);
    expect(copy.nextAction).not.toMatch(/payload|signed url|token=|secret/iu);
  });

  it('refuses an incomplete or stop evaluation', () => {
    expect(launchPackRetryDecision({ ...ready, cause: '   ' })).toEqual({
      allowed: false,
      reason: 'evaluation_incomplete',
      nextSpend: null,
    });
    expect(launchPackRetryDecision({ ...ready, retryDecision: 'stop' })).toEqual({
      allowed: false,
      reason: 'evaluation_stop',
      nextSpend: null,
    });
  });
});
