import { createInterface } from 'node:readline';

import type { CliCredentialStore, CliEnvironment } from './credential-store.js';

export interface LoginOptions {
  readonly environment: CliEnvironment;
  readonly credentialStore: CliCredentialStore;
  readonly token?: string | undefined;
  readonly stdin?: NodeJS.ReadableStream;
  readonly isTTY?: boolean;
}

export async function readAccessToken(options: LoginOptions): Promise<string> {
  if (options.token !== undefined && options.token.length > 0) {
    return options.token.trim();
  }

  const stdin = options.stdin ?? process.stdin;
  const isTTY = options.isTTY ?? process.stdin.isTTY;

  if (isTTY) {
    const rl = createInterface({ input: stdin, output: process.stderr });
    return new Promise((resolve, reject) => {
      rl.question('Paste your Supabase access token: ', (answer) => {
        rl.close();
        const trimmed = answer.trim();
        if (trimmed.length === 0) {
          reject(new Error('A bearer token is required.'));
          return;
        }
        resolve(trimmed);
      });
    });
  }

  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const token = Buffer.concat(chunks).toString('utf8').trim();
  if (token.length === 0) {
    throw new Error('A bearer token is required.');
  }
  return token;
}

export async function loginWithToken(options: LoginOptions): Promise<void> {
  const token = await readAccessToken(options);
  await options.credentialStore.write(options.environment, token);
}

export async function logout(options: {
  readonly environment: CliEnvironment;
  readonly credentialStore: CliCredentialStore;
}): Promise<void> {
  await options.credentialStore.delete(options.environment);
}
