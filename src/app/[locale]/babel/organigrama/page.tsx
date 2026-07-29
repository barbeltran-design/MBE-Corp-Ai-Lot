'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import OrgChartBuilder from '@/components/babel/OrgChartBuilder';
import { useDisplayLang } from '@/components/display-lang-provider';

export default function OrganigramaPage() {
  const params = useParams();
  const routeLocale = params && (params as any).locale === 'en' ? 'en' : 'es';
  const [lang, setLang] = React.useState<'es' | 'en'>(routeLocale);
  const { setLang: setCtxLang } = useDisplayLang();

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <Link href={'/' + routeLocale + '/babel'} className="text-sm font-medium text-blue-600 hover:underline">
            {lang === 'en' ? '\u2190 Back to Babel' : '\u2190 Volver a Babel'}
          </Link>
          <div className="flex gap-0.5 rounded-full border border-glass-border bg-glass p-0.5 text-xs">
            <button
              type="button"
              onClick={function () { setLang('es'); setCtxLang('es'); }}
              className={'rounded-full px-2.5 py-1 font-medium transition-colors ' + (lang === 'es' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              ES
            </button>
            <button
              type="button"
              onClick={function () { setLang('en'); setCtxLang('en'); }}
              className={'rounded-full px-2.5 py-1 font-medium transition-colors ' + (lang === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              EN
            </button>
          </div>
        </div>

        <OrgChartBuilder lang={lang} />
      </div>
    </div>
  );
}
