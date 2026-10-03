import type { ReactNode } from 'react';

// Removing request APIs from the public roots must never prerender private recovery or identity.
export const dynamic = 'force-dynamic';

export default function StudioLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <>{children}</>;
}
