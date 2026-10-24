import { type ReactNode } from 'react';
export type Language = 'fa' | 'en';
export function languageProps(language: Language) {
  return { lang: language, dir: language === 'fa' ? ('rtl' as const) : ('ltr' as const) };
}
/** Isolate Latin identifiers from the surrounding Persian sentence. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <bdi dir="ltr" lang="en" data-code>
      {children}
    </bdi>
  );
}
