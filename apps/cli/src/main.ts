#!/usr/bin/env node
import { CLI_EXIT_CODES, createCliClient, exitCodeForApiError } from './index.js';
import { exitCodeForManagementResponse, p1bManagementRequest } from './p1b-management.js';

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

function writeJson(parsed: ParsedArgs, payload: unknown): void {
  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  }
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.command === null) {
    process.stderr.write(
      'Usage: mbv [--env staging|production] <command> [...]\nCommands: get-run, list-api-keys, create-api-key, revoke-api-key, list-oauth-clients, oauth-token\n',
    );
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
    writeJson(parsed, response);
    return CLI_EXIT_CODES.ok;
  }

  const token = await client.readAccessToken();
  const managementOptions = { baseUrl: client.baseUrl, accessToken: token };

  if (parsed.command === 'list-api-keys') {
    const workspaceId = parsed.rest[0];
    if (workspaceId === undefined) {
      process.stderr.write('Usage: mbv list-api-keys <workspace-id>\n');
      return CLI_EXIT_CODES.usage;
    }
    const response = await p1bManagementRequest(
      managementOptions,
      `/workspaces/${encodeURIComponent(workspaceId)}/api-keys`,
      { method: 'GET' },
    );
    writeJson(parsed, response.body);
    return exitCodeForManagementResponse(response);
  }

  if (parsed.command === 'create-api-key') {
    const workspaceId = parsed.rest[0];
    const name = parsed.rest[1];
    const scopes = parsed.rest[2]?.split(',').map((value) => value.trim()) ?? [];
    if (workspaceId === undefined || name === undefined || scopes.length === 0) {
      process.stderr.write('Usage: mbv create-api-key <workspace-id> <name> <scope,scope,...>\n');
      return CLI_EXIT_CODES.usage;
    }
    const response = await p1bManagementRequest(
      managementOptions,
      `/workspaces/${encodeURIComponent(workspaceId)}/api-keys`,
      {
        method: 'POST',
        body: { name, scopes },
        idempotencyKey: crypto.randomUUID(),
      },
    );
    writeJson(parsed, response.body);
    return exitCodeForManagementResponse(response);
  }

  if (parsed.command === 'revoke-api-key') {
    const keyId = parsed.rest[0];
    const workspaceId = parsed.rest[1];
    if (keyId === undefined || workspaceId === undefined) {
      process.stderr.write('Usage: mbv revoke-api-key <key-id> <workspace-id>\n');
      return CLI_EXIT_CODES.usage;
    }
    const response = await p1bManagementRequest(
      managementOptions,
      `/api-keys/${encodeURIComponent(keyId)}/revoke`,
      {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        workspaceId,
      },
    );
    writeJson(parsed, response.body);
    return exitCodeForManagementResponse(response);
  }

  if (parsed.command === 'list-oauth-clients') {
    const workspaceId = parsed.rest[0];
    if (workspaceId === undefined) {
      process.stderr.write('Usage: mbv list-oauth-clients <workspace-id>\n');
      return CLI_EXIT_CODES.usage;
    }
    const response = await p1bManagementRequest(
      managementOptions,
      `/workspaces/${encodeURIComponent(workspaceId)}/oauth-clients`,
      { method: 'GET' },
    );
    writeJson(parsed, response.body);
    return exitCodeForManagementResponse(response);
  }

  if (parsed.command === 'oauth-token') {
    const clientId = parsed.rest[0];
    const clientSecret = parsed.rest[1];
    if (clientId === undefined || clientSecret === undefined) {
      process.stderr.write('Usage: mbv oauth-token <client-id> <client-secret>\n');
      return CLI_EXIT_CODES.usage;
    }
    const response = await p1bManagementRequest(managementOptions, '/oauth/token', {
      method: 'POST',
      body: {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      },
    });
    writeJson(parsed, response.body);
    return exitCodeForManagementResponse(response);
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
