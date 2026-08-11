export function createMutationIdempotencyKey(scope: string): string {
  const normalizedScope = scope.replace(/[^a-z0-9_-]/giu, '-').slice(0, 40) || 'mutation';
  const randomId = globalThis.crypto?.randomUUID?.();
  const unique =
    randomId ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  return `web-${normalizedScope}-${unique}`;
}
