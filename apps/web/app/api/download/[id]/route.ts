import { IdentifierSchema } from '@mustbeviral/contracts';

import { readWebPublicEnvironment } from '../../../../src/config/public-environment';
import { createServerSupabaseClient } from '../../../../src/lib/supabase/server';

const SAFE_ARTIFACT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/u;
const SAFE_TOKEN_PART = /^[A-Za-z0-9_-]+$/u;
const SAFE_CONTENT_LENGTH = /^\d{1,20}$/u;
const SAFE_ATTACHMENT = /^attachment;\s*filename="[A-Za-z0-9][A-Za-z0-9._-]{0,199}"$/iu;
const SAFE_CONTENT_TYPES = new Set([
  'application/json',
  'application/octet-stream',
  'application/zip',
]);
const PASSTHROUGH_ERROR_STATUSES = new Set([400, 401, 403, 404, 410, 429]);

interface DownloadRouteContext {
  readonly params: Promise<Readonly<{ id: string }>>;
}

function privateNoStoreHeaders(): Headers {
  return new Headers({
    'cache-control': 'private, no-store',
    expires: '0',
    pragma: 'no-cache',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status, headers: privateNoStoreHeaders() });
}

function validArtifactId(value: string): boolean {
  return IdentifierSchema.safeParse(value).success && SAFE_ARTIFACT_ID.test(value);
}

function validCapabilityToken(value: string | null): value is string {
  if (value === null || value.length > 8_192) return false;
  const [payload, signature, ...rest] = value.split('.');
  return (
    payload !== undefined &&
    payload.length > 0 &&
    signature !== undefined &&
    signature.length === 43 &&
    rest.length === 0 &&
    SAFE_TOKEN_PART.test(payload) &&
    SAFE_TOKEN_PART.test(signature)
  );
}

async function sessionAccessToken(): Promise<string | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const subject = claimsData?.claims?.sub;
    if (claimsError !== null || typeof subject !== 'string' || subject.length === 0) return null;

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (
      sessionError !== null ||
      session === null ||
      session.user.id !== subject ||
      session.access_token.length === 0
    ) {
      return null;
    }
    return session.access_token;
  } catch {
    return null;
  }
}

function safeDownloadHeaders(upstream: Response): Headers {
  const headers = privateNoStoreHeaders();
  const contentType = upstream.headers.get('content-type');
  if (contentType !== null && SAFE_CONTENT_TYPES.has(contentType.toLowerCase())) {
    headers.set('content-type', contentType);
  }
  const contentLength = upstream.headers.get('content-length');
  if (contentLength !== null && SAFE_CONTENT_LENGTH.test(contentLength)) {
    headers.set('content-length', contentLength);
  }
  const contentDisposition = upstream.headers.get('content-disposition');
  if (contentDisposition !== null && SAFE_ATTACHMENT.test(contentDisposition)) {
    headers.set('content-disposition', contentDisposition);
  }
  return headers;
}

export async function GET(request: Request, context: DownloadRouteContext): Promise<Response> {
  const { id } = await context.params;
  const requestUrl = new URL(request.url);
  const tokenValues = requestUrl.searchParams.getAll('token');
  const hasOnlyToken = [...requestUrl.searchParams.keys()].every((key) => key === 'token');
  const token = tokenValues[0] ?? null;
  if (
    !validArtifactId(id) ||
    tokenValues.length !== 1 ||
    !hasOnlyToken ||
    !validCapabilityToken(token)
  ) {
    return emptyResponse(400);
  }

  const accessToken = await sessionAccessToken();
  if (accessToken === null) return emptyResponse(401);

  let coreApiUrl: string;
  try {
    coreApiUrl = readWebPublicEnvironment().NEXT_PUBLIC_CORE_API_URL.replace(/\/$/u, '');
  } catch {
    return emptyResponse(503);
  }
  const upstreamUrl = `${coreApiUrl}/v1/artifacts/${encodeURIComponent(id)}/content?${new URLSearchParams({ token }).toString()}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        accept: 'application/zip, application/octet-stream;q=0.9',
        authorization: `Bearer ${accessToken}`,
        'cache-control': 'no-store',
      },
      cache: 'no-store',
      redirect: 'manual',
      signal: request.signal,
    });
  } catch {
    return emptyResponse(502);
  }

  if (upstream.status !== 200 || upstream.body === null) {
    const status = PASSTHROUGH_ERROR_STATUSES.has(upstream.status) ? upstream.status : 502;
    return emptyResponse(status);
  }
  return new Response(upstream.body, {
    status: 200,
    headers: safeDownloadHeaders(upstream),
  });
}
