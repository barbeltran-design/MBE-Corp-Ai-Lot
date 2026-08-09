'use client';
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import IndicadoresBuilder from '@/components/babel/Indicadores/IndicadoresBuilder';
import { Button } from '@/components/ui/button';

export default function IndicadoresPage() {
  const params = useParams();
  const router = useRouter();
  const routeLocale = typeof params.locale === 'string' ? params.locale : 'es';
  const [lang, setLang] = React.useState<'es' | 'en'>(routeLocale === 'en' ? 'en' : 'es');

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <Button onClick={function () { router.push('/' + routeLocale + '/babel'); }} variant="outline" size="sm">
            {lang === 'en' ? '← Back to Babel' : '← Volver a Babel'}
          </Button>
          <div className="flex gap-1.5">
            <button type="button" onClick={function () { setLang('es'); }} className={'rounded-full px-3 py-1 text-xs font-medium ' + (lang === 'es' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600')}>ES</button>
            <button type="button" onClick={function () { setLang('en'); }} className={'rounded-full px-3 py-1 text-xs font-medium ' + (lang === 'en' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600')}>EN</button>
          </div>
        </div>
        <IndicadoresBuilder lang={lang} />
      </div>
    </div>
  );
}
