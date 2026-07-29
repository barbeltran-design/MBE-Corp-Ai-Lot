'use client';
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import IndicadoresBuilder from '@/components/babel/IndicadoresBuilder';
import { Button } from '@/components/ui/button';
import { useDisplayLang } from '@/components/display-lang-provider';

export default function IndicadoresPage() {
  const params = useParams();
  const router = useRouter();
  const routeLocale = typeof params.locale === 'string' ? params.locale : 'es';
  const [lang, setLang] = React.useState<'es' | 'en'>(routeLocale === 'en' ? 'en' : 'es');
  const { setLang: setCtxLang } = useDisplayLang();

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <Button onClick={function () { router.push('/' + routeLocale + '/babel'); }} variant="outline" size="sm">
            {lang === 'en' ? '← Back to Babel' : '← Volver a Babel'}
          </Button>
          <div className="flex gap-0.5 rounded-full border border-glass-border bg-glass p-0.5 text-xs">
            <button type="button" onClick={function () { setLang('es'); setCtxLang('es'); }} className={'rounded-full px-2.5 py-1 font-medium transition-colors ' + (lang === 'es' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>ES</button>
            <button type="button" onClick={function () { setLang('en'); setCtxLang('en'); }} className={'rounded-full px-2.5 py-1 font-medium transition-colors ' + (lang === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>EN</button>
          </div>
        </div>
        <IndicadoresBuilder lang={lang} />
      </div>
    </div>
  );
}
