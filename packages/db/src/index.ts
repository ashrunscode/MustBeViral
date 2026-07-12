import type { Sql } from 'postgres';

export const userScopedDatabasePath = 'supabase-data-api-rpc' as const;
export const backgroundDatabasePath = 'least-privilege-machine-role' as const;

export type DatabaseClient = Sql<Record<string, never>>;

export function isAllowedUserDatabasePath(value: string): boolean {
  return value === userScopedDatabasePath;
}
