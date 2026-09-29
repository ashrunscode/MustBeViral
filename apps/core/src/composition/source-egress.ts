import type { CoreBindings } from '../bindings';

const ALLOWED_HEADERS = ['accept', 'accept-language', 'user-agent'] as const;

export class SourceCaptureEgressUnavailableError extends Error {
  readonly code = 'SOURCE_EGRESS_UNAVAILABLE' as const;
  constructor() {
    super('Public-only source capture egress is not configured');
    this.name = 'SourceCaptureEgressUnavailableError';
  }
}

export type SourceCaptureRequest = string | URL | Request;

export interface SourceCaptureEgress {
  readonly mode: 'public-egress-binding' | 'strict-public-global-fetch' | 'synthetic-test-seam';
  fetch(input: SourceCaptureRequest, init?: RequestInit): Promise<Response>;
}

function publicCaptureRequest(input: SourceCaptureRequest, init?: RequestInit): Request {
  const incoming = input instanceof Request ? input : new Request(input, init);
  const extra = new Headers(init?.headers);
  const headers = new Headers();
  for (const name of ALLOWED_HEADERS) {
    const value = extra.get(name) ?? incoming.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Request(incoming.url, {
    method: 'GET',
    headers,
    redirect: 'manual',
    signal: init?.signal ?? incoming.signal,
  });
}

export function createSourceCaptureEgress(
  bindings: Pick<CoreBindings, 'PUBLIC_EGRESS' | 'APP_ENV'>,
  options?: { readonly syntheticFetch?: typeof fetch },
): SourceCaptureEgress {
  if (options?.syntheticFetch) {
    return {
      mode: 'synthetic-test-seam',
      fetch: (input, init) => options.syntheticFetch!(publicCaptureRequest(input, init)),
    };
  }
  if (bindings.PUBLIC_EGRESS !== undefined) {
    const fetcher = bindings.PUBLIC_EGRESS;
    return {
      mode: 'public-egress-binding',
      fetch: (input, init) => fetcher.fetch(publicCaptureRequest(input, init)),
    };
  }
  if (bindings.APP_ENV === 'staging' || bindings.APP_ENV === 'production') {
    return {
      mode: 'strict-public-global-fetch',
      fetch: (input, init) => fetch(publicCaptureRequest(input, init)),
    };
  }
  throw new SourceCaptureEgressUnavailableError();
}
