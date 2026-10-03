import Script from 'next/script';

/** Zod 4.4.3 reads this shared config on import; the CSP forbids its eval probe. */
export function BrowserValidationScript() {
  return (
    <Script id="mbv-browser-validation" strategy="beforeInteractive">
      {'globalThis.__zod_globalConfig ??= {}; globalThis.__zod_globalConfig.jitless = true;'}
    </Script>
  );
}
