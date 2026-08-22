'use client';

// Fase 2: diagnóstico de madurez — asistente de preguntas, un nivel a la vez.
// Los resultados completos (gráficas, tabla resumen, próximos pasos) viven en
// /dashboard; esta página solo hace las 11 temas x 6 niveles, guarda el
// diagnóstico y redirige.
//
// Flujo obligatorio pedido por el usuario:
//  1. register-form.tsx manda a cualquier usuario recién autenticado aquí.
//  2. Esta página revisa users/{uid}.assessmentCompleted en Firestore.
//  3. Si ya es true (y no viene ?retake=true en la URL) -> redirige a /dashboard.
//  4. Si no -> muestra el cuestionario de 11 temas x 6 niveles, un nivel a la
//     vez, con "Ver referencias" para expandir/contraer la explicación y el
//     ejemplo de evidencia (menos texto visible por defecto).
//  5. Al terminar cada tema: celebración breve + elegir "Continuar con el
//     siguiente tema" o "Guardar y continuar después".
//  6. Al terminar TODA la evaluación: guarda el diagnóstico, completa
//     automáticamente la Misión 1 del Mundo de Partida (sin botón manual),
//     celebra la insignia "Diagnóstico Completo" la primera vez, y redirige a
//     /dashboard, donde Babel AI (Fase 3) leerá estos datos.
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
import { insigniasVistas, marcarInsigniasVistas } from '@/lib/insignias';
import { InsigniaCelebracion } from '@/components/worlds/InsigniaCelebracion';
import type { Language, UserDoc } from '@/types/firestore';

const DRAFT_KEY = 'mbe-assessment-draft';
const POSITION_KEY = 'mbe-assessment-position';
const LEVELS_PER_TEMA = 6;

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
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const merged = mergeAnswers(JSON.parse(raw) as Partial<DimensionAnswers>);
    const hasAny = Object.values(merged).some((arr) => arr.some((v) => v !== null));
    return hasAny ? merged : null;
  } catch (err) {
    console.error('[MBE Assessment] failed to load draft', err);
    return null;
  }
}

// Posición (tema/nivel) donde el usuario se quedó la última vez que guardó y
// salió a mitad del diagnóstico. Se valida contra los límites reales para
// nunca dejar al usuario fuera de rango si cambió el número de temas.
function loadPosition(maxStep: number): { step: number; levelStep: number } {
  if (typeof window === 'undefined') return { step: 0, levelStep: 0 };
  try {
    const raw = window.localStorage.getItem(POSITION_KEY);
    if (!raw) return { step: 0, levelStep: 0 };
    const parsed = JSON.parse(raw) as { step?: unknown; levelStep?: unknown };
    const s = Number(parsed.step);
    const l = Number(parsed.levelStep);
    const step = Number.isFinite(s) && s >= 0 && s < maxStep ? s : 0;
    const levelStep = Number.isFinite(l) && l >= 0 && l < LEVELS_PER_TEMA ? l : 0;
    return { step, levelStep };
  } catch {
    return { step: 0, levelStep: 0 };
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

  const isRetake = searchParams.get('retake') === 'true';

  const [user, setUser] = React.useState<User | null | undefined>(undefined);
  const [gate, setGate] = React.useState<'checking' | 'ready'>('checking');
  const [step, setStep] = React.useState(0);
  const [levelStep, setLevelStep] = React.useState(0);
  const [phase, setPhase] = React.useState<'question' | 'temaDone'>('question');
  const [showRef, setShowRef] = React.useState(false);
  const [answers, setAnswers] = React.useState<DimensionAnswers>(() => loadDraft() ?? emptyAnswers());
  const [finishing, setFinishing] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [badgeToCelebrate, setBadgeToCelebrate] = React.useState<string | null>(null);
  // Array `partida` (misiones completadas del Mundo de Partida) devuelto por
  // /api/worlds justo después de auto-completar la Misión 1, para decidir si
  // hay que ofrecer la Misión 2 (Objetivos Estratégicos) o no.
  const [partidaDespues, setPartidaDespues] = React.useState<number[] | null>(null);
  const [showMission2Prompt, setShowMission2Prompt] = React.useState(false);

  // Al cambiar de tema/nivel, sube suavemente al inicio de la tarjeta.
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      } catch {
        window.scrollTo(0, 0);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [step, levelStep, phase]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
    } catch (err) {
      console.error('[MBE Assessment] failed to persist draft', err);
    }
  }, [answers]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(POSITION_KEY, JSON.stringify({ step, levelStep }));
    } catch {
      // Si localStorage no está disponible, simplemente no se podrá reanudar
      // exactamente en el mismo nivel — no es crítico.
    }
  }, [step, levelStep]);

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
          router.replace(`/${locale}/dashboard`);
          return;
        }
        if (!draft) {
          // Sin borrador en curso: precarga el último diagnóstico guardado
          // (así "repetir diagnóstico" conserva las respuestas previas).
          const saved = await getLatestAssessmentAnswers(user.uid);
          if (cancelled) return;
          if (saved) setAnswers(mergeAnswers(saved));
        } else {
          // Hay borrador: retoma exactamente en el tema/nivel donde se quedó.
          const pos = loadPosition(dimensions.length);
          setStep(pos.step);
          setLevelStep(pos.levelStep);
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
  const currentLevel = currentDimension ? currentDimension.levels[levelStep] : null;
  const isLastTema = step === totalSteps - 1;

  function setAnswer(levelIndex: number, value: Answer) {
    if (!currentDimension) return;
    setAnswers((prev) => {
      const next = { ...prev, [currentDimension.id]: [...prev[currentDimension.id]] };
      next[currentDimension.id][levelIndex] = value;
      return next;
    });
    // Avanza solo tras un momento breve, para que se alcance a ver la
    // selección antes de pasar al siguiente nivel (150–300ms recomendado).
    window.setTimeout(() => {
      if (levelIndex < LEVELS_PER_TEMA - 1) {
        setLevelStep(levelIndex + 1);
        setShowRef(false);
      } else {
        setPhase('temaDone');
      }
    }, 220);
  }

  function handleBack() {
    if (phase === 'temaDone') {
      setPhase('question');
      return;
    }
    if (levelStep > 0) {
      setLevelStep(levelStep - 1);
      setShowRef(false);
      return;
    }
    if (step > 0) {
      setStep(step - 1);
      setLevelStep(LEVELS_PER_TEMA - 1);
      setShowRef(false);
    }
  }

  function handleContinueNextTema() {
    setStep((s) => Math.min(s + 1, totalSteps - 1));
    setLevelStep(0);
    setShowRef(false);
    setPhase('question');
  }

  function handleSaveAndContinueLater() {
    // answers y position ya están guardados en localStorage por los efectos
    // de arriba en cada cambio, así que basta con salir.
    router.push(`/${locale}/dashboard`);
  }

  async function handleFinish() {
    if (!user) return;
    setFinishing(true);
    setSaveError(null);
    try {
      const result = computeResults(dimensions, answers);
      await saveAssessment(user.uid, answers, result);
      try {
        window.localStorage.removeItem(DRAFT_KEY);
        window.localStorage.removeItem(POSITION_KEY);
      } catch {
        // best effort
      }
      // Auto-completa la Misión 1 (Evaluación de Madurez) del Mundo de
      // Partida, sin necesidad de un botón manual — mismo endpoint y patrón
      // que usa WorldsBuilder.completarMision(1). La respuesta trae el
      // arreglo `partida` (misiones ya completadas), que usamos después para
      // decidir si hay que ofrecer la Misión 2 (Objetivos Estratégicos).
      let partidaResp: number[] | null = null;
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/worlds', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'completar-mision', mision: 1 }),
        });
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.partida)) partidaResp = data.partida;
      } catch (missionErr) {
        // No bloquea el flujo: si ya estaba completada (retake) o falla la
        // red, el usuario igual debe ver su reporte de madurez.
        console.error('[MBE Assessment] failed to auto-complete mission 1', missionErr);
      }
      setPartidaDespues(partidaResp);
      const yaVista = insigniasVistas(user.uid).includes('diagnostico_completo');
      if (!yaVista) {
        setBadgeToCelebrate('diagnostico_completo');
      } else {
        avanzarDespuesDeCelebracion(partidaResp);
      }
    } catch (err) {
      console.error('[MBE Assessment] failed to save', err);
      setSaveError(t('saveError'));
      setFinishing(false);
    }
  }

  // Tras cerrar (o saltarse) la celebración de la insignia: si el usuario
  // todavía no tiene la Misión 2 (Objetivos Estratégicos) completada, se le
  // ofrece el prompt condicional; si ya la tiene, va directo al dashboard.
  function avanzarDespuesDeCelebracion(partida: number[] | null) {
    const faltaMision2 = !Array.isArray(partida) || !partida.includes(2);
    if (faltaMision2) {
      setShowMission2Prompt(true);
    } else {
      router.push(`/${locale}/dashboard`);
    }
  }

  function closeBadgeCelebration() {
    if (user) {
      marcarInsigniasVistas(user.uid, [...insigniasVistas(user.uid), 'diagnostico_completo']);
    }
    setBadgeToCelebrate(null);
    avanzarDespuesDeCelebracion(partidaDespues);
  }

  if (user === undefined || gate !== 'ready') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-slate-400">{t('loading')}</p>
      </main>
    );
  }

  if (!currentDimension || !currentLevel) return null;

  const overallDone = step * LEVELS_PER_TEMA + (phase === 'temaDone' ? LEVELS_PER_TEMA : levelStep);
  const overallTotal = totalSteps * LEVELS_PER_TEMA;
  const progressPct = Math.min(100, Math.round((overallDone / overallTotal) * 100));

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 to-white px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <div className="sticky top-14 z-10 -mx-4 border-b border-slate-200 bg-card/95 px-4 pb-4 pt-2 backdrop-blur-sm dark:border-slate-700 sm:-mx-6 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            {t('stepLabel', { current: step + 1, total: totalSteps })}
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
            <div
              className="h-1.5 rounded-full bg-emerald-600 transition-all duration-300 dark:bg-emerald-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">
            {currentDimension.tema}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{currentDimension.explicacion}</p>
        </div>

        {phase === 'question' ? (
          <Card className="mt-6 p-5 sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                {t('levelOf', { current: levelStep + 1, total: LEVELS_PER_TEMA })}
              </span>
              <div className="flex gap-1.5" aria-hidden>
                {Array.from({ length: LEVELS_PER_TEMA }).map((_v, i) => (
                  <span
                    key={i}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i < levelStep
                        ? 'bg-emerald-600'
                        : i === levelStep
                          ? 'bg-emerald-600 ring-2 ring-emerald-200 dark:ring-emerald-900'
                          : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              {currentLevel.tutorial.nivel}
            </h2>
            <p className="mt-1 text-base font-medium text-emerald-700 dark:text-emerald-400">
              {currentLevel.tutorial.pregunta}
            </p>

            <button
              type="button"
              onClick={() => setShowRef((v) => !v)}
              aria-expanded={showRef}
              className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
            >
              {showRef ? t('hideReferences') : t('showReferences')}
              <span aria-hidden>{showRef ? '▲' : '▼'}</span>
            </button>

            {showRef && (
              <div className="mt-2 space-y-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/50">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('levelExplanationLabel')}
                  </p>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">{currentLevel.tutorial.explicacion}</p>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">{currentLevel.description}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('evidenceExampleLabel')}
                  </p>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">{currentLevel.deliverable}</p>
                </div>
              </div>
            )}

            <p className="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('doYouMeetIt')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['yes', 'partial', 'no'] as Answer[]).map((value) => {
                const selected = answers[currentDimension.id][levelStep] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAnswer(levelStep, value)}
                    className={`min-h-11 flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.97] sm:min-w-[110px] sm:flex-none ${
                      selected
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    {t(`answers.${value}`)}
                  </button>
                );
              })}
            </div>

            {saveError && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{saveError}</p>}

            <div className="mt-8 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={(step === 0 && levelStep === 0) || finishing}
              >
                {t('back')}
              </Button>
              <span className="text-xs text-slate-400">
                {step + 1}/{totalSteps} · {levelStep + 1}/{LEVELS_PER_TEMA}
              </span>
            </div>
          </Card>
        ) : (
          <Card className="mt-6 p-6 text-center sm:p-10">
            <div className="text-5xl" aria-hidden>
              ✅
            </div>
            {isLastTema ? (
              showMission2Prompt ? (
                <>
                  <h2 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
                    {t('mission2PromptTitle')}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('mission2PromptBody')}</p>
                  <div className="mt-6 flex flex-col items-center gap-3">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => router.push(`/${locale}/babel/indicadores`)}
                      className="min-h-11 w-full sm:w-auto"
                    >
                      {t('goToMission2')} →
                    </Button>
                    <button
                      type="button"
                      onClick={() => router.push(`/${locale}/dashboard`)}
                      className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
                    >
                      {t('keepExploring')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
                    {t('allDoneTitle')}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('allDoneBody')}</p>
                  {saveError && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{saveError}</p>}
                  <div className="mt-6 flex flex-col items-center gap-3">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => void handleFinish()}
                      disabled={finishing}
                      className="min-h-11 w-full sm:w-auto"
                    >
                      {finishing ? t('finishing') : saveError ? t('retry') : t('finish')}
                    </Button>
                    <button
                      type="button"
                      onClick={handleBack}
                      className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
                    >
                      {t('back')}
                    </button>
                  </div>
                </>
              )
            ) : (
              <>
                <h2 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
                  {t('temaCompleteTitle')}
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {t('temaCompleteBody', { tema: currentDimension.tema })}
                </p>
                <div className="mt-6 flex flex-col items-center gap-3">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleContinueNextTema}
                    className="min-h-11 w-full sm:w-auto"
                  >
                    {t('continueNextTema')} →
                  </Button>
                  <button
                    type="button"
                    onClick={handleSaveAndContinueLater}
                    className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
                  >
                    {t('saveAndContinueLater')}
                  </button>
                </div>
              </>
            )}
          </Card>
        )}
      </div>

      <InsigniaCelebracion
        insigniaId={badgeToCelebrate}
        lang={locale === 'en' ? 'en' : 'es'}
        onClose={closeBadgeCelebration}
      />
    </main>
  );
}
