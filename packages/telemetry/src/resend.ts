export interface ResendConfig {
  readonly apiKey: string | undefined;
  readonly fromAddress: string | undefined;
}

export interface ResendEmailInput {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
}

export class ResendUnavailableError extends Error {
  override readonly name = 'ResendUnavailableError';
}

export async function sendResendEmail(
  config: ResendConfig,
  input: ResendEmailInput,
  fetchImplementation: typeof fetch = fetch,
): Promise<void> {
  if (config.apiKey === undefined || config.apiKey.length === 0) {
    throw new ResendUnavailableError('Resend API key is not configured.');
  }
  if (config.fromAddress === undefined || config.fromAddress.length === 0) {
    throw new ResendUnavailableError('Resend from address is not configured.');
  }

  let response: Response;
  try {
    response = await fetchImplementation('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.fromAddress,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });
  } catch (cause) {
    const error = new ResendUnavailableError('Resend transport failed.');
    if (cause instanceof Error) error.cause = cause;
    throw error;
  }

  if (!response.ok) {
    throw new ResendUnavailableError('Resend rejected the send request.');
  }
}
