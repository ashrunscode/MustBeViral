#!/usr/bin/env node
import { CLI_EXIT_CODES, createCliClient, exitCodeForApiError } from './index.js';

interface ParsedArgs {
  readonly command: string | null;
  readonly environment: 'staging' | 'production';
  readonly json: boolean;
  readonly rest: string[];
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let environment: 'staging' | 'production' = 'staging';
  let json = true;
  const rest: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;
    if (arg === '--env' || arg === '-e') {
      const value = argv[index + 1];
      if (value !== 'staging' && value !== 'production') {
        throw new Error('Usage: mbv [--env staging|production] <command> [...]');
      }
      environment = value;
      index += 1;
      continue;
    }
    if (arg === '--human') {
      json = false;
      continue;
    }
    rest.push(arg);
  }
  return { command: rest[0] ?? null, environment, json, rest: rest.slice(1) };
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.command === null) {
    process.stderr.write('Usage: mbv [--env staging|production] get-run <run-id>\n');
    return CLI_EXIT_CODES.usage;
  }

  const client = await createCliClient({ environment: parsed.environment });

  if (parsed.command === 'get-run') {
    const runId = parsed.rest[0];
    if (runId === undefined) {
      process.stderr.write('Usage: mbv get-run <run-id>\n');
      return CLI_EXIT_CODES.usage;
    }
    const response = await client.request('get_run', { id: runId });
    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
    } else {
      process.stdout.write(`${runId}\t${JSON.stringify(response)}\n`);
    }
    return CLI_EXIT_CODES.ok;
  }

  if (parsed.command === 'list-api-keys') {
    const workspaceId = parsed.rest[0];
    if (workspaceId === undefined) {
      process.stderr.write('Usage: mbv list-api-keys <workspace-id>\n');
      return CLI_EXIT_CODES.usage;
    }
    const token = await client.readAccessToken();
    const response = await fetch(
      `${client.baseUrl}/workspaces/${encodeURIComponent(workspaceId)}/api-keys`,
      {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      },
    );
    const body: unknown = await response.json();
    process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
    if (!response.ok) {
      const code =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof (body as { error?: { code?: string } }).error?.code === 'string'
          ? (body as { error: { code: string } }).error.code
          : 'INTERNAL_ERROR';
      return exitCodeForApiError(code);
    }
    return CLI_EXIT_CODES.ok;
  }

  process.stderr.write(`Unknown command: ${parsed.command}\n`);
  return CLI_EXIT_CODES.usage;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const codeMatch = /"code":"([^"]+)"/u.exec(message);
    process.stderr.write(`${message}\n`);
    process.exitCode =
      codeMatch?.[1] !== undefined ? exitCodeForApiError(codeMatch[1]) : CLI_EXIT_CODES.internal;
  });
