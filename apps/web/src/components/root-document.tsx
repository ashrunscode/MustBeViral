import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';

import { lightfieldTokens } from '@mustbeviral/ui';
import '@mustbeviral/ui/styles.css';
import { WebVitalsReporter } from './web-vitals-reporter';
import type { DocumentLang } from '../lib/document-lang';
import { publicOrigin } from '../lib/public-origin';
import '../../app/globals.css';
import { BrowserValidationScript } from '../../app/browser-validation';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  metadataBase: new URL(publicOrigin()),
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

/** One font/style source for the static language roots and the complete global not-found page. */
export default function RootDocument({
  children,
  lang,
}: Readonly<{ children: ReactNode; lang: DocumentLang }>) {
  return (
    <html lang={lang}>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <BrowserValidationScript />
        <WebVitalsReporter />
        {children}
      </body>
    </html>
  );
}
