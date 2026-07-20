import { describe, expect, it } from 'vitest';

import { deriveIdempotencyKey, sameIdempotencyIdentity } from './idempotency';

describe('API idempotency derivation vectors', () => {
  it('derives the start_run database identity and advisory-lock vector', () => {
    expect(
      deriveIdempotencyKey({
        actorId: 'actor-1',
        workspaceId: 'workspace-1',
        operation: 'start_run',
        idempotencyKey: 'client-key-1',
      }),
    ).toEqual({
      identity: {
        actorId: 'actor-1',
        workspaceId: 'workspace-1',
        operation: 'start_run',
        idempotencyKey: 'client-key-1',
      },
      advisoryLockKey: 'actor-1:workspace-1:start_run:client-key-1',
    });
  });

  it('derives the create_workspace no-workspace vector', () => {
    expect(
      deriveIdempotencyKey({
        actorId: 'actor-1',
        operation: 'create_workspace',
        idempotencyKey: 'client-key-2',
      }).advisoryLockKey,
    ).toBe('actor-1:create_workspace:client-key-2');
  });

  it('keeps the opaque caller key intact, including delimiters', () => {
    const result = deriveIdempotencyKey({
      actorId: 'actor-1',
      workspaceId: 'workspace-1',
      operation: 'start_run',
      idempotencyKey: 'client:key:3',
    });
    expect(result.identity.idempotencyKey).toBe('client:key:3');
  });

  it('scopes equality across actor, workspace, operation, and caller key', () => {
    const base = deriveIdempotencyKey({
      actorId: 'actor-1',
      workspaceId: 'workspace-1',
      operation: 'start_run',
      idempotencyKey: 'key-1',
    }).identity;
    expect(sameIdempotencyIdentity(base, { ...base })).toBe(true);
    expect(sameIdempotencyIdentity(base, { ...base, actorId: 'actor-2' })).toBe(false);
    expect(sameIdempotencyIdentity(base, { ...base, workspaceId: 'workspace-2' })).toBe(false);
    expect(sameIdempotencyIdentity(base, { ...base, operation: 'quote_run' })).toBe(false);
    expect(sameIdempotencyIdentity(base, { ...base, idempotencyKey: 'key-2' })).toBe(false);
  });

  it('enforces the API/database 1-200 character caller-key bound', () => {
    expect(() =>
      deriveIdempotencyKey({
        actorId: 'actor-1',
        workspaceId: 'workspace-1',
        operation: 'start_run',
        idempotencyKey: '',
      }),
    ).toThrow('between 1 and 200');
    expect(() =>
      deriveIdempotencyKey({
        actorId: 'actor-1',
        workspaceId: 'workspace-1',
        operation: 'start_run',
        idempotencyKey: 'x'.repeat(201),
      }),
    ).toThrow('between 1 and 200');
  });

  it('allows only create_workspace to omit workspace scope', () => {
    expect(() =>
      deriveIdempotencyKey({
        actorId: 'actor-1',
        operation: 'start_run',
        idempotencyKey: 'key-1',
      }),
    ).toThrow('Only create_workspace');
  });
});
