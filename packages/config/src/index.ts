import { z } from 'zod';

const HttpUrlSchema = z
  .url()
  .refine((value) => value.startsWith('http://') || value.startsWith('https://'), {
    message: 'must use http or https',
  });

export const WebPublicEnvironmentSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: HttpUrlSchema,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
    NEXT_PUBLIC_CORE_API_URL: HttpUrlSchema,
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
