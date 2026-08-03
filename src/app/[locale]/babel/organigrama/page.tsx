'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import OrgChartBuilder from '@/components/babel/OrgChartBuilder';
import { useDisplayLang } from '@/components/display-lang-provider';

export default function OrganigramaPage() {
  const params = useParams();
  const routeLocale = params && (params as any).locale === 'en' ? 'en' : 'es';
  const { lang } = useDisplayLang();
  const [localLang, setLocalLang] = React.useState<'es' | 'en'>(routeLocale);
  React.useEffect(() => { setLocalLang(lang); }, [lang]);

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <OrgChartBuilder lang={localLang} />
      </div>
    </div>
  );
}
