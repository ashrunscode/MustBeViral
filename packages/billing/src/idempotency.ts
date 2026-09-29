export interface IdempotencyIdentity {
  readonly actorId: string;
  readonly workspaceId: string | null;
  readonly operation: string;
  readonly idempotencyKey: string;
}

export interface DeriveIdempotencyIdentityInput {
  readonly actorId: string;
  readonly workspaceId?: string;
  readonly operation: string;
  readonly idempotencyKey: string;
}

export interface DerivedIdempotencyKey {
  readonly identity: IdempotencyIdentity;
  readonly advisoryLockKey: string;
}

function requireBoundedText(value: string, field: string, maximumLength: number): void {
  if (value.length < 1 || value.length > maximumLength) {
    throw new TypeError(`${field} must be between 1 and ${maximumLength} characters`);
  }
}

export function deriveIdempotencyKey(input: DeriveIdempotencyIdentityInput): DerivedIdempotencyKey {
  requireBoundedText(input.actorId, 'actorId', 200);
  requireBoundedText(input.operation, 'operation', 100);
  requireBoundedText(input.idempotencyKey, 'idempotencyKey', 200);
  const workspaceId = input.workspaceId ?? null;
  if (workspaceId === null && input.operation !== 'create_workspace') {
    throw new TypeError('Only create_workspace may omit workspaceId');
  }
  if (workspaceId !== null) {
    requireBoundedText(workspaceId, 'workspaceId', 200);
  }

  const identity = Object.freeze({
    actorId: input.actorId,
    workspaceId,
    operation: input.operation,
    idempotencyKey: input.idempotencyKey,
  });
  const advisoryLockKey =
    workspaceId === null
      ? `${input.actorId}:${input.operation}:${input.idempotencyKey}`
      : `${input.actorId}:${workspaceId}:${input.operation}:${input.idempotencyKey}`;

  return Object.freeze({ identity, advisoryLockKey });
}

export function sameIdempotencyIdentity(
  left: IdempotencyIdentity,
  right: IdempotencyIdentity,
): boolean {
  return (
    left.actorId === right.actorId &&
    left.workspaceId === right.workspaceId &&
    left.operation === right.operation &&
    left.idempotencyKey === right.idempotencyKey
  );
}
