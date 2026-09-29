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

type LocalDatabase = {
  host: string;
  port: number;
  username: string;
  database: string;
  password: string;
};

type LocalRuntime = {
  database: LocalDatabase;
  api: { url: string; anonKey: string; serviceRoleKey: string };
};

function readLocalHelper(operation: 'localSupabaseDatabase' | 'localSupabaseRuntime'): unknown {
  const helper = pathToFileURL(join(findRepoRoot(), 'packages/db/scripts/local-supabase.mjs')).href;
  try {
    const raw = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { ${operation} } from ${JSON.stringify(helper)}; process.stdout.write(JSON.stringify(${operation}()));`,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('The verified MustBeViral local runtime is unavailable.');
  }
}

function validateLocalDatabase(connection: LocalDatabase) {
  if (
    connection.host !== '127.0.0.1' ||
    !Number.isSafeInteger(connection.port) ||
    connection.port < 1 ||
    connection.port > 65535 ||
    connection.database !== 'postgres' ||
    typeof connection.password !== 'string' ||
    !connection.password
  ) {
    throw new Error('MustBeViral local database identity did not match the expected loopback pin.');
  }
  return connection;
}

export const PLATFORM_WEB_ORIGIN = 'http://127.0.0.1:3111';
export const PLATFORM_CORE_ORIGIN = 'http://127.0.0.1:8789';
export const SYNTHETIC_JOURNEY_PASSWORD = 'Synthetic.Local-Journeys-24';
export const SEEDED_WALLET_MICROS = '250000000';

export function requireMustBeViralDatabase() {
  // The shared helper checks the named running Docker container and its published port each time.
  return validateLocalDatabase(readLocalHelper('localSupabaseDatabase') as LocalDatabase);
}

function requireLocalSupabaseApi() {
  const runtime = readLocalHelper('localSupabaseRuntime') as LocalRuntime;
  validateLocalDatabase(runtime.database);
  const apiUrl = new URL(runtime.api.url);
  if (
    apiUrl.protocol !== 'http:' ||
    apiUrl.hostname !== '127.0.0.1' ||
    !apiUrl.port ||
    apiUrl.username ||
    apiUrl.password ||
    apiUrl.pathname !== '/' ||
    apiUrl.search ||
    apiUrl.hash ||
    typeof runtime.api.serviceRoleKey !== 'string' ||
    !runtime.api.serviceRoleKey
  ) {
    throw new Error('Expected MustBeViral local Supabase API is unavailable.');
  }
  return { apiUrl: apiUrl.origin, serviceRoleKey: runtime.api.serviceRoleKey };
}

export function requireLocalSupabaseIssuer() {
  return `${requireLocalSupabaseApi().apiUrl}/auth/v1`;
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

export async function deleteSyntheticUsers(users: ReadonlyArray<{ id: string; email: string }>) {
  if (users.length === 0) return [];
  for (const user of users) {
    if (
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(user.id) ||
      !user.email.endsWith('@synthetic.example.test')
    ) {
      throw new Error('Cleanup accepts only recorded local synthetic user identities.');
    }
  }
  // Resolve and verify once for this bounded batch; repeated CLI launches can exhaust teardown time.
  const { apiUrl, serviceRoleKey } = requireLocalSupabaseApi();
  const headers = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };
  const results: Array<{ id: string; email: string; deleted: boolean; status: number }> = [];
  for (const user of users) {
    const url = `${apiUrl}/auth/v1/admin/users/${user.id}`;
    const current = await globalThis.fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!current.ok) {
      results.push({ ...user, deleted: current.status === 404, status: current.status });
      continue;
    }
    const identity = (await current.json()) as { email?: string; user?: { email?: string } };
    if ((identity.email ?? identity.user?.email) !== user.email) {
      results.push({ ...user, deleted: false, status: 409 });
      continue;
    }
    const response = await globalThis.fetch(url, {
      method: 'DELETE',
      headers,
      signal: AbortSignal.timeout(5000),
    });
    results.push({
      ...user,
      deleted: response.ok || response.status === 404,
      status: response.status,
    });
  }
  return results;
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

export async function seedProjectBrandMapping(
  workspaceId: string,
  projectId: string,
  brandId: string,
) {
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
      insert into public.project_brand_mappings (workspace_id, project_id, brand_id)
      values (${workspaceId}::uuid, ${projectId}::uuid, ${brandId}::uuid)
      returning project_id
    `;
    if (!row?.project_id) throw new Error('Project brand mapping seed returned no identity.');
    return { projectId: String(row.project_id), workspaceId, brandId };
  } finally {
    await sql.end({ timeout: 5 });
  }
}
