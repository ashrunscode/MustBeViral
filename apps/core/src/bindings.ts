export interface CoreBindings extends Omit<
  PlatformBindings,
  | 'APP_ENV'
  | 'CORS_ALLOWED_ORIGINS'
  | 'SUPABASE_JWT_AUDIENCE'
  | 'SUPABASE_PUBLISHABLE_KEY'
  | 'SUPABASE_URL'
  | 'PROVIDER_RUNS_ENABLED'
  | 'FAL_KEY'
  | 'FAL_WEBHOOK_URL'
  | 'FAL_WEBHOOK_SECRET'
  | 'MOONSHOT_API_KEY'
  | 'MEDIA_BUCKET'
  | 'SUPABASE_SECRET_KEY'
  | 'SUPABASE_SERVICE_ROLE_KEY'
> {
  readonly APP_ENV?: string;
  readonly CORS_ALLOWED_ORIGINS?: string;
  readonly SUPABASE_JWT_AUDIENCE?: string;
  readonly SUPABASE_PUBLISHABLE_KEY?: string;
  readonly SUPABASE_URL?: string;
  readonly PROVIDER_RUNS_ENABLED?: string;
  readonly FAL_KEY?: string;
  readonly FAL_WEBHOOK_URL?: string;
  /** Optional legacy HMAC fixture material. Live fal webhooks verify via public JWKS. */
  readonly FAL_WEBHOOK_SECRET?: string;
  readonly MOONSHOT_API_KEY?: string;
  readonly MEDIA_BUCKET: R2Bucket;
  readonly SUPABASE_SECRET_KEY?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
}

export interface CoreVariables {
  requestId: string;
}

export interface CoreHonoEnvironment {
  Bindings: CoreBindings;
  Variables: CoreVariables;
}
