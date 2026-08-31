import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';

import '@mustbeviral/ui/styles.css';
import { WebVitalsReporter } from '../src/components/web-vitals-reporter';
import './globals.css';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'MustBeViral Studio',
  description: 'DTC campaign launch packs powered by ViralGraph.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <WebVitalsReporter />
        {children}
      </body>
    </html>
  );
}
