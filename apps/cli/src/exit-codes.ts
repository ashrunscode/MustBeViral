export const CLI_EXIT_CODES = Object.freeze({
  ok: 0,
  usage: 2,
  auth: 3,
  validation: 4,
  forbidden: 5,
  notFound: 6,
  conflict: 7,
  provider: 8,
  internal: 9,
});

export function exitCodeForApiError(code: string): number {
  switch (code) {
    case 'UNAUTHENTICATED':
      return CLI_EXIT_CODES.auth;
    case 'FORBIDDEN':
      return CLI_EXIT_CODES.forbidden;
    case 'NOT_FOUND':
      return CLI_EXIT_CODES.notFound;
    case 'VALIDATION_FAILED':
    case 'GRAPH_INVALID':
    case 'QUOTE_EXPIRED':
    case 'QUOTE_STALE':
    case 'SOURCE_UNSAFE':
    case 'SOURCE_UNSUPPORTED':
    case 'SOURCE_MALFORMED':
    case 'SOURCE_TOO_LARGE':
      return CLI_EXIT_CODES.validation;
    case 'IDEMPOTENCY_CONFLICT':
    case 'REVISION_CONFLICT':
    case 'RESOURCE_CONFLICT':
    case 'RESOURCE_ARCHIVED':
      return CLI_EXIT_CODES.conflict;
    case 'MODEL_UNAVAILABLE':
    case 'PROVIDER_REJECTED':
    case 'PROVIDER_AMBIGUOUS':
    case 'SOURCE_TIMEOUT':
    case 'SOURCE_UNREACHABLE':
    case 'SOURCE_INTERRUPTED':
    case 'SOURCE_EGRESS_UNAVAILABLE':
      return CLI_EXIT_CODES.provider;
    default:
      return CLI_EXIT_CODES.internal;
  }
}
