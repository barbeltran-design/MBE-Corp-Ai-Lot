'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import ConvocatoriasBuilder from '@/components/babel/ConvocatoriasBuilder';
import { useDisplayLang } from '@/components/display-lang-provider';

export default function ConvocatoriasPage() {
  const params = useParams();
  const routeLocale = typeof params.locale === 'string' ? params.locale : 'es';
  const { lang } = useDisplayLang();
  const [localLang, setLocalLang] = React.useState<'es' | 'en'>(routeLocale === 'en' ? 'en' : 'es');
  React.useEffect(() => { setLocalLang(lang); }, [lang]);

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <ConvocatoriasBuilder lang={localLang} />
      </div>
    </div>
  );
}
