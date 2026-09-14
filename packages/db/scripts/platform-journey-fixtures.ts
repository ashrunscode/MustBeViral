import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';

export const LOCAL_SUPABASE_CONTAINER = 'supabase_db_mustbeviral';

function findRepoRoot(): string {
  let current = process.cwd();
  for (;;) {
    if (
      existsSync(join(current, 'pnpm-workspace.yaml')) &&
      existsSync(join(current, 'packages/db/scripts/local-supabase.mjs'))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) throw new Error('MustBeViral repository root was not found.');
    current = parent;
  }
}

function localSupabaseDatabase() {
  const helper = pathToFileURL(join(findRepoRoot(), 'packages/db/scripts/local-supabase.mjs')).href;
  const raw = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { localSupabaseDatabase } from ${JSON.stringify(helper)}; process.stdout.write(JSON.stringify(localSupabaseDatabase()));`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const connection = JSON.parse(raw) as {
    host: string;
    port: number;
    username: string;
    database: string;
    password: string;
  };
  if (
    connection.host !== '127.0.0.1' ||
    connection.port !== 54322 ||
    connection.database !== 'postgres' ||
    typeof connection.password !== 'string'
  ) {
    throw new Error('MustBeViral local database identity did not match the expected loopback pin.');
  }
  return connection;
}

export const PLATFORM_WEB_ORIGIN = 'http://127.0.0.1:3111';
export const PLATFORM_CORE_ORIGIN = 'http://127.0.0.1:8789';
export const SYNTHETIC_JOURNEY_PASSWORD = 'Synthetic.Local-Journeys-24';
export const SEEDED_WALLET_MICROS = '250000000';

function parseJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Expected local Supabase status JSON is unavailable.');
  }
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

export function requireMustBeViralDatabase() {
  const connection = localSupabaseDatabase();
  if (
    connection.host !== '127.0.0.1' ||
    connection.port !== 54322 ||
    connection.database !== 'postgres'
  ) {
    throw new Error('MustBeViral local database identity did not match the expected loopback pin.');
  }
  return connection;
}

function requireLocalSupabaseApi() {
  requireMustBeViralDatabase();
  const raw = execFileSync(
    process.platform === 'win32' ? 'corepack.cmd' : 'corepack',
    ['pnpm', 'exec', 'supabase', 'status', '--output', 'json'],
    {
      cwd: findRepoRoot(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', DO_NOT_TRACK: '1' },
    },
  );
  const status = parseJsonObject(raw);
  if (
    status['API_URL'] !== 'http://127.0.0.1:54321' ||
    typeof status['SERVICE_ROLE_KEY'] !== 'string'
  ) {
    throw new Error('Expected MustBeViral local Supabase API is unavailable.');
  }
  return { apiUrl: status['API_URL'] as string, serviceRoleKey: status['SERVICE_ROLE_KEY'] };
}

export async function requireConnectedPlatformServers() {
  requireMustBeViralDatabase();
  if (process.env['MBV_LOCAL_GOLDEN_PREVIEW'] === '1') {
    throw new Error('Connected journeys cannot use golden preview.');
  }
  if (process.env['PLAYWRIGHT_BASE_URL'] !== PLATFORM_WEB_ORIGIN) {
    throw new Error('Connected journeys require PLAYWRIGHT_BASE_URL=http://127.0.0.1:3111.');
  }
  const [web, core] = await Promise.all([
    globalThis.fetch(`${PLATFORM_WEB_ORIGIN}/login`),
    globalThis.fetch(`${PLATFORM_CORE_ORIGIN}/health`),
  ]);
  if (!web.ok) throw new Error('Local web 127.0.0.1:3111 is not ready.');
  if (!core.ok) throw new Error('Local Core 127.0.0.1:8789 is not ready.');
  const body = await web.text();
  if (body.includes('lumen-skin') || body.includes('fixture=100')) {
    throw new Error('Web 127.0.0.1:3111 is serving preview fixtures.');
  }
}

export async function createSyntheticUser(email: string) {
  const { apiUrl, serviceRoleKey } = requireLocalSupabaseApi();
  const response = await globalThis.fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: SYNTHETIC_JOURNEY_PASSWORD,
      email_confirm: true,
    }),
  });
  if (!response.ok) throw new Error(`Synthetic user create failed with HTTP ${response.status}.`);
  const payload = (await response.json()) as { id?: string; user?: { id?: string } };
  const id = payload.id ?? payload.user?.id;
  if (typeof id !== 'string') throw new Error('Synthetic user create returned no identity.');
  return { id, email };
}

export async function deleteSyntheticUser(id: string) {
  requireMustBeViralDatabase();
  const { apiUrl, serviceRoleKey } = requireLocalSupabaseApi();
  const response = await globalThis.fetch(`${apiUrl}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  });
  if (!response.ok && response.status !== 404) {
    return { deleted: false, status: response.status };
  }
  return { deleted: true, status: response.status };
}

export async function seedWorkspaceBilling(workspaceId: string) {
  const connection = requireMustBeViralDatabase();
  const sql = postgres({
    ...connection,
    max: 1,
    connect_timeout: 5,
    idle_timeout: 5,
    onnotice: () => {},
  });
  const transactionId = randomUUID();
  const causative = `w1b004-seed-${randomUUID()}`;
  try {
    await sql.begin(async (tx) => {
      await tx`
        insert into public.workspace_billing_profiles (workspace_id, wallet_balance_micros, subscription_status)
        values (${workspaceId}::uuid, ${SEEDED_WALLET_MICROS}::bigint, 'active')
        on conflict (workspace_id) do update
        set wallet_balance_micros = excluded.wallet_balance_micros,
            subscription_status = excluded.subscription_status
      `;
      await tx`
        insert into public.ledger_transactions (
          workspace_id, transaction_id, entry_type, account_code, direction, amount_micros, causative_key
        )
        values
          (${workspaceId}::uuid, ${transactionId}::uuid, 'credit', 'funding_clearing', 'debit', ${SEEDED_WALLET_MICROS}::bigint, ${causative}),
          (${workspaceId}::uuid, ${transactionId}::uuid, 'credit', 'wallet_available', 'credit', ${SEEDED_WALLET_MICROS}::bigint, ${causative})
      `;
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function seedLegacyProject(workspaceId: string, ownerId: string, name: string) {
  const connection = requireMustBeViralDatabase();
  const sql = postgres({
    ...connection,
    max: 1,
    connect_timeout: 5,
    idle_timeout: 5,
    onnotice: () => {},
  });
  try {
    const [row] = await sql`
      insert into public.projects (workspace_id, name, created_by)
      values (${workspaceId}::uuid, ${name}, ${ownerId}::uuid)
      returning id
    `;
    if (!row?.id) throw new Error('Legacy project seed returned no identity.');
    return { id: String(row.id) };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
