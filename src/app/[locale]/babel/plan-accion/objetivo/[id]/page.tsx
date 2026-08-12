'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import ObjetivoPlanBuilder from '@/components/babel/ObjetivoPlanBuilder';
import { useDisplayLang } from '@/components/display-lang-provider';

export default function ObjetivoPlanPage() {
  const params = useParams();
  const routeLocale = typeof params.locale === 'string' ? params.locale : 'es';
  const objetivoId = typeof params.id === 'string' ? params.id : '';
  const { lang } = useDisplayLang();
  const [localLang, setLocalLang] = React.useState<'es' | 'en'>(routeLocale === 'en' ? 'en' : 'es');
  React.useEffect(() => { setLocalLang(lang); }, [lang]);

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <ObjetivoPlanBuilder lang={localLang} objetivoId={objetivoId} />
      </div>
    </div>
  );
}
