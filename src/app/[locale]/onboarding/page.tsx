'use client';

// Fase 2: diagnóstico de madurez — asistente de preguntas. Los resultados
// completos (gráficas, tabla resumen, próximos pasos) viven en /dashboard;
// esta página solo hace las 11 preguntas, guarda el diagnóstico y redirige.
//
// Flujo obligatorio pedido por el usuario:
//  1. register-form.tsx manda a cualquier usuario recién autenticado aquí.
//  2. Esta página revisa users/{uid}.assessmentCompleted en Firestore.
//  3. Si ya es true (y no viene ?retake=true en la URL) -> redirige a /dashboard.
//  4. Si no -> muestra el cuestionario de 11 temas x 6 niveles.
//  5. Al terminar, guarda el diagnóstico y redirige a /dashboard, donde
//     Babel AI (Fase 3) leerá estos datos para iniciar el Mes 1 de Estrategia.
import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { getMaturityDimensions } from '@/lib/maturity-dimensions';
import { emptyAnswers, computeResults, type Answer, type DimensionAnswers } from '@/lib/maturity-scoring';
import { saveAssessment, getLatestAssessmentAnswers } from '@/lib/assessment';
import type { Language, UserDoc } from '@/types/firestore';

// Rellena el objeto de respuestas con todas las llaves/posiciones válidas:
// conserva yes/partial/no y convierte el resto a null (sin responder).
function mergeAnswers(saved: Partial<DimensionAnswers>): DimensionAnswers {
  const merged = emptyAnswers();
  for (const id of Object.keys(merged) as (keyof DimensionAnswers)[]) {
    const arr = saved[id];
    if (Array.isArray(arr)) {
      merged[id] = merged[id].map((_v, i) => {
        const s = arr[i];
        return s === 'yes' || s === 'partial' || s === 'no' ? s : null;
      });
    }
  }
  return merged;
}

// Borrador en curso de localStorage: devuelve las respuestas SOLO si tienen
// al menos una respuesta real. Un borrador vacío (de un intento anterior sin
// responder) se ignora para no bloquear la precarga desde Firestore.
function loadDraft(): DimensionAnswers | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('mbe-assessment-draft');
    if (!raw) return null;
    const merged = mergeAnswers(JSON.parse(raw) as Partial<DimensionAnswers>);
    const hasAny = Object.values(merged).some((arr) => arr.some((v) => v !== null));
    return hasAny ? merged : null;
  } catch (err) {
    console.error('[MBE Assessment] failed to load draft', err);
    return null;
  }
}

export default function OnboardingPage() {
  const t = useTranslations('assessment');
  return (
    <React.Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-white">
          <p className="text-sm text-slate-400">{t('loading')}</p>
        </main>
      }
    >
      <OnboardingInner />
    </React.Suspense>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale() as Language;
  const t = useTranslations('assessment');
  const tLevel = useTranslations('common.maturityLevel');

  const DRAFT_KEY = 'mbe-assessment-draft';

  const isRetake = searchParams.get('retake') === 'true';

  const [user, setUser] = React.useState<User | null | undefined>(undefined);
  const [gate, setGate] = React.useState<'checking' | 'ready'>('checking');
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<DimensionAnswers>(() => loadDraft() ?? emptyAnswers());
  const [finishing, setFinishing] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Al cambiar de tema (siguiente/anterior), sube suavemente a la primera
  // pregunta. Corre en un efecto para que el DOM ya esté actualizado con el
  // nuevo paso antes de calcular el scroll.
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      } catch {
        window.scrollTo(0, 0);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [step]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem('mbe-assessment-draft', JSON.stringify(answers));
    } catch (err) {
      console.error('[MBE Assessment] failed to persist draft', err);
    }
  }, [answers]);

  const dimensions = React.useMemo(() => getMaturityDimensions(locale), [locale]);

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
        const draft = loadDraft();
        const snap = await getDoc(doc(getFirebaseDb(), 'users', user.uid));
        const data = snap.data() as UserDoc | undefined;
        if (cancelled) return;
        if (!isRetake && data?.assessmentCompleted) {
          router.replace(`/${locale}/inicio`);
          return;
        }
        // Sin borrador en curso: precarga el último diagnóstico guardado
        // (así "repetir diagnóstico" conserva las respuestas previas).
        if (!draft) {
          const saved = await getLatestAssessmentAnswers(user.uid);
          if (cancelled) return;
          if (saved) setAnswers(mergeAnswers(saved));
        }
        setGate('ready');
      } catch (err) {
        console.error('[MBE Assessment] failed to check completion status', err);
        // Fail open: let them take the assessment rather than get stuck on a spinner.
        if (!cancelled) setGate('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isRetake]);

  const totalSteps = dimensions.length;
  const currentDimension = step < totalSteps ? dimensions[step] : null;

  function setAnswer(levelIndex: number, value: Answer) {
    if (!currentDimension) return;
    setAnswers((prev) => {
      const next = { ...prev, [currentDimension.id]: [...prev[currentDimension.id]] };
      next[currentDimension.id][levelIndex] = value;
      return next;
    });
  }

  const currentStepComplete = currentDimension
    ? answers[currentDimension.id].every((a) => a !== null)
    : false;

  async function handleFinish() {
    if (!user) return;
    setFinishing(true);
    setSaveError(null);
    try {
      const result = computeResults(dimensions, answers);
      await saveAssessment(user.uid, answers, result);
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // best effort
      }
      router.push(`/${locale}/inicio`);
    } catch (err) {
      console.error('[MBE Assessment] failed to save', err);
      setSaveError(t('saveError'));
      setFinishing(false);
    }
  }

  function handleNext() {
    if (step < totalSteps - 1) {
      setStep(step + 1);
      return;
    }
    void handleFinish();
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  if (user === undefined || gate !== 'ready') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-slate-400">{t('loading')}</p>
      </main>
    );
  }

  if (!currentDimension) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 to-white px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="sticky top-14 z-10 -mx-6 border-b border-slate-200 bg-card/95 px-6 pb-4 pt-2 backdrop-blur-sm dark:border-slate-700">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            {t('stepLabel', { current: step + 1, total: totalSteps })}
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
            <div
              className="h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">{currentDimension.tema}</h1>
          <p className="mt-1 text-sm text-slate-500">{currentDimension.explicacion}</p>
        </div>

        <Card className="mt-6 p-6 sm:p-8">

          <div className="mt-6 space-y-6">
            {currentDimension.levels.map((level, i) => (
              <div key={level.key} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{tLevel(level.key)}</p>
                <p className="mt-1 text-sm text-slate-700">{level.description}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {t('expectedEvidence')} {level.deliverable}
                </p>
                <div className="mt-3 flex gap-2">
                  {(['yes', 'partial', 'no'] as Answer[]).map((value) => {
                    const selected = answers[currentDimension.id][i] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAnswer(i, value)}
                        className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {t(`answers.${value}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {saveError && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{saveError}</p>}

          <div className="mt-8 flex justify-between">
            <Button type="button" variant="outline" onClick={handleBack} disabled={step === 0 || finishing}>
              {t('back')}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleNext}
              disabled={!currentStepComplete || finishing}
            >
              {finishing
                ? t('finishing')
                : step === totalSteps - 1
                  ? saveError
                    ? t('retry')
                    : t('finish')
                  : t('next')}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
