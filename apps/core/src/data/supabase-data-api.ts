import type {
  DatabaseExecutor,
  DatabaseFunctionArgs,
  DatabaseFunctionName,
  DatabaseInsert,
  DatabaseRow,
  DatabaseTableName,
  DatabaseUpdate,
  Json,
} from '../../../../packages/db/src/index';

export type SupabaseFailureKind =
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'expired_quote'
  | 'cap_exceeded'
  | 'graph_invalid'
  | 'validation'
  | 'internal';

export interface SupabasePostgrestError {
  readonly code?: string;
  readonly message?: string;
  readonly details?: string | null;
  readonly hint?: string | null;
}

export class SupabaseDataApiError extends Error {
  override readonly name = 'SupabaseDataApiError';

  constructor(
    readonly kind: SupabaseFailureKind,
    readonly safeDetails: Readonly<Record<string, unknown>> = {},
  ) {
    super(`Supabase Data API request failed: ${kind}`);
  }
}

export interface SupabaseDataApiOptions {
  readonly baseUrl: string;
  readonly publishableKey: string;
  readonly callerJwt: string;
  readonly fetch?: typeof fetch;
}

export interface DataApiRequest {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly body?: unknown;
  readonly returnRepresentation?: boolean;
  readonly single?: boolean;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function postgrestError(value: unknown): SupabasePostgrestError {
  if (!isRecord(value)) return {};
  return {
    ...(typeof value.code === 'string' ? { code: value.code } : {}),
    ...(typeof value.message === 'string' ? { message: value.message } : {}),
    ...(typeof value.details === 'string' || value.details === null
      ? { details: value.details }
      : {}),
    ...(typeof value.hint === 'string' || value.hint === null ? { hint: value.hint } : {}),
  };
}

function rpcFailureKind(error: SupabasePostgrestError): SupabaseFailureKind | null {
  const message = `${error.message ?? ''} ${error.details ?? ''}`.toUpperCase();
  if (message.includes('QUOTE_EXPIRED')) return 'expired_quote';
  if (
    message.includes('BUDGET_EXCEEDED') ||
    message.includes('INSUFFICIENT_BALANCE') ||
    message.includes('CAP_EXCEEDED')
  ) {
    return 'cap_exceeded';
  }
  if (message.includes('GRAPH_INVALID')) return 'graph_invalid';
  if (
    message.includes('REVISION_CONFLICT') ||
    message.includes('IDEMPOTENCY_CONFLICT') ||
    message.includes('QUOTE_STALE') ||
    message.includes('QUOTE_ALREADY_USED') ||
    message.includes('RUN_STATE_CONFLICT')
  ) {
    return 'conflict';
  }
  if (
    message.includes('FORBIDDEN') ||
    message.includes('UNAUTHENTICATED') ||
    message.includes('WORKSPACE_UNAVAILABLE')
  ) {
    return 'forbidden';
  }
  if (message.includes('NOT_FOUND')) return 'not_found';
  if (message.includes('VALIDATION_FAILED') || error.code?.startsWith('22') === true) {
    return 'validation';
  }
  return null;
}

export function mapSupabaseFailure(status: number, body: unknown): SupabaseDataApiError {
  const error = postgrestError(body);
  if (status === 401 || status === 403) return new SupabaseDataApiError('forbidden');
  if (error.code === 'PGRST116') return new SupabaseDataApiError('not_found');
  if (error.code === '23505') return new SupabaseDataApiError('conflict');
  const rpcKind = rpcFailureKind(error);
  if (rpcKind !== null) return new SupabaseDataApiError(rpcKind);
  return new SupabaseDataApiError(status >= 500 ? 'internal' : 'validation');
}

export class SupabaseDataApiExecutor implements DatabaseExecutor {
  readonly #baseUrl: string;
  readonly #publishableKey: string;
  readonly #callerJwt: string;
  readonly #fetch: typeof fetch;

  constructor(options: SupabaseDataApiOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/u, '');
    this.#publishableKey = options.publishableKey;
    this.#callerJwt = options.callerJwt;
    this.#fetch = options.fetch ?? fetch;
  }

  async request<Result>(input: DataApiRequest): Promise<Result> {
    const response = await this.#fetch(`${this.#baseUrl}/rest/v1/${input.path}`, {
      method: input.method ?? 'GET',
      headers: {
        accept: input.single ? 'application/vnd.pgrst.object+json' : 'application/json',
        apikey: this.#publishableKey,
        authorization: `Bearer ${this.#callerJwt}`,
        ...(input.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(input.returnRepresentation ? { prefer: 'return=representation' } : {}),
      },
      ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    });
    let body: unknown = null;
    if (response.status !== 204) {
      try {
        body = (await response.json()) as unknown;
      } catch {
        throw new SupabaseDataApiError('internal');
      }
    }
    if (!response.ok) throw mapSupabaseFailure(response.status, body);
    return body as Result;
  }

  async select<TableName extends DatabaseTableName>(
    table: TableName,
    query: Readonly<Record<string, string>>,
  ): Promise<readonly Readonly<DatabaseRow<TableName>>[]> {
    const rows = await this.request<readonly Readonly<DatabaseRow<TableName>>[]>({
      path: `${table}?${new URLSearchParams(query).toString()}`,
    });
    return rows;
  }

  async selectOne<TableName extends DatabaseTableName>(
    table: TableName,
    query: Readonly<Record<string, string>>,
  ): Promise<Readonly<DatabaseRow<TableName>> | null> {
    try {
      return await this.request<Readonly<DatabaseRow<TableName>>>({
        path: `${table}?${new URLSearchParams(query).toString()}`,
        single: true,
      });
    } catch (error) {
      if (error instanceof SupabaseDataApiError && error.kind === 'not_found') return null;
      throw error;
    }
  }

  insert<TableName extends DatabaseTableName>(
    table: TableName,
    input: Readonly<DatabaseInsert<TableName>>,
  ): Promise<Readonly<DatabaseRow<TableName>>> {
    return this.request<readonly Readonly<DatabaseRow<TableName>>[]>({
      method: 'POST',
      path: `${table}?select=*`,
      body: input,
      returnRepresentation: true,
    }).then((rows) => {
      const row = rows[0];
      if (row === undefined) throw new SupabaseDataApiError('internal');
      return row;
    });
  }

  update<TableName extends DatabaseTableName>(
    table: TableName,
    query: Readonly<Record<string, string>>,
    input: Readonly<DatabaseUpdate<TableName>>,
  ): Promise<Readonly<DatabaseRow<TableName>>> {
    return this.request<readonly Readonly<DatabaseRow<TableName>>[]>({
      method: 'PATCH',
      path: `${table}?${new URLSearchParams(query).toString()}`,
      body: input,
      returnRepresentation: true,
    }).then((rows) => {
      const row = rows[0];
      if (row === undefined) throw new SupabaseDataApiError('not_found');
      return row;
    });
  }

  rpc<FunctionName extends DatabaseFunctionName>(
    functionName: FunctionName,
    args: Readonly<DatabaseFunctionArgs<FunctionName>>,
  ): Promise<Json> {
    return this.request<Json>({
      method: 'POST',
      path: `rpc/${encodeURIComponent(functionName)}`,
      body: args,
      returnRepresentation: true,
    });
  }
}
