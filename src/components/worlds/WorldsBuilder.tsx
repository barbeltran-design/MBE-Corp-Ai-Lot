'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useDisplayLang } from '@/components/display-lang-provider';
import { useTheme } from '@/components/theme-provider';
import BabelAvatar from '@/components/babel/BabelAvatar';
import { getLatestAssessmentAnswers } from '@/lib/assessment';
import { getMaturityDimensions } from '@/lib/maturity-dimensions';
import { nivelDesdePuntos } from '@/lib/club';
import {
  MISIONES_PART_LABELS,
  SUBMUNDOS_ESTRATEGIA_LABELS,
  MUNDOS_PREMIUM_LABELS,
  nivelLabelPuntos,
} from '@/lib/worlds';
import { WorldsBg } from '@/components/worlds/worlds-bg';

type Vista = 'mapa' | 'partida' | 'tablero' | 'estrategia';

interface Progreso {
  nombre: string;
  puntos: number;
  nivel: string;
  partida: number[];
  tablero: boolean;
}

// Traducciones es/en (estilo de los builders existentes).
const I = {
  cargando: ['Cargando el mapa de mundos…', 'Loading the worlds map…'],
  sinSesion: ['Inicia sesión para comenzar tu partida.', 'Sign in to start your game.'],
  volver: ['← Volver al mapa', '← Back to the map'],
  chipPuntos: ['Puntos del Club', 'Club points'],
  chipRacha: ['Racha', 'Streak'],
  rachaDemo: ['4 días (Fase B real)', '4 days (real in Phase B)'],
  saludo: ['¡Hola', 'Hi'],
  progreso: ['Tu progreso', 'Your progress'],
  misionesDe: ['misiones', 'missions'],
  partidaEnCurso: ['Mundo de Partida en curso', 'Starting World in progress'],
  partidaCompleta: ['Mundo de Partida ✓ completo', 'Starting World ✓ complete'],
  tableroBloqueado: ['Tablero: bloqueado', 'Board: locked'],
  tableroListo: ['Tablero: desbloqueado ✓', 'Board: unlocked ✓'],
  estrategiaCurso: ['Estrategia (premium) en curso', 'Strategy (premium) in progress'],
  gratisTag: ['Gratis · Activo', 'Free · Active'],
  mundoPartida: ['Mundo de Partida', 'Starting World'],
  mundoPartidaDesc: [
    'Anfitrión Babel · 5 misiones para calibrar tu empresa antes de la aventura. Al completarlas desbloqueas el Tablero de Retos.',
    'Hosted by Babel · 5 missions to calibrate your company before the adventure. Completing them unlocks the Challenges Board.',
  ],
  entrarPartida: ['► Entrar al mundo', '► Enter the world'],
  tableroCard: ['Tablero de Retos', 'Challenges Board'],
  tableroDesc: [
    'Retos semanales y mensuales sobre tus 11 temas de madurez. Se desbloquea terminando el Mundo de Partida.',
    'Weekly and monthly challenges over your 11 maturity topics. Unlocks by finishing the Starting World.',
  ],
  reqTablero: ['🔒 Requisito: «Calibración Inicial»', '🔒 Requirement: «Initial Calibration»'],
  tagUnlock: ['Desbloqueado', 'Unlocked'],
  tagLock: ['Bloqueado', 'Locked'],
  premTitle: ['Mundos Premium', 'Premium Worlds'],
  premKey: ['🔑 plan_mensual', '🔑 monthly plan'],
  enConstruccion: ['En construcción', 'Under construction'],
  verMundo: ['► Ver mundo', '► View world'],
  host: ['Anfitrión', 'Host'],
  submundos: ['submundos', 'subworlds'],
  faseALista: ['Fase A lista', 'Phase A ready'],
  wipMundo: ['🔨 Este mundo estará disponible en la siguiente fase.', '🔨 This world will be available in the next phase.'],
  misAnterior: ['🔒 Completa primero la misión anterior.', '🔒 Complete the previous mission first.'],
  misNum: ['Misión', 'Mission'],
  repetible: ['Repetible (3m)', 'Repeatable (3m)'],
  completadaTag: ['Completada', 'Completed'],
  pts: ['pts', 'pts'],
  rutaReal: ['Ruta real', 'Real route'],
  abrirHerramienta: ['Abrir herramienta', 'Open tool'],
  jugarMision: ['🎖 Jugar misión', '🎖 Play mission'],
  cerrarMision: ['⭐ Completar misión final', '⭐ Complete final mission'],
  terminando: ['Completando…', 'Completing…'],
  tiendaPartida: ['🛠️ Tienda del Mundo de Partida', '🛠️ Starting World shop'],
  tiendaPartidaDesc: [
    'Herramientas gratuitas que abren su versión real dentro de la plataforma.',
    'Free tools that open their real version inside the platform.',
  ],
  checklist: ['Checklist de arranque', 'Startup checklist'],
  fondos: ['Fondos sin prisa', 'Grant finder'],
  mapaMadurez: ['Mapa de madurez', 'Maturity map'],
  listoTag: ['Listo', 'Ready'],
  enCursoTag: ['En curso', 'In progress'],
  pendienteTag: ['Pendiente', 'Pending'],
  abrirSub: ['Abrir submundo', 'Open subworld'],
  tiendaEstrategia: ['🛠️ Tienda del Mundo Estrategia', '🛒 Strategy World shop'],
  tiendaEstrategiaDesc: [
    'Herramientas para aplicar cada fase a tu empresa (demo en esta fase).',
    'Tools to apply each phase to your company (demo in this phase).',
  ],
  canvas: ['Canvas Propuesta de Valor', 'Value Proposition Canvas'],
  foda: ['Matriz FODA', 'SWOT Matrix'],
  plantilla: ['Plantilla Plan de Acción', 'Action Plan Template'],
  toolToast: ['Herramienta descargada (demo)', 'Tool downloaded (demo)'],
  retoSemanal: ['Reto semanal — Finanzas · Nivel 2 (Estándar)', 'Weekly challenge — Finance · Level 2 (Standard)'],
  retoSemanalDesc: [
    'Práctica: «Controla tu flujo de caja» · Anfitrión: Fisnando. Completa las 5 casillas para el cofre semanal (+20 pts). La agenda real llega en la siguiente fase.',
    'Practice: "Control your cash flow" · Host: Fisnando. Complete the 5 tiles for the weekly chest (+20 pts). Real scheduling arrives in the next phase.',
  ],
  retoMensual: ['Reto mensual — una práctica por agente', 'Monthly challenge — one practice per agent'],
  retoMensualDesc: [
    'Practica con cada agente según tu Plan de Madurez (demo).',
    'Practice with each agent from your Maturity Plan (demo).',
  ],
  mapaProgreso: ['Mapa de progreso · 11 temas × 6 niveles', 'Progress map · 11 topics × 6 levels'],
  tema: ['Tema', 'Topic'],
  leyendaMapa: [
    'Verde = dominado · Ámbar = en curso · Rojo = pendiente. Los retos semanales/mensuales reales llegan en la Fase B.',
    'Green = mastered · Amber = in progress · Red = pending. Real weekly/monthly challenges arrive in Phase B.',
  ],
  sinEvaluacion: [
    'Aún no tienes evaluación. Llena la Evaluación de Madurez para poblar tu mapa.',
    'No assessment yet. Complete the Maturity Assessment to fill your map.',
  ],
  tableroLockedTitle: ['Tablero bloqueado', 'Board locked'],
  tableroLockedDesc: [
    'Completa el Mundo de Partida (incluida la Calibración Inicial) para desbloquear el Tablero de Retos.',
    'Complete the Starting World (including the Initial Calibration) to unlock the Challenges Board.',
  ],
  irCalibracion: ['→ Ir a la Calibración Inicial', '→ Go to the Initial Calibration'],
  misionCompleta: ['¡Misión completada!', 'Mission complete!'],
  tableroGanado: ['¡Tablero de Retos desbloqueado!', 'Challenges Board unlocked!'],
  errorProcesar: ['No se pudo procesar la acción.', 'Could not process the action.'],
  temaAria: ['Cambiar tema claro/oscuro', 'Toggle light/dark theme'],
} as const;

type Params = readonly [string, string];
const t2 = (lang: 'es' | 'en') => (p: Params) => (lang === 'en' ? p[1] : p[0]);

function Confetti({ seed }: { seed: number }) {
  const hosts = React.useMemo(() => {
    if (seed <= 0) return [];
    const colors = ['#0d9488', '#f59e0b', '#f472b6', '#a78bfa', '#34d399', '#38bdf8'];
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: colors[i % colors.length],
      dur: 1.4 + Math.random() * 1.9,
      delay: Math.random() * 0.6,
    }));
  }, [seed]);
  if (seed <= 0) return null;
  return (
    <div className="world-confetti-host">
      {hosts.map((h) => (
        <i
          key={`${seed}-${h.id}`}
          style={{ left: `${h.left}vw`, background: h.color, animationDuration: `${h.dur}s`, animationDelay: `${h.delay}s` }}
        />
      ))}
    </div>
  );
}

export function WorldsBuilder() {
  const router = useRouter();
  const pathname = usePathname();
  const { lang, setLang } = useDisplayLang();
  const { theme, toggleTheme } = useTheme();
  const T = t2(lang === 'es' ? 'es' : 'en');
  const en = (p: Params) => T(p);

  const navigateLang = (newLang: 'es' | 'en') => {
    setLang(newLang);
    const segments = pathname.split('/');
    if (segments[1] === 'es' || segments[1] === 'en') {
      segments[1] = newLang;
    }
    router.replace(segments.join('/'));
  };

  const [yo, setYo] = React.useState<Progreso | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [vista, setVista] = React.useState<Vista>('mapa');
  const [toast, setToast] = React.useState<string | null>(null);
  const [confettiSeed, setConfettiSeed] = React.useState(0);
  const [completando, setCompletando] = React.useState<number | null>(null);
  const [uid, setUid] = React.useState<string | null>(null);
  const [respuestas, setRespuestas] = React.useState<Record<string, string[]> | null>(null);

  const notificar = React.useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2900);
  }, []);

  const festejar = React.useCallback(() => {
    const seed = Date.now();
    setConfettiSeed(seed);
    window.setTimeout(() => setConfettiSeed(0), 4300);
  }, []);

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (usr: User | null) => {
      if (!usr) {
        setCargando(false);
        return;
      }
      setUid(usr.uid);
      try {
        const token = await usr.getIdToken();
        const res = await fetch('/api/worlds', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = (await res.json()) as { yo: Progreso };
          setYo(data.yo);
        }
      } catch (err) {
        console.error('[worlds] carga', err);
      }
      setCargando(false);
    });
    return () => unsub();
  }, []);

  React.useEffect(() => {
    if (!uid || !yo?.tablero) return;
    let vivo = true;
    getLatestAssessmentAnswers(uid)
      .then((answers) => {
        if (!vivo || !answers) return;
        const mapa: Record<string, string[]> = {};
        for (const id of Object.keys(answers)) {
          mapa[id] = (answers as unknown as Record<string, string[]>)[id];
        }
        setRespuestas(mapa);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [uid, yo?.tablero]);

  async function completarMision(n: number) {
    if (!yo || completando !== null) return;
    if (n > 1 && !yo.partida.includes(n - 1)) {
      notificar(en(I.misAnterior));
      return;
    }
    const auth = getFirebaseAuth();
    const usr = auth.currentUser;
    if (!usr) return;
    setCompletando(n);
    try {
      const token = await usr.getIdToken();
      const res = await fetch('/api/worlds', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'completar-mision', mision: n }),
      });
      const data = await res.json();
      if (res.ok) {
        setYo((prev) =>
          prev
            ? {
                ...prev,
                puntos: data.puntos,
                partida: data.partida,
                tablero: data.tablero,
                nivel: nivelDesdePuntos(data.puntos),
              }
            : prev
        );
        festejar();
        notificar(`+${data.pts} ${en(I.pts)} · ${n === 5 ? en(I.tableroGanado) : en(I.misionCompleta)}`);
        if (n === 5) setVista('mapa');
      } else {
        notificar(String(data.error ?? en(I.errorProcesar)));
      }
    } catch (err) {
      notificar(en(I.errorProcesar));
    } finally {
      setCompletando(null);
    }
  }

  const hechas = yo?.partida ?? [];

  return (
    <div className="relative min-h-screen">
      <WorldsBg />
      <Confetti seed={confettiSeed} />
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[99] w-max max-w-[92vw] -translate-x-1/2 rounded-full border border-teal-300/50 bg-[#0b2430]/90 px-5 py-3 text-sm font-bold text-white shadow-2xl backdrop-blur-xl">
          ⭐ {toast}
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="world-glass world-grain mb-6 flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2 text-lg font-extrabold text-slate-800 dark:text-white">
            <span className="text-2xl">🌍</span> MBE <span className="text-teal-600 dark:text-teal-300">Worlds</span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-100">
            <span className="rounded-full border border-teal-300/60 bg-white/50 px-3 py-1.5 backdrop-blur-md dark:bg-white/10">
              🪙 {yo ? yo.puntos.toLocaleString('en-US') : '—'} {en(I.pts)} · {en(I.chipPuntos)}
            </span>
            <span className="rounded-full border border-fuchsia-300/60 bg-white/50 px-3 py-1.5 backdrop-blur-md dark:bg-white/10">
              ⭐ {yo ? nivelLabelPuntos(yo.nivel, lang === 'es' ? 'es' : 'en') : '—'}
            </span>
            <span className="rounded-full border border-amber-300/60 bg-white/50 px-3 py-1.5 backdrop-blur-md dark:bg-white/10">
              🔥 {en(I.chipRacha)} {en(I.rachaDemo)}
            </span>
            {/* Selector de idioma (como las demás páginas) */}
            <span className="flex gap-0.5 rounded-full border border-teal-300/60 bg-white/50 p-0.5 backdrop-blur-md dark:bg-white/10">
              <button
                type="button"
                onClick={() => navigateLang('es')}
                className={'rounded-full px-2.5 py-1 transition-colors ' + (lang === 'es' ? 'bg-teal-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:text-teal-600')}
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => navigateLang('en')}
                className={'rounded-full px-2.5 py-1 transition-colors ' + (lang === 'en' ? 'bg-teal-500 text-white' : 'text-slate-600 dark:text-slate-300 hover:text-teal-600')}
              >
                EN
              </button>
            </span>
            {/* Tema claro/oscuro */}
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-full border border-teal-300/60 bg-white/50 px-3 py-1.5 transition hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/20"
              aria-label={en(I.temaAria)}
              title={en(I.temaAria)}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        <div className="world-glass mb-6 flex items-start gap-4 p-5">
          <BabelAvatar size={56} state="talking" className="shrink-0" />
          <div className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-100">
            <p>
              <b className="text-teal-700 dark:text-teal-300">
                {en(I.saludo)}
                {yo?.nombre ? `, ${yo.nombre}!` : '!'} —
              </b>{' '}
              {vista === 'partida'
                ? en([
                    'Esto no es un curso, ejecutivo: es tu partida. 5 misiones para calibrar tu empresa; al cerrar la Calibración Inicial se desbloquea el 🎯 Tablero.',
                    'This is not a course, executive: this is your game. Complete the 5 missions; the Initial Calibration unlocks the 🎯 Board.',
                  ])
                : vista === 'tablero'
                  ? en([
                      'Tu tablero juega con tu evaluación: cada celda es una práctica. Las verdes ya las dominas; los retos salen de tu Plan de Madurez.',
                      'Your board plays with your evaluation: every tile is a practice. Green tiles are already yours; challenges come from your Maturity Plan.',
                    ])
                  : vista === 'estrategia'
                    ? en([
                        'El motor de tu empresa. Cada submundo se alimenta de tu Reflexión Estratégica y tu Plan de Acción: cierra el ciclo y recibe el sello de Estratega.',
                        'The engine of your company. Every subworld is fed by your Strategic Reflection and Action Plan: close the loop and earn the Strategist seal.',
                      ])
                    : en([
                        'Bienvenido/a: este es tu mapa. Visita los mundos, completa misiones y desbloquea el Tablero de Retos. Tu partida empieza en el Mundo de Partida.',
                        'Welcome: this is your map. Explore the worlds, complete missions and unlock the Challenges Board. Your game starts in the Starting World.',
                      ])}
            </p>
          </div>
        </div>

        {cargando ? (
          <div className="world-glass p-10 text-center text-sm text-slate-600 dark:text-slate-300">{en(I.cargando)}</div>
        ) : !yo ? (
          <div className="world-glass p-10 text-center text-sm text-slate-600 dark:text-slate-300">{en(I.sinSesion)}</div>
        ) : (
          <>
            {vista !== 'mapa' && (
              <button
                className="world-glass world-glass-hover mb-5 px-4 py-2 text-sm font-extrabold text-slate-700 dark:text-slate-100"
                onClick={() => setVista('mapa')}
              >
                {en(I.volver)}
              </button>
            )}

            {vista === 'mapa' && (
              <>
                <div className="world-glass world-grain mb-5 p-5">
                  <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">🗺️ {en(I.progreso)}</h2>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-400/25">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-fuchsia-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (hechas.length / 5) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {hechas.length}/5 {en(I.misionesDe)} · {hechas.length === 5 ? en(I.partidaCompleta) : en(I.partidaEnCurso)} ·{' '}
                    {yo.tablero ? en(I.tableroListo) : en(I.tableroBloqueado)} · {en(I.estrategiaCurso)}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <button className="world-glass world-glass-hover world-grain p-5 text-left" onClick={() => setVista('partida')}>
                    <span className="mb-2 inline-block rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                      {en(I.gratisTag)}
                    </span>
                    <div className="text-4xl">🎓</div>
                    <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">{en(I.mundoPartida)}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.mundoPartidaDesc)}</p>
                    <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">
                      {en(I.entrarPartida)} · {hechas.length}/5
                    </p>
                  </button>

                  <button
                    className="world-glass world-glass-hover world-grain p-5 text-left"
                    onClick={() => (yo.tablero ? setVista('tablero') : notificar(en(I.reqTablero)))}
                  >
                    <span
                      className={`mb-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                        yo.tablero
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {yo.tablero ? en(I.tagUnlock) : en(I.tagLock)}
                    </span>
                    <div className="text-4xl">🎯</div>
                    <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">{en(I.tableroCard)}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.tableroDesc)}</p>
                    <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">{en(I.reqTablero)}</p>
                  </button>
                </div>

                <h2 className="mb-3 mt-8 text-lg font-extrabold text-slate-800 dark:text-white">
                  {en(I.premTitle)}{' '}
                  <span className="ml-1 inline-block rounded-full border border-amber-300/70 bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-extrabold text-amber-700 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200">
                    {en(I.premKey)}
                  </span>
                </h2>

                <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <button className="world-glass world-glass-hover world-grain p-5 text-left" onClick={() => setVista('estrategia')}>
                    <span className="mb-2 inline-block rounded-full bg-fuchsia-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-200">
                      Premium
                    </span>
                    <div className="text-4xl">🧭</div>
                    <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">Estrategia</h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {en(I.host)} <b>Babel</b> · {SUBMUNDOS_ESTRATEGIA_LABELS.length} {en(I.submundos)} · {en(I.faseALista)}.
                    </p>
                    <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">{en(I.verMundo)}</p>
                  </button>

                  {MUNDOS_PREMIUM_LABELS.map((m) => (
                    <div key={m.id} className="world-glass world-grain p-5 opacity-75">
                      <span className="mb-2 inline-block rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {en(I.enConstruccion)}
                      </span>
                      <div className="text-4xl">{m.icon}</div>
                      <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">{lang === 'en' ? m.en : m.es}</h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {en(I.host)} <b>{m.agente}</b> · {m.subs} {en(I.submundos)} · {lang === 'en' ? m.enDesc : m.esDesc}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {vista === 'partida' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {MISIONES_PART_LABELS.map((m) => {
                    const done = hechas.includes(m.n);
                    const bloqueada = m.n > 1 && !hechas.includes(m.n - 1);
                    const repetible = 'repetible' in m && m.repetible;
                    return (
                      <div key={m.n} className={`world-glass world-grain p-5 ${bloqueada && !done ? 'opacity-70' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                              done
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                                : repetible
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
                                  : 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-200'
                            }`}
                          >
                            {done ? en(I.completadaTag) : repetible ? en(I.repetible) : `${en(I.misNum)} ${m.n}`}
                          </span>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-extrabold text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                            +{m.pts} {en(I.pts)}
                          </span>
                        </div>
                        <div className="mt-3 text-4xl">{m.icon}</div>
                        <h3 className="mt-1 text-base font-extrabold text-slate-800 dark:text-white">
                          {en(I.misNum)} {m.n} · {lang === 'en' ? m.en : m.es}
                        </h3>
                        <div className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{lang === 'en' ? m.enDesc : m.esDesc}</div>
                        <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          📍 {en(I.rutaReal)}: {m.ruta}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
                            onClick={() => router.push(m.ruta)}
                          >
                            {en(I.abrirHerramienta)} →
                          </button>
                          {!done && (
                            <button
                              className="rounded-lg border border-teal-400/60 bg-white/40 px-3 py-1.5 text-xs font-extrabold text-teal-700 backdrop-blur-md transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/10 dark:text-teal-200 dark:hover:bg-white/20"
                              disabled={bloqueada || completando !== null}
                              onClick={() => completarMision(m.n)}
                            >
                              {completando === m.n ? en(I.terminando) : 'final' in m && m.final ? en(I.cerrarMision) : en(I.jugarMision)}
                            </button>
                          )}
                          {done && <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">✓ {en(I.completadaTag)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="world-glass world-grain mt-6 p-5">
                  <h2 className="text-base font-extrabold text-slate-800 dark:text-white">{en(I.tiendaPartida)}</h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{en(I.tiendaPartidaDesc)}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      { icon: '📋', name: en(I.checklist) },
                      { icon: '🧮', name: en(I.fondos) },
                      { icon: '🗺️', name: en(I.mapaMadurez) },
                    ].map((h) => (
                      <button key={h.icon} className="world-glass world-glass-hover p-4 text-left" onClick={() => notificar(en(I.toolToast))}>
                        <div className="text-2xl">{h.icon}</div>
                        <p className="mt-1 text-xs font-extrabold text-slate-800 dark:text-white">{h.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {vista === 'tablero' && (
              <>
                {!yo.tablero ? (
                  <div className="world-glass world-grain p-8 text-center">
                    <div className="text-4xl">🔒</div>
                    <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">{en(I.tableroLockedTitle)}</h3>
                    <p className="mx-auto mt-1 max-w-md text-xs text-slate-600 dark:text-slate-300">{en(I.tableroLockedDesc)}</p>
                    <button
                      className="mt-4 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-4 py-2 text-sm font-extrabold text-white shadow-lg shadow-teal-500/30"
                      onClick={() => setVista('partida')}
                    >
                      {en(I.irCalibracion)}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="world-glass world-grain p-5">
                        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">📅 {en(I.retoSemanal)}</h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{en(I.retoSemanalDesc)}</p>
                        <div className="mt-3 flex gap-2">
                          {[
                            { d: 'Lun', ok: true },
                            { d: 'Mar', ok: true },
                            { d: 'Mié', ok: true },
                            { d: 'Jue', ok: false },
                            { d: 'Vie', ok: false },
                          ].map((x) => (
                            <div
                              key={x.d}
                              className={`flex h-14 w-11 flex-col items-center justify-center rounded-xl border text-[10px] font-extrabold ${
                                x.ok
                                  ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                                  : 'border-slate-300 bg-white/40 text-slate-500 dark:border-slate-600 dark:bg-white/5'
                              }`}
                            >
                              <span className="text-sm">{x.ok ? '✓' : '◦'}</span>
                              {x.d}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="world-glass world-grain p-5">
                        <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">{en(I.retoMensual)}</h3>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{en(I.retoMensualDesc)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            { icon: '🧭', a: 'Babel' },
                            { icon: '💰', a: 'Fisnando' },
                            { icon: '🤝', a: 'Karmetin' },
                            { icon: '⚖️', a: 'Normau' },
                            { icon: '⚙️', a: 'Atech' },
                          ].map((g) => (
                            <button
                              key={g.a}
                              className="rounded-lg border border-teal-400/50 bg-white/40 px-3 py-1.5 text-xs font-bold text-slate-700 backdrop-blur-md transition hover:bg-white/70 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20"
                              onClick={() => notificar(`${g.icon} ${g.a} ✓ +20`)}
                            >
                              {g.icon} {g.a} ✓ +20
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="world-glass world-grain mt-6 p-5">
                      <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">🗺️ {en(I.mapaProgreso)}</h2>
                      {respuestas ? (
                        <>
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full min-w-[620px] text-xs">
                              <thead>
                                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  <th className="pb-2">{en(I.tema)}</th>
                                  {[1, 2, 3, 4, 5, 6].map((n) => (
                                    <th key={n} className="pb-2 text-center">
                                      N{n}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {getMaturityDimensions(lang === 'en' ? 'en' : 'es').map((dim) => {
                                  const cells = respuestas[dim.id] ?? [];
                                  return (
                                    <tr key={dim.id} className="border-t border-slate-300/40 dark:border-slate-600/40">
                                      <td className="py-1.5 pr-2 font-bold text-slate-700 dark:text-slate-200">{dim.tema}</td>
                                      {cells.map((c, i) => (
                                        <td key={i} className="py-1.5 text-center">
                                          <span
                                            className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-extrabold ${
                                              c === 'yes'
                                                ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                                                : c === 'partial'
                                                  ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200'
                                                  : 'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-700 dark:bg-rose-900 dark:text-rose-200'
                                            }`}
                                          >
                                            {c === 'yes' ? '✓' : c === 'partial' ? '◦' : '✕'}
                                          </span>
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{en(I.leyendaMapa)}</p>
                        </>
                      ) : (
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{en(I.sinEvaluacion)}</p>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {vista === 'estrategia' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {SUBMUNDOS_ESTRATEGIA_LABELS.map((s) => (
                    <div key={s.n} className="world-glass world-grain p-5">
                      <div className="flex items-center justify-between">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                            s.estado === 'listo'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                              : s.estado === 'wip'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
                                : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {s.estado === 'listo' ? en(I.listoTag) : s.estado === 'wip' ? en(I.enCursoTag) : en(I.pendienteTag)}
                        </span>
                        <span className="text-xs font-extrabold text-amber-600 dark:text-amber-300">
                          +{s.pts} {en(I.pts)}
                        </span>
                      </div>
                      <div className="mt-3 text-4xl">{s.icon}</div>
                      <h3 className="mt-1 text-sm font-extrabold text-slate-800 dark:text-white">
                        {s.n}. {lang === 'en' ? s.en : s.es}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{lang === 'en' ? s.enDesc : s.esDesc}</p>
                      <button
                        className="mt-3 rounded-lg border border-teal-400/60 bg-white/40 px-3 py-1.5 text-xs font-extrabold text-teal-700 backdrop-blur-md transition hover:bg-white/70 dark:bg-white/10 dark:text-teal-200 dark:hover:bg-white/20"
                        onClick={() => router.push(s.ruta)}
                      >
                        {en(I.abrirSub)} →
                      </button>
                    </div>
                  ))}
                </div>

                <div className="world-glass world-grain mt-6 p-5">
                  <h2 className="text-base font-extrabold text-slate-800 dark:text-white">{en(I.tiendaEstrategia)}</h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{en(I.tiendaEstrategiaDesc)}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      { icon: '🎨', name: en(I.canvas) },
                      { icon: '🌐', name: en(I.foda) },
                      { icon: '📋', name: en(I.plantilla) },
                    ].map((h) => (
                      <button key={h.icon} className="world-glass world-glass-hover p-4 text-left" onClick={() => notificar(en(I.toolToast))}>
                        <div className="text-2xl">{h.icon}</div>
                        <p className="mt-1 text-xs font-extrabold text-slate-800 dark:text-white">{h.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}