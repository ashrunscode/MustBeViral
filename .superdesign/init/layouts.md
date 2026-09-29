# Layout components — ViralGraph cleanroom V2

One layout exists: the Next.js App Router root layout. Full source:

```tsx
// apps/web/app/layout.tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'MustBeViral Studio',
  description: 'DTC campaign launch packs powered by ViralGraph.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

No nested layouts, templates, route groups, or parallel routes. The target product layout (per `docs/ux/EXPERIENCE_CONTRACT.md`) is: left tool rail, central infinite canvas, right inspector, top project/run controls, collapsible bottom activity/output panel — none of which is implemented yet.
