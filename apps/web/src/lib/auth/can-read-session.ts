/**
 * The public pages only redirect a signed-in visitor to the studio when the browser client can
 * actually read the session. Without both public Supabase values the pages render signed out.
 */
export function canReadSession(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
