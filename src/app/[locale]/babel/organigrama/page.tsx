'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import OrgChartBuilder from '@/components/babel/OrgChartBuilder';

export default function OrganigramaPage() {
  const params = useParams();
  const routeLocale = params && (params as any).locale === 'en' ? 'en' : 'es';
  const [lang, setLang] = React.useState<'es' | 'en'>(routeLocale);

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <Link href={'/' + routeLocale + '/babel'} className="text-sm font-medium text-blue-600 hover:underline">
            {lang === 'en' ? '\u2190 Back to Babel' : '\u2190 Volver a Babel'}
          </Link>
          <div className="flex gap-1 rounded-full border border-slate-200 bg-white p-1 text-xs">
            <button
              type="button"
              onClick={function () {
                setLang('es');
              }}
              className={'rounded-full px-3 py-1 font-medium ' + (lang === 'es' ? 'bg-slate-800 text-white' : 'text-slate-500')}
            >
              ES
            </button>
            <button
              type="button"
              onClick={function () {
                setLang('en');
              }}
              className={'rounded-full px-3 py-1 font-medium ' + (lang === 'en' ? 'bg-slate-800 text-white' : 'text-slate-500')}
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
