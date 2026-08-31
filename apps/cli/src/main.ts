#!/usr/bin/env node
import {
  CLI_EXIT_CODES,
  createCliClient,
  exitCodeForApiError,
  type CliEnvironment,
} from './index.js';
import { defaultCredentialStore } from './credential-store.js';
import { loginWithToken, logout } from './login.js';
import { exitCodeForManagementResponse, p1bManagementRequest } from './p1b-management.js';
import {
  isProductionCliCommand,
  runProductionCommand,
  usageErrorExitCode,
} from './production-commands.js';

interface ParsedArgs {
  readonly command: string | null;
  readonly environment: CliEnvironment;
  readonly json: boolean;
  readonly token?: string | undefined;
  readonly bodyJson?: string | undefined;
  readonly idempotencyKey?: string | undefined;
  readonly confirmationToken?: string | undefined;
  readonly confirmed: boolean;
  readonly confirm: boolean;
  readonly reason?: string | undefined;
  readonly rest: string[];
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let environment: CliEnvironment = 'staging';
  let json = true;
  let token: string | undefined;
  let bodyJson: string | undefined;
  let idempotencyKey: string | undefined;
  let confirmationToken: string | undefined;
  let confirmed = false;
  let confirm = false;
  let reason: string | undefined;
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
    if (arg === '--token') {
      token = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--body-json') {
      bodyJson = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--idempotency-key') {
      idempotencyKey = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--confirmation-token') {
      confirmationToken = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--reason') {
      reason = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--confirmed') {
      confirmed = true;
      continue;
    }
    if (arg === '--confirm') {
      confirm = true;
      continue;
    }
    rest.push(arg);
  }

  return {
    command: rest[0] ?? null,
    environment,
    json,
    token,
    bodyJson,
    idempotencyKey,
    confirmationToken,
    confirmed,
    confirm,
    reason,
    rest: rest.slice(1),
  };
}

function writeJson(parsed: ParsedArgs, payload: unknown): void {
  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  }
}

const COMMAND_HELP =
  'Commands: login, logout, get-canvas-context, apply-canvas-patch, quote-run, start-run, get-run, validate-graph, cancel-run, get-artifact, create-export, explain-model, get-receipt, list-api-keys, create-api-key, revoke-api-key, list-oauth-clients, oauth-token';

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.command === null) {
    process.stderr.write(
      `Usage: mbv [--env staging|production] <command> [...]\n${COMMAND_HELP}\n`,
    );
    return CLI_EXIT_CODES.usage;
  }

  const credentialStore = defaultCredentialStore();

  if (parsed.command === 'login') {
    await loginWithToken({
      environment: parsed.environment,
      credentialStore,
      token: parsed.token,
    });
    writeJson(parsed, {
      data: { environment: parsed.environment, status: 'logged_in' },
      meta: { request_id: `cli-login-${crypto.randomUUID()}` },
    });
    return CLI_EXIT_CODES.ok;
  }

  if (parsed.command === 'logout') {
    await logout({ environment: parsed.environment, credentialStore });
    writeJson(parsed, {
      data: { environment: parsed.environment, status: 'logged_out' },
      meta: { request_id: `cli-logout-${crypto.randomUUID()}` },
    });
    return CLI_EXIT_CODES.ok;
  }

  const client = await createCliClient({
    environment: parsed.environment,
    credentialStore,
    ...(parsed.token === undefined ? {} : { accessToken: parsed.token }),
  });

  if (isProductionCliCommand(parsed.command)) {
    const result = await runProductionCommand(client, parsed.command, parsed.rest, {
      bodyJson: parsed.bodyJson,
      idempotencyKey: parsed.idempotencyKey,
      confirmationToken: parsed.confirmationToken,
      confirmed: parsed.confirmed,
      confirm: parsed.confirm,
      reason: parsed.reason,
    });
    writeJson(parsed, result.payload);
    return result.exitCode;
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
        idempotencyKey: parsed.idempotencyKey ?? crypto.randomUUID(),
      },
    );
    writeJson(parsed, response.body);
    return exitCodeForManagementResponse(response);
  }

  if (parsed.command === 'revoke-api-key') {
    if (!parsed.confirm) {
      process.stderr.write('Usage: mbv revoke-api-key <key-id> <workspace-id> --confirm\n');
      return CLI_EXIT_CODES.usage;
    }
    const keyId = parsed.rest[0];
    const workspaceId = parsed.rest[1];
    if (keyId === undefined || workspaceId === undefined) {
      process.stderr.write('Usage: mbv revoke-api-key <key-id> <workspace-id> --confirm\n');
      return CLI_EXIT_CODES.usage;
    }
    const response = await p1bManagementRequest(
      managementOptions,
      `/api-keys/${encodeURIComponent(keyId)}/revoke`,
      {
        method: 'POST',
        idempotencyKey: parsed.idempotencyKey ?? crypto.randomUUID(),
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
      codeMatch?.[1] !== undefined ? exitCodeForApiError(codeMatch[1]) : usageErrorExitCode(error);
  });
