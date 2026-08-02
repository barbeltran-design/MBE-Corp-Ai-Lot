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
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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

import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { getMaturityDimensions } from '@/lib/maturity-dimensions';
import { computeResults, type AssessmentResult } from '@/lib/maturity-scoring';
import { getLatestAssessmentAnswers } from '@/lib/assessment';
import type { Language } from '@/types/firestore';

// ── Tipos nuevos para Fase 5 (plan de pago + progreso Babel AI) ───────────
type UserDoc = {
  subscription?: string;
  planStatus?: string;
};

type PhaseEntry = {
  phase: number;
  summary?: string;
  approved?: boolean;
};

type SessionDoc = {
  currentPhase?: number;
  phases?: PhaseEntry[];
};

function DashboardPageInner() {
  const router = useRouter();
  const locale = useLocale() as Language;
  const t = useTranslations('dashboard');
  const tLevel = useTranslations('common.maturityLevel');
  const searchParams = useSearchParams();
  const pagoParam = searchParams.get('pago'); // 'exitoso' | 'fallido' | 'pendiente' | null

  const [user, setUser] = React.useState<User | null | undefined>(undefined);
  const [result, setResult] = React.useState<AssessmentResult | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  const dimensions = React.useMemo(() => getMaturityDimensions(locale), [locale]);

  // key del nivel (execution, standard, ...) -> definición con descripción y
  // evidencia, para redactar los pasos parcialmente trabajados en la tabla.
  const levelsByKey = React.useMemo(() => {
    const map = new Map<string, { key: string; description: string; deliverable: string }>();
    for (const dim of dimensions) {
      for (const level of dim.levels) {
        map.set(level.key, level);
      }
    }
    return map;
  }, [dimensions]);

  // ── Estado nuevo para Fase 5 ─────────────────────────────────────────
  const [userDoc, setUserDoc] = React.useState<UserDoc | null>(null);
  const [sessionDoc, setSessionDoc] = React.useState<SessionDoc | null>(null);
  const [payLoading, setPayLoading] = React.useState(false);
  const [payError, setPayError] = React.useState<string | null>(null);

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

  // ── Carga nueva para Fase 5: plan de pago + sesión de Babel AI ───────
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const db = getFirebaseDb();
        const [userSnap, sessionSnap] = await Promise.all([
          getDoc(doc(db, 'users', user.uid)),
          getDoc(doc(db, 'sessions', `babel_${user.uid}`)),
        ]);
        if (cancelled) return;
        setUserDoc(userSnap.exists() ? (userSnap.data() as UserDoc) : null);
        setSessionDoc(sessionSnap.exists() ? (sessionSnap.data() as SessionDoc) : null);
      } catch (err) {
        console.error('[MBE Dashboard] failed to load plan/session data', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handlePagar() {
    if (!user) return;
    setPayLoading(true);
    setPayError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/pagos/crear-preferencia', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'No se pudo iniciar el pago.');
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error(err);
      setPayError('No se pudo iniciar el pago. Intenta de nuevo en unos segundos.');
      setPayLoading(false);
    }
  }

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
  const esPro = userDoc?.subscription === 'pro' && userDoc?.planStatus === 'active';

  return (
    <main className="px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">{t('welcomeTitle')}</h1>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/onboarding?retake=true`)}
            className="text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
          >
            {t('retakeLink')}
          </button>
        </div>

        {/* ── Banners de resultado de pago (Fase 5) ──────────────────── */}
        {pagoParam === 'exitoso' && (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Tu pago se está confirmando. En unos segundos verás tu plan activado aquí abajo.
          </div>
        )}
        {pagoParam === 'pendiente' && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Tu pago quedó pendiente de confirmación por Mercado Pago.
          </div>
        )}
        {pagoParam === 'fallido' && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            El pago no se completó. Puedes intentarlo de nuevo cuando quieras.
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="p-6">
            <p className="text-sm text-slate-500">{t('maturityScoreLabel')}</p>
            <p className="mt-1 text-4xl font-bold text-emerald-600">{Math.round(result.overallScore)}%</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-slate-500">{t('maturityLevelLabel')}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{tLevel(result.overallLevel)}</p>
          </Card>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
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

        <Card className="mt-8 overflow-x-auto p-6">
          <h2 className="text-sm font-semibold text-slate-700">{t('tableTitle')}</h2>
          <table className="mt-4 w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                <th className="py-2 pr-4">{t('colTema')}</th>
                <th className="py-2 pr-4">{t('colScore')}</th>
                <th className="py-2 pr-4">{t('colLevel')}</th>
                <th className="py-2 pr-4">{t('colPartialSteps')}</th>
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
                      d.enProgreso.map((k, ki) => {
                        const def = levelsByKey.get(k);
                        return (
                          <div key={k} className={ki > 0 ? 'mt-1.5' : undefined}>
                            {def ? `${def.description} — ${def.deliverable}` : k}
                          </div>
                        );
                      })
                    ) : (
                      '—'
                    )}
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

        {/* ── Tu plan (Fase 5) ────────────────────────────────────────── */}
        <Card className="mt-8 p-6">
          <h2 className="text-sm font-semibold text-slate-700">Tu plan</h2>
          {esPro ? (
            <p className="mt-2 text-sm font-medium text-emerald-700">Plan completo activo.</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-500">
                Estás en el diagnóstico gratuito. Desbloquea el plan completo para acceder a todas las herramientas.
              </p>
              <Button className="mt-4" onClick={handlePagar} disabled={payLoading}>
                {payLoading ? 'Abriendo Mercado Pago…' : 'Pagar plan completo'}
              </Button>
              {payError && <p className="mt-2 text-sm text-red-600">{payError}</p>}
            </>
          )}
        </Card>

        {/* ── Tu progreso en Babel AI + entregables por fase (Fase 5) ─── */}
        {sessionDoc && (sessionDoc.currentPhase !== undefined || (sessionDoc.phases && sessionDoc.phases.length > 0)) && (
          <Card className="mt-8 p-6">
            <h2 className="text-sm font-semibold text-slate-700">Tu progreso en Babel AI</h2>
            {sessionDoc.currentPhase !== undefined && (
              <p className="mt-2 text-sm text-slate-600">
                Fase actual: <span className="font-semibold text-slate-900">{sessionDoc.currentPhase}</span>
              </p>
            )}
            {sessionDoc.phases && sessionDoc.phases.length > 0 && (
              <div className="mt-4 space-y-2">
                {[...sessionDoc.phases]
                  .sort((a, b) => a.phase - b.phase)
                  .map((p) => (
                    <details key={p.phase} className="rounded-md border border-slate-100 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-slate-800">
                        Fase {p.phase} {p.approved ? '— aprobada' : '— pendiente de aprobación'}
                      </summary>
                      <div className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                        {p.summary || 'Sin resumen disponible.'}
                      </div>
                    </details>
                  ))}
              </div>
            )}
          </Card>
        )}

        <Card className="mt-8 p-6 text-center">
          <h2 className="text-sm font-semibold text-slate-700">{t('babelTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('babelBody')}</p>
          <Button className="mt-4" onClick={() => router.push(`/${locale}/babel`)}>
            {t('babelCta')}
          </Button>
        </Card>
      </div>
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
