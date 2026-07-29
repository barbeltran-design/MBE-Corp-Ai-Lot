'use client';
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import PlanAccionBuilder from '@/components/babel/PlanAccionBuilder';
import { Button } from '@/components/ui/button';
import { useDisplayLang } from '@/components/display-lang-provider';

export default function PlanAccionPage() {
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
          <Button
            onClick={function () {
              router.push('/' + routeLocale + '/babel');
            }}
            variant="outline"
            size="sm"
          >
            {localLang === 'en' ? '\u2190 Back to Babel' : '\u2190 Volver a Babel'}
          </Button>
        </div>
        <PlanAccionBuilder lang={localLang} />
      </div>
    </div>
  );
}
