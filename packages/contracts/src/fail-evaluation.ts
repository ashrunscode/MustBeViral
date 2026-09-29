/**
 * Same-UTC-day waiting is not a safety control. A new confirm after a failed or partial pack is
 * allowed only when a recorded evaluation names the cause and the single change being proven.
 * Blind retry of the same prompt remains forbidden.
 *
 * After an image policy fail, the next paid confirm is a one-master probe, not a full launch pack.
 */
export const launchPackFailKinds = [
  'content_policy_violation',
  'http_422',
  'fal_webhook_failed',
  'timeout',
  'ambiguous',
  'other',
] as const;

export type LaunchPackFailKind = (typeof launchPackFailKinds)[number];

export type LaunchPackNextSpend = 'failed_image_probe' | 'full_pack';

export interface LaunchPackFailEvaluation {
  readonly failedRunId: string;
  readonly kind: LaunchPackFailKind;
  readonly cause: string;
  readonly oneChange: string;
  readonly changeDeployed: boolean;
  readonly bannedConceptStillInImagePrompt: boolean;
  readonly imageProbeSucceeded: boolean;
  readonly retryDecision: 'retry' | 'stop';
}

export interface LaunchPackRetryDecision {
  readonly allowed: boolean;
  readonly reason:
    | 'evaluated_retry'
    | 'no_fail_evaluation'
    | 'evaluation_incomplete'
    | 'evaluation_stop'
    | 'change_not_deployed'
    | 'same_banned_image_prompt'
    | 'full_pack_blocked_until_image_probe';
  readonly nextSpend: LaunchPackNextSpend | null;
}

function isImagePolicyKind(kind: LaunchPackFailKind): boolean {
  return kind === 'content_policy_violation' || kind === 'fal_webhook_failed';
}

export function impliedNextSpend(evaluation: LaunchPackFailEvaluation): LaunchPackNextSpend | null {
  if (evaluation.retryDecision === 'stop') return null;
  if (isImagePolicyKind(evaluation.kind) && !evaluation.imageProbeSucceeded) {
    return 'failed_image_probe';
  }
  return 'full_pack';
}

const PROVIDER_ERROR_CODE = /^[A-Za-z0-9_.-]{1,80}$/u;

export interface RunFailureRecoveryCopy {
  readonly kind: LaunchPackFailKind;
  readonly title: string;
  readonly whatFailed: string;
  readonly spend: string;
  readonly retained: string;
  readonly nextAction: string;
  readonly attemptDetail: string;
}

export function classifyProviderErrorCode(code: string | undefined): LaunchPackFailKind {
  if (code === undefined || !PROVIDER_ERROR_CODE.test(code)) return 'other';
  if (code === 'content_policy_violation') return 'content_policy_violation';
  if (code === 'http_422') return 'http_422';
  if (code === 'fal_webhook_failed') return 'fal_webhook_failed';
  if (code === 'timeout' || code === 'provider_timeout') return 'timeout';
  if (code === 'ambiguous' || code === 'ambiguous_submit' || code === 'reconciliation_required') {
    return 'ambiguous';
  }
  return 'other';
}

export function runFailureRecoveryCopyForKind(kind: LaunchPackFailKind): RunFailureRecoveryCopy {
  if (kind === 'content_policy_violation') {
    return {
      kind,
      title: 'Image blocked',
      whatFailed: 'The image provider blocked this branch as a content-policy violation.',
      spend: 'No charge was accepted for the blocked attempt.',
      retained: 'Completed branches stay reviewable. This branch produced no image.',
      nextAction:
        'Edit the brief or visual direction, then request a new quote. Do not resubmit the same prompt.',
      attemptDetail: 'Image blocked by content policy. No charge accepted.',
    };
  }
  if (kind === 'http_422' || kind === 'fal_webhook_failed') {
    return {
      kind,
      title: 'Image request rejected',
      whatFailed: 'The image provider rejected this branch before a verified artifact existed.',
      spend: 'No charge was accepted for the rejected attempt.',
      retained: 'Completed branches stay reviewable. This branch produced no image.',
      nextAction:
        'Edit the brief or visual direction, then request a new quote. Do not resubmit the same prompt.',
      attemptDetail: 'Image request rejected. No charge accepted.',
    };
  }
  if (kind === 'timeout') {
    return {
      kind,
      title: 'This branch timed out',
      whatFailed: 'The provider did not finish this branch in time.',
      spend: 'Open the receipt to see captured versus released amount.',
      retained: 'Completed branches stay reviewable.',
      nextAction: 'Wait for reconciliation before quoting again. Do not retry the same run.',
      attemptDetail: 'Provider timed out. Check the receipt for spend.',
    };
  }
  if (kind === 'ambiguous') {
    return {
      kind,
      title: 'This branch needs reconciliation',
      whatFailed: 'Provider status is unconfirmed. Blind retry is blocked.',
      spend: 'Open the receipt before assuming a charge or a release.',
      retained: 'Completed branches stay reviewable.',
      nextAction: 'Wait for operator reconciliation. Do not submit the same prompt again.',
      attemptDetail: 'Provider status is unconfirmed. Do not retry yet.',
    };
  }
  return {
    kind,
    title: 'This branch failed',
    whatFailed: 'This branch did not produce a verified output.',
    spend: 'Open the receipt to see captured versus released amount.',
    retained: 'Completed branches stay reviewable.',
    nextAction:
      'If the image was blocked, edit the brief or visual direction before quoting again. Do not retry blindly.',
    attemptDetail: 'Provider output failed. Check the receipt for spend.',
  };
}

export function runFailureRecoveryCopy(code?: string): RunFailureRecoveryCopy {
  return runFailureRecoveryCopyForKind(classifyProviderErrorCode(code));
}

export function launchPackRetryDecision(
  evaluation: LaunchPackFailEvaluation | null,
  requestedSpend?: LaunchPackNextSpend,
): LaunchPackRetryDecision {
  if (evaluation === null) {
    return { allowed: false, reason: 'no_fail_evaluation', nextSpend: null };
  }
  if (evaluation.retryDecision === 'stop') {
    return { allowed: false, reason: 'evaluation_stop', nextSpend: null };
  }
  if (evaluation.cause.trim().length === 0 || evaluation.oneChange.trim().length === 0) {
    return { allowed: false, reason: 'evaluation_incomplete', nextSpend: null };
  }
  if (!evaluation.changeDeployed) {
    return {
      allowed: false,
      reason: 'change_not_deployed',
      nextSpend: impliedNextSpend(evaluation),
    };
  }
  if (isImagePolicyKind(evaluation.kind) && evaluation.bannedConceptStillInImagePrompt) {
    return { allowed: false, reason: 'same_banned_image_prompt', nextSpend: 'failed_image_probe' };
  }
  const nextSpend = impliedNextSpend(evaluation);
  const requested = requestedSpend ?? nextSpend;
  if (nextSpend === 'failed_image_probe' && requested === 'full_pack') {
    return { allowed: false, reason: 'full_pack_blocked_until_image_probe', nextSpend };
  }
  return { allowed: true, reason: 'evaluated_retry', nextSpend };
}
