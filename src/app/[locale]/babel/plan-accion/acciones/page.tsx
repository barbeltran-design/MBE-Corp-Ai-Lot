'use client';
import React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import AccionesPlanBuilder from '@/components/babel/AccionesPlanBuilder';
import { useDisplayLang } from '@/components/display-lang-provider';
import { esMentorValido, type MentorId } from '@/lib/mentores';

export default function AccionesPlanPage() {
  const params = useParams();
  const routeLocale = typeof params.locale === 'string' ? params.locale : 'es';
  const { lang } = useDisplayLang();
  const [localLang, setLocalLang] = React.useState<'es' | 'en'>(routeLocale === 'en' ? 'en' : 'es');
  React.useEffect(() => { setLocalLang(lang); }, [lang]);

  // Permite llegar aquí ya filtrado por mentor (agente de IA), por ejemplo
  // desde la Misión "Plan de Acción" de cada Mundo: /babel/plan-accion/acciones?mentor=Fisnando
  const searchParams = useSearchParams();
  const mentorParam = searchParams.get('mentor');
  const mentorInicial: MentorId | null = esMentorValido(mentorParam) ? mentorParam : null;

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <AccionesPlanBuilder lang={localLang} mentorInicial={mentorInicial} />
      </div>
    </div>
  );
}
