export interface CoreBindings extends PlatformBindings {
  readonly APP_ENV?: 'development' | 'test' | 'staging' | 'production';
  readonly CORS_ALLOWED_ORIGINS?: string;
  readonly SUPABASE_JWT_AUDIENCE?: string;
  readonly SUPABASE_URL?: string;
  readonly PROVIDER_RUNS_ENABLED?: string;
  readonly FAL_KEY?: string;
  readonly FAL_WEBHOOK_SECRET?: string;
}

export interface CoreVariables {
  requestId: string;
}

export interface CoreHonoEnvironment {
  Bindings: CoreBindings;
  Variables: CoreVariables;
}
