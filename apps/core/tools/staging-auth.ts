import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { HarnessFlowError } from './launch-pack-harness-lib';

async function readCoreFile(name: 'wrangler.jsonc' | '.dev.vars'): Promise<string> {
  const candidates = [
    resolve(process.cwd(), name),
    resolve(process.cwd(), '..', 'core', name),
    resolve(process.cwd(), 'apps', 'core', name),
  ];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new HarnessFlowError({
    code: 'STAGING_CONFIG_MISSING',
    message: `The staging ${name} file is unavailable.`,
  });
}

export interface StagingAuthConfiguration {
  readonly supabaseUrl: string;
  readonly publishableKey: string;
}

export interface StagingAdminConfiguration extends StagingAuthConfiguration {
  readonly serviceRoleKey: string;
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
  const source = await readCoreFile('wrangler.jsonc');
  return {
    supabaseUrl: configuredValue(source, 'SUPABASE_URL'),
    publishableKey: configuredValue(source, 'SUPABASE_PUBLISHABLE_KEY'),
  };
}

function environmentFileValue(source: string, name: string): string | undefined {
  const match = new RegExp(`^${name}=(.*)$`, 'mu').exec(source);
  const raw = match?.[1]?.trim();
  if (raw === undefined || raw.length === 0) return undefined;
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

export async function loadStagingAdminConfiguration(): Promise<StagingAdminConfiguration> {
  const [configuration, localSource] = await Promise.all([
    loadStagingAuthConfiguration(),
    readCoreFile('.dev.vars'),
  ]);
  const serviceRoleKey =
    process.env['SUPABASE_SERVICE_ROLE_KEY'] ??
    environmentFileValue(localSource, 'SUPABASE_SERVICE_ROLE_KEY');
  if (serviceRoleKey === undefined || serviceRoleKey.length === 0) {
    throw new HarnessFlowError({
      code: 'STAGING_CONFIG_MISSING',
      message: 'The staging service-role credential is unavailable.',
    });
  }
  return { ...configuration, serviceRoleKey };
}

export async function createConfirmedDisposableStagingUser(options: {
  readonly configuration: StagingAdminConfiguration;
  readonly identity: DisposableIdentity;
  readonly fetchImplementation?: typeof fetch;
}): Promise<void> {
  const response = await (options.fetchImplementation ?? fetch)(
    `${options.configuration.supabaseUrl}/auth/v1/admin/users`,
    {
      method: 'POST',
      headers: {
        apikey: options.configuration.serviceRoleKey,
        authorization: `Bearer ${options.configuration.serviceRoleKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: options.identity.email,
        password: options.identity.password,
        email_confirm: true,
      }),
    },
  );
  if (!response.ok) {
    throw new HarnessFlowError({
      code: 'AUTH_SIGNUP_FAILED',
      message: 'Disposable staging user confirmation failed.',
    });
  }
}

export function createDisposableIdentity(now: () => number = Date.now): DisposableIdentity {
  const suffix = randomBytes(12).toString('hex');
  return {
    email: `ernijs.ansons+launch-pack-${String(now())}-${suffix}@gmail.com`,
    password: `Lp!9-${randomBytes(32).toString('base64url')}`,
  };
}

function accessToken(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const token = (value as Readonly<Record<string, unknown>>).access_token;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

async function responseBody(
  response: Response,
  observeResponseBody?: (rawResponseText: string) => void,
): Promise<unknown> {
  const rawResponseText = await response.text();
  observeResponseBody?.(rawResponseText);
  try {
    return JSON.parse(rawResponseText) as unknown;
  } catch {
    throw new HarnessFlowError({
      code: 'AUTH_RESPONSE_INVALID',
      message: 'Staging authentication returned invalid JSON.',
    });
  }
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
  readonly identity?: DisposableIdentity;
  readonly fetchImplementation?: typeof fetch;
  readonly log?: (message: string) => void;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly pollMilliseconds?: number;
  readonly observeResponseBody?: (rawResponseText: string) => void;
}): Promise<Readonly<{ email: string; accessToken: string }>> {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const log = options.log ?? console.log;
  const sleep =
    options.sleep ??
    ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const injectedEmail = process.env['STAGING_TEST_EMAIL'];
  const injectedPassword = process.env['STAGING_TEST_PASSWORD'];
  const injected =
    options.identity !== undefined ||
    (injectedEmail !== undefined &&
      injectedEmail.length > 0 &&
      injectedPassword !== undefined &&
      injectedPassword.length > 0);
  const identity: DisposableIdentity = injected
    ? (options.identity ?? { email: injectedEmail ?? '', password: injectedPassword ?? '' })
    : createDisposableIdentity();
  if (!injected) {
    const signup = await authRequest(
      fetchImplementation,
      options.configuration,
      'signup',
      identity,
    );
    const signupBody = await responseBody(signup, options.observeResponseBody);
    if (!signup.ok) {
      throw new HarnessFlowError({
        code: 'AUTH_SIGNUP_FAILED',
        message: 'Disposable staging signup failed.',
      });
    }
    const immediateToken = accessToken(signupBody);
    if (immediateToken !== null) return { email: identity.email, accessToken: immediateToken };

    log(`PAUSED awaiting out-of-band email confirmation: ${identity.email}`);
  }
  const pollMilliseconds = options.pollMilliseconds ?? 5_000;
  while (true) {
    const signin = await authRequest(
      fetchImplementation,
      options.configuration,
      'token?grant_type=password',
      identity,
    );
    const signinBody = await responseBody(signin, options.observeResponseBody);
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
