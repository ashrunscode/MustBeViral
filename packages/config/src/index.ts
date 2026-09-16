import { z } from 'zod';

const HttpUrlSchema = z
  .url()
  .refine((value) => value.startsWith('http://') || value.startsWith('https://'), {
    message: 'must use http or https',
  });

const HttpOriginSchema = HttpUrlSchema.refine(
  (value) =>
    /^https?:\/\/[^/?#]+$/u.test(value) && !value.slice(value.indexOf('//') + 2).includes('@'),
  {
    message:
      'must be an exact http or https origin without credentials, a path, query, fragment, or trailing slash',
  },
);

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

// This package compiles without DOM or Node typings, but every runtime that loads it (Node, browsers,
// Workers) has the WHATWG URL parser. Use it rather than a regex so the hostname checked here is the
// hostname a client would actually connect to.
const WhatwgUrl = (
  globalThis as unknown as {
    readonly URL: new (input: string) => Readonly<{ protocol: string; hostname: string }>;
  }
).URL;

/**
 * The collaboration API carries the ticket in the WebSocket handshake, so it must use TLS. Plain
 * http is accepted only for loopback development hosts.
 */
const CollaborationApiUrlSchema = HttpUrlSchema.refine(
  (value) => {
    let url: Readonly<{ protocol: string; hostname: string }>;
    try {
      url = new WhatwgUrl(value);
    } catch {
      return false;
    }
    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && LOOPBACK_HOSTNAMES.has(url.hostname))
    );
  },
  { message: 'must use https unless the host is localhost, 127.0.0.1 or [::1]' },
);

export const WebPublicEnvironmentSchema = z
  .object({
    NEXT_PUBLIC_APP_ORIGIN: HttpOriginSchema,
    NEXT_PUBLIC_SUPABASE_URL: HttpUrlSchema,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
    NEXT_PUBLIC_CORE_API_URL: HttpUrlSchema,
    NEXT_PUBLIC_COLLABORATION_API_URL: CollaborationApiUrlSchema.optional(),
  })
  .strict();

export const CoreEnvironmentSchema = z
  .object({
    APP_ENV: z.enum(['development', 'test', 'staging', 'production']),
    SUPABASE_URL: HttpUrlSchema,
    SUPABASE_JWT_AUDIENCE: z.string().min(1),
    CORS_ALLOWED_ORIGINS: z.string().min(1),
  })
  .strict();

export type WebPublicEnvironment = z.infer<typeof WebPublicEnvironmentSchema>;
export type CoreEnvironment = z.infer<typeof CoreEnvironmentSchema>;

export function parseWebPublicEnvironment(input: unknown): WebPublicEnvironment {
  return WebPublicEnvironmentSchema.parse(input);
}

export function parseCoreEnvironment(input: unknown): CoreEnvironment {
  return CoreEnvironmentSchema.parse(input);
}
