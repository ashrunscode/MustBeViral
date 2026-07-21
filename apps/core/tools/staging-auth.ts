import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { HarnessFlowError } from './launch-pack-harness-lib';

const WRANGLER_CONFIG = new URL('../wrangler.jsonc', import.meta.url);

function nativeFilePath(source: URL): string {
  const pathname = decodeURIComponent(source.pathname);
  return /^\/[A-Za-z]:\//u.test(pathname) ? pathname.slice(1).replaceAll('/', '\\') : pathname;
}

export interface StagingAuthConfiguration {
  readonly supabaseUrl: string;
  readonly publishableKey: string;
}

export interface DisposableIdentity {
  readonly email: string;
  readonly password: string;
}

function configuredValue(source: string, name: string): string {
  const match = new RegExp(`"${name}"\\s*:\\s*"([^"]+)"`, 'u').exec(source);
  const value = match?.[1];
  if (value === undefined || value.length === 0) {
    throw new HarnessFlowError({
      code: 'STAGING_CONFIG_MISSING',
      message: `The staging ${name} value is unavailable.`,
    });
  }
  return value;
}

export async function loadStagingAuthConfiguration(): Promise<StagingAuthConfiguration> {
  const source = await readFile(nativeFilePath(WRANGLER_CONFIG), 'utf8');
  return {
    supabaseUrl: configuredValue(source, 'SUPABASE_URL'),
    publishableKey: configuredValue(source, 'SUPABASE_PUBLISHABLE_KEY'),
  };
}

export function createDisposableIdentity(now: () => number = Date.now): DisposableIdentity {
  const suffix = randomBytes(12).toString('hex');
  return {
    email: `launch-pack-${String(now())}-${suffix}@staging.mustbeviral.invalid`,
    password: `Lp!9-${randomBytes(32).toString('base64url')}`,
  };
}

function accessToken(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const token = (value as Readonly<Record<string, unknown>>).access_token;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

async function authRequest(
  fetchImplementation: typeof fetch,
  configuration: StagingAuthConfiguration,
  path: string,
  identity: DisposableIdentity,
): Promise<Response> {
  return fetchImplementation(`${configuration.supabaseUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: configuration.publishableKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: identity.email, password: identity.password }),
  });
}

export async function authenticateDisposableStagingUser(options: {
  readonly configuration: StagingAuthConfiguration;
  readonly fetchImplementation?: typeof fetch;
  readonly log?: (message: string) => void;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly pollMilliseconds?: number;
}): Promise<Readonly<{ email: string; accessToken: string }>> {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const log = options.log ?? console.log;
  const sleep =
    options.sleep ??
    ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const identity = createDisposableIdentity();
  const signup = await authRequest(fetchImplementation, options.configuration, 'signup', identity);
  const signupBody = (await signup.json()) as unknown;
  if (!signup.ok) {
    throw new HarnessFlowError({
      code: 'AUTH_SIGNUP_FAILED',
      message: 'Disposable staging signup failed.',
    });
  }
  const immediateToken = accessToken(signupBody);
  if (immediateToken !== null) return { email: identity.email, accessToken: immediateToken };

  log(`PAUSED awaiting out-of-band email confirmation: ${identity.email}`);
  const pollMilliseconds = options.pollMilliseconds ?? 5_000;
  while (true) {
    const signin = await authRequest(
      fetchImplementation,
      options.configuration,
      'token?grant_type=password',
      identity,
    );
    const signinBody = (await signin.json()) as unknown;
    const token = accessToken(signinBody);
    if (signin.ok && token !== null) return { email: identity.email, accessToken: token };
    if (signin.status !== 400 && signin.status !== 401 && signin.status !== 429) {
      throw new HarnessFlowError({
        code: 'AUTH_SIGNIN_FAILED',
        message: 'Disposable staging sign-in failed.',
      });
    }
    await sleep(pollMilliseconds);
  }
}
