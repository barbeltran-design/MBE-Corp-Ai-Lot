'use client';

import React from 'react';
import Link from 'next/link';
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
        <div className="mb-4 flex items-center justify-between">
          <Link href={'/' + routeLocale + '/babel'} className="text-sm font-medium text-blue-600 hover:underline">
            {localLang === 'en' ? '\u2190 Back to Babel' : '\u2190 Volver a Babel'}
          </Link>
        </div>

        <OrgChartBuilder lang={localLang} />
      </div>
    </div>
  );
}
