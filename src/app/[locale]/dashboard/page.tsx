'use client';

// ─────────────────────────────────────────────────────────────────────────
// ESTE ARCHIVO REEMPLAZA A: src/app/[locale]/dashboard/page.tsx
// (el que me confirmaste que ya existe — este es el mismo archivo, con
// las secciones de Fase 5 agregadas al final: estado del plan / pago,
// fase actual, y entregables por fase).
//
// CÓMO SUBIRLO:
// 1. En GitHub, entra a src/app/[locale]/dashboard/page.tsx
// 2. Clic en el ícono de lápiz (Edit this file)
// 3. Selecciona todo el contenido (Ctrl+A) y bórralo
// 4. Pega TODO el contenido de este archivo
// 5. Comitea directo en "main"
//
// Nota: agregué las secciones nuevas ("Tu plan" y "Tu progreso en Babel AI")
// con texto fijo en español, NO usan el sistema de traducciones (next-intl)
// que usa el resto de la página — así no tienes que editar también los
// archivos de idioma (es.json / en.json). Si más adelante quieres que
// también se traduzcan al inglés, dímelo y lo conecto al sistema de t().
// ─────────────────────────────────────────────────────────────────────────

// Fase 2/5 (stub): pantalla que recibe al usuario después del diagnóstico de
// madurez y en cada login posterior. Lee el último diagnóstico guardado,
// muestra el resumen tipo tabla pivote + gráficas + próximos pasos, y deja
// un espacio marcado para Babel AI (Fase 3) y el resto del Dashboard (Fase 5).
//
// Esta página, junto con el gate en onboarding/page.tsx, implementa el flujo
// obligatorio pedido por el usuario:
//   registro/login -> ¿tiene diagnóstico? -> no: onboarding, sí: aquí ->
//   aquí se muestran los próximos pasos por tema -> placeholder de Babel AI
//   (Fase 3) para el Mes 1 de Estrategia.
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';
import AgentAvatar from '@/components/agentes/AgentAvatar';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getLatestAssessmentAnswers } from '@/lib/assessment';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { getFirebaseAuth } from '@/lib/firebase';
import { getMaturityDimensions } from '@/lib/maturity-dimensions';
import { computeResults, type AssessmentResult } from '@/lib/maturity-scoring';
import type { Language } from '@/types/firestore';

// ── Tipos nuevos para Fase 5 (plan de pago + progreso Babel AI) ───────────
function DashboardPageInner() {
  const router = useRouter();
  const locale = useLocale() as Language;
  const t = useTranslations('dashboard');
  const tLevel = useTranslations('common.maturityLevel');

  const [user, setUser] = React.useState<User | null | undefined>(undefined);
  const [result, setResult] = React.useState<AssessmentResult | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  const dimensions = React.useMemo(() => getMaturityDimensions(locale), [locale]);

  // ── Estado nuevo para Fase 5 ─────────────────────────────────────────

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) router.replace(`/${locale}`);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const answers = await getLatestAssessmentAnswers(user.uid);
        if (cancelled) return;
        if (!answers) {
          setLoadError(true);
          return;
        }
        setResult(computeResults(dimensions, answers));
      } catch (err) {
        console.error('[MBE Dashboard] failed to load assessment', err);
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, locale]);

  if (user === undefined || (!result && !loadError)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-slate-400">{t('loading')}</p>
      </main>
    );
  }

  if (loadError || !result) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-slate-500">{t('loadError')}</p>
        <Button type="button" variant="primary" onClick={() => router.push(`/${locale}/onboarding`)}>
          {t('loadErrorCta')}
        </Button>
      </main>
    );
  }

  const radarData = result.dimensions.map((d) => ({ tema: d.tema, value: Math.round(d.score) }));
  const progressData = result.levelProgress.map((l) => ({ nivel: tLevel(l.key), avance: Math.round(l.percent) }));

  const en = locale === 'en';
  const pasosTour: TourStep[] = [
    {
      selector: '#dashboard-titulo',
      title: en ? 'Maturity Assessment' : 'Evaluación de Madurez',
      description: en
        ? 'This is the result of your assessment: global score and level reached by topic.'
        : 'Este es tu resultado del diagnóstico: puntaje global y nivel alcanzado por tema.',
    },
    {
      selector: '#dashboard-resumen',
      title: en ? 'Your overall result' : 'Tu resultado global',
      description: en
        ? 'Global score and maturity level of your business according to the assessment.'
        : 'Puntaje global y nivel de madurez de tu empresa según el diagnóstico.',
    },
    {
      selector: '#dashboard-graficas',
      title: en ? 'Charts by topic' : 'Gráficas por tema',
      description: en
        ? 'Compare your maturity per topic with the radar and the progress by maturity level.'
        : 'Compara tu madurez por tema con el radar y el avance por nivel de madurez.',
    },
    {
      selector: '#dashboard-tabla',
      title: en ? 'Table by topic' : 'Tabla por tema',
      description: en
        ? 'Review the score, level and next steps of each topic to improve.'
        : 'Revisa el puntaje, nivel y los siguientes pasos de cada tema para mejorar.',
    },
  ];

  return (
    <main className="px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div id="dashboard-titulo" className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AgentAvatar size={56} className="shrink-0" />
            <h1 className="text-2xl font-semibold text-slate-900">{t('welcomeTitle')}</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/onboarding?retake=true`)}
            className="text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
          >
            {t('retakeLink')}
          </button>
        </div>

        <div id="dashboard-resumen" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="p-6">
            <p className="text-sm text-slate-500">{t('maturityScoreLabel')}</p>
            <p className="mt-1 text-4xl font-bold text-emerald-600">{Math.round(result.overallScore)}%</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-slate-500">{t('maturityLevelLabel')}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{tLevel(result.overallLevel)}</p>
          </Card>
        </div>

        <div id="dashboard-graficas" className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-700">{t('radarTitle')}</h2>
            <div className="mt-4 h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="75%">
                  <PolarGrid />
                  <PolarAngleAxis dataKey="tema" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 120]} tick={{ fontSize: 9 }} />
                  <Radar name={t('maturityScoreLabel')} dataKey="value" stroke="#059669" fill="#059669" fillOpacity={0.35} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-700">{t('progressTitle')}</h2>
            <div className="mt-4 h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nivel" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="avance" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card id="dashboard-tabla" className="mt-8 overflow-x-auto p-6">
          <h2 className="text-sm font-semibold text-slate-700">{t('tableTitle')}</h2>
          <table className="mt-4 w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                <th className="py-2 pr-4">{t('colTema')}</th>
                <th className="py-2 pr-4">{t('colScore')}</th>
                <th className="py-2 pr-4">{t('colLevel')}</th>
                <th className="py-2 pr-4">{t('colPartialSteps')}</th>
                <th className="py-2 pr-4">{t('colNextStep')}</th>
              </tr>
            </thead>
            <tbody>
              {result.dimensions.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-4 font-medium text-slate-900">{d.tema}</td>
                  <td className="py-2 pr-4">{Math.round(d.score)}%</td>
                  <td className="py-2 pr-4">{tLevel(d.level)}</td>
                  <td className="py-2 pr-4 text-slate-500">
                    {d.enProgreso.length > 0 ? (
                      d.enProgreso.map((p, ki) => (
                        <div key={p.levelKey} className={ki > 0 ? 'mt-1.5' : undefined}>
                          {`${p.description} — ${p.deliverable}`}
                        </div>
                      ))
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 pr-4 text-slate-500">
                    {d.nextStep ? `${d.nextStep.description} — ${d.nextStep.deliverable}` : t('masteredLabel')}
                  </td>
                </tr>
              ))}
              <tr className="bg-emerald-50/50 font-semibold text-slate-900">
                <td className="py-2 pr-4">{t('totalRow')}</td>
                <td className="py-2 pr-4">{Math.round(result.overallScore)}%</td>
                <td className="py-2 pr-4">{tLevel(result.overallLevel)}</td>
                <td className="py-2 pr-4" />
              </tr>
            </tbody>
          </table>
        </Card>
      </div>
      <PageTour pageId="dashboard" steps={pasosTour} lang={locale === 'en' ? 'en' : 'es'} />
    </main>
  );
}

export default function DashboardPage() {
  return (
    <React.Suspense
      fallback={
      <main className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-slate-400">Cargando…</p>
        </main>
      }
    >
      <DashboardPageInner />
    </React.Suspense>
  );
}
