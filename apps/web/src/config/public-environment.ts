import { parseWebPublicEnvironment, type WebPublicEnvironment } from '@mustbeviral/config';

export function readWebPublicEnvironment(
  source: Readonly<Record<string, string | undefined>> = process.env,
): WebPublicEnvironment {
  return parseWebPublicEnvironment({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CORE_API_URL: source.NEXT_PUBLIC_CORE_API_URL,
  });
}
