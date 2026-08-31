import { sendResendEmail } from '@mustbeviral/telemetry';

import type { CoreBindings } from '../bindings';

export type CoreEmailDeliveryStatus = 'disabled' | 'sent';

export interface CoreTransactionalEmailInput {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export function createCoreEmailPort(
  bindings: CoreBindings,
  fetchImplementation?: typeof fetch,
): Readonly<{
  send(input: CoreTransactionalEmailInput): Promise<CoreEmailDeliveryStatus>;
}> {
  return Object.freeze({
    async send(input) {
      if (
        bindings.RESEND_API_KEY === undefined ||
        bindings.RESEND_API_KEY.length === 0 ||
        bindings.RESEND_FROM_ADDRESS === undefined ||
        bindings.RESEND_FROM_ADDRESS.length === 0
      ) {
        return 'disabled';
      }

      try {
        await sendResendEmail(
          {
            apiKey: bindings.RESEND_API_KEY,
            fromAddress: bindings.RESEND_FROM_ADDRESS,
          },
          {
            to: input.to,
            subject: input.subject,
            html: `<pre>${input.text.replace(/[<>&]/gu, (char) => {
              switch (char) {
                case '<':
                  return '&lt;';
                case '>':
                  return '&gt;';
                case '&':
                  return '&amp;';
                default:
                  return char;
              }
            })}</pre>`,
          },
          fetchImplementation,
        );
        return 'sent';
      } catch {
        return 'disabled';
      }
    },
  });
}
