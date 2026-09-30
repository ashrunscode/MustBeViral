'use client';

import { useEffect } from 'react';

export function DocumentLang({ lang }: Readonly<{ lang: string }>) {
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [lang]);
  return null;
}
