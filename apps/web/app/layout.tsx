import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { headers } from 'next/headers';

import { lightfieldTokens } from '@mustbeviral/ui';
import '@mustbeviral/ui/styles.css';
import { WebVitalsReporter } from '../src/components/web-vitals-reporter';
import { DOCUMENT_LANG_HEADER, parseDocumentLang } from '../src/lib/document-lang';
import './globals.css';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

function metadataBase(): URL | undefined {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (origin === undefined) return undefined;
  try {
    return new URL(origin);
  } catch {
    return undefined;
  }
}

const base = metadataBase();

export const metadata: Metadata = {
  ...(base === undefined ? {} : { metadataBase: base }),
  title: { default: 'Must Be Viral', template: '%s | Must Be Viral' },
  description: 'Must Be Viral',
  // The logo system is owner-gated at draft (brand/context.md section 13). An empty data URL stops
  // every page from requesting a favicon that does not exist, without inventing a mark.
  icons: { icon: 'data:,' },
};

export const viewport: Viewport = {
  themeColor: lightfieldTokens.color.paper,
  colorScheme: 'light',
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const lang = parseDocumentLang((await headers()).get(DOCUMENT_LANG_HEADER));
  return (
    <html lang={lang}>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <WebVitalsReporter />
        {children}
      </body>
    </html>
  );
}
