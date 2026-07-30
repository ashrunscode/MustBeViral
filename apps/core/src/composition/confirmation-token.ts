import type { CoreBindings } from '../bindings';

/**
 * HMAC confirmation tokens for the paid-run consent gate.
 *
 * A token proves the server showed this actor this quote at this amount. It is minted with the
 * quote response and verified by start_run. Binding the actor means the person who confirms is the
 * person who was shown the price; binding the amount means a re-priced quote invalidates old
 * consent. The payload is canonical pipe-delimited text rather than JSON so there is no
 * field-reordering or parser ambiguity to equivocate on.
 */

const TOKEN_VERSION = 'confirm-v1';

export interface ConfirmationClaims {
  readonly quoteId: string;
  readonly workspaceId: string;
  readonly actorId: string;
  readonly maximumChargeMicros: bigint;
}

function canonicalPayload(claims: ConfirmationClaims): string {
  for (const [field, value] of Object.entries({
    quoteId: claims.quoteId,
    workspaceId: claims.workspaceId,
    actorId: claims.actorId,
  })) {
    if (value.length === 0 || value.includes('|')) {
      throw new RangeError(`Confirmation claim ${field} is empty or contains a delimiter`);
    }
  }
  return [
    TOKEN_VERSION,
    claims.quoteId,
    claims.workspaceId,
    claims.actorId,
    claims.maximumChargeMicros.toString(10),
  ].join('|');
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function base64Url(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const padded = text.replaceAll('-', '+').replaceAll('_', '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export class ConfirmationSigningUnavailableError extends Error {
  override readonly name = 'ConfirmationSigningUnavailableError';

  constructor() {
    super('Confirmation token signing is not configured');
  }
}

export async function mintConfirmationToken(
  bindings: Pick<CoreBindings, 'CONFIRMATION_SIGNING_KEY'>,
  claims: ConfirmationClaims,
): Promise<string> {
  const secret = bindings.CONFIRMATION_SIGNING_KEY;
  // Fail closed: without the key no quote can be confirmed, which stops spend rather than
  // permitting unproven consent.
  if (secret === undefined || secret.length < 32) {
    throw new ConfirmationSigningUnavailableError();
  }
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(canonicalPayload(claims)),
  );
  return `${TOKEN_VERSION}.${base64Url(signature)}`;
}

export async function verifyConfirmationToken(
  bindings: Pick<CoreBindings, 'CONFIRMATION_SIGNING_KEY'>,
  token: string,
  claims: ConfirmationClaims,
): Promise<boolean> {
  const secret = bindings.CONFIRMATION_SIGNING_KEY;
  if (secret === undefined || secret.length < 32) return false;
  const [version, encodedSignature, ...rest] = token.split('.');
  if (version !== TOKEN_VERSION || encodedSignature === undefined || rest.length > 0) return false;
  const signature = fromBase64Url(encodedSignature);
  if (signature === null || signature.length !== 32) return false;
  const key = await importKey(secret);
  // crypto.subtle.verify performs the comparison inside the crypto implementation rather than in
  // user code, which is the constant-time primitive available in a Worker.
  return crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(canonicalPayload(claims)),
  );
}
