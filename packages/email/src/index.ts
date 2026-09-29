export type EmailDeliveryStatus = 'disabled' | 'ready' | 'sent';

export interface TransactionalEmailInput {
  readonly resendApiKey?: string;
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export interface TransactionalEmailResult {
  readonly status: EmailDeliveryStatus;
  readonly id: string | null;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function validateTransactionalEmailInput(input: TransactionalEmailInput): void {
  if (!emailPattern.test(input.from)) throw new TypeError('from must be a valid email address');
  if (!emailPattern.test(input.to)) throw new TypeError('to must be a valid email address');
  if (input.subject.trim().length === 0) throw new TypeError('subject is required');
  if (input.text.trim().length === 0) throw new TypeError('text is required');
}

/**
 * Fail-closed Resend adapter. Without an API key the send path is disabled, not faked.
 */
export function sendTransactionalEmail(input: TransactionalEmailInput): TransactionalEmailResult {
  validateTransactionalEmailInput(input);
  if (input.resendApiKey === undefined || input.resendApiKey.length === 0) {
    return Object.freeze({ status: 'disabled', id: null });
  }
  return Object.freeze({ status: 'ready', id: null });
}
