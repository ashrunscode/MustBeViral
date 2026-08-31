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
    process.exitCode = codeMatch ? exitCodeForApiError(codeMatch[1]) : CLI_EXIT_CODES.internal;
  });
