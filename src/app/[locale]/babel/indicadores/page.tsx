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
  const { lang } = useDisplayLang();
  const [localLang, setLocalLang] = React.useState<'es' | 'en'>(routeLocale === 'en' ? 'en' : 'es');
  React.useEffect(() => { setLocalLang(lang); }, [lang]);

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <Button onClick={function () { router.push('/' + routeLocale + '/babel'); }} variant="outline" size="sm">
            {localLang === 'en' ? '← Back to Babel' : '← Volver a Babel'}
          </Button>
        </div>
        <IndicadoresBuilder lang={localLang} />
      </div>
    </div>
  );
}
