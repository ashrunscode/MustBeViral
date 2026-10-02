/**
 * The public origin the app is served from, read from the one public variable that names it.
 * Undefined when the variable is unset or malformed, so a page leaves absolute URLs out rather than
 * invent a host.
 */
export function publicOrigin(): string | undefined {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (origin === undefined) return undefined;
  try {
    return new URL(origin).origin;
  } catch {
    return undefined;
  }
}
