const API_KEY_PREFIX = 'mbv_sk_' as const;
const OAUTH_CLIENT_PREFIX = 'mbv_client_' as const;
const OAUTH_TOKEN_PREFIX = 'mbv_oauth_' as const;

function randomHex(byteCount: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateApiKeyMaterial(): Readonly<{ token: string; prefix: string }> {
  const token = `${API_KEY_PREFIX}${randomHex(32)}`;
  return { token, prefix: token.slice(0, 12) };
}

export function generateOAuthClientMaterial(): Readonly<{
  clientId: string;
  clientSecret: string;
}> {
  const suffix = randomHex(16);
  return {
    clientId: `${OAUTH_CLIENT_PREFIX}${suffix}`,
    clientSecret: `${OAUTH_CLIENT_PREFIX}${randomHex(32)}`,
  };
}

export function generateOAuthAccessTokenMaterial(): Readonly<{ token: string }> {
  return { token: `${OAUTH_TOKEN_PREFIX}${randomHex(32)}` };
}

export const workerCredentialGenerator = {
  generateApiKey: generateApiKeyMaterial,
  generateOAuthClient: generateOAuthClientMaterial,
  generateOAuthAccessToken: generateOAuthAccessTokenMaterial,
  hashSecret: sha256Hex,
};
