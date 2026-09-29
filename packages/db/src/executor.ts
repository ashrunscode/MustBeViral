import type { Database, Json } from './database.generated';

type Tables = Database['public']['Tables'];
type Functions = Database['public']['Functions'];

export type DatabaseTableName = keyof Tables;
export type DatabaseRow<TableName extends DatabaseTableName> = Tables[TableName]['Row'];
export type DatabaseInsert<TableName extends DatabaseTableName> = Tables[TableName]['Insert'];
export type DatabaseUpdate<TableName extends DatabaseTableName> = Tables[TableName]['Update'];
export type DatabaseFunctionName = keyof Functions;
export type DatabaseFunctionArgs<FunctionName extends DatabaseFunctionName> =
  Functions[FunctionName]['Args'];

export interface DatabaseExecutor {
  select<TableName extends DatabaseTableName>(
    table: TableName,
    query: Readonly<Record<string, string>>,
  ): Promise<readonly Readonly<DatabaseRow<TableName>>[]>;
  selectOne<TableName extends DatabaseTableName>(
    table: TableName,
    query: Readonly<Record<string, string>>,
  ): Promise<Readonly<DatabaseRow<TableName>> | null>;
  insert<TableName extends DatabaseTableName>(
    table: TableName,
    input: Readonly<DatabaseInsert<TableName>>,
  ): Promise<Readonly<DatabaseRow<TableName>>>;
  update<TableName extends DatabaseTableName>(
    table: TableName,
    query: Readonly<Record<string, string>>,
    input: Readonly<DatabaseUpdate<TableName>>,
  ): Promise<Readonly<DatabaseRow<TableName>>>;
  rpc<FunctionName extends DatabaseFunctionName>(
    functionName: FunctionName,
    args: Readonly<DatabaseFunctionArgs<FunctionName>>,
  ): Promise<Json>;
}
