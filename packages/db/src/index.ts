export type { Database, Json } from './database.generated';
export type {
  DatabaseExecutor,
  DatabaseFunctionArgs,
  DatabaseFunctionName,
  DatabaseInsert,
  DatabaseRow,
  DatabaseTableName,
  DatabaseUpdate,
} from './executor';
export {
  assertBalancedLedgerEntries,
  assertQuoteWindow,
  integerMicros,
  isBalancedLedgerEntries,
  tenantContext,
} from './invariants';
export type { IntegerMicros, LedgerDraftEntry, TenantContext } from './invariants';
export type {
  ArtifactRepository,
  BillingRepository,
  BriefRepository,
  CatalogRepository,
  CanvasRepository,
  DatabaseRepositories,
  ProjectRepository,
  RunRepository,
  WorkspaceRepository,
} from './repositories';
export { createDatabaseRepositories } from './repositories';

export const userScopedDatabasePath = 'supabase-data-api-rpc' as const;
export const backgroundDatabasePath = 'least-privilege-machine-rpc' as const;

export function isAllowedUserDatabasePath(value: string): boolean {
  return value === userScopedDatabasePath;
}
