'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useDisplayLang } from '@/components/display-lang-provider';
import AgentAvatar from '@/components/agentes/AgentAvatar';
import { getLatestAssessmentAnswers } from '@/lib/assessment';
import { getMaturityDimensions, DIMENSION_IDS, type DimensionId } from '@/lib/maturity-dimensions';
import { nivelDesdePuntos } from '@/lib/club';
import { getBabelSessionIfExists } from '@/lib/babel-session';
import { MENTORES, PRACTICAS_POR_TEMA, type MentorAgente } from '@/lib/madurez-practicas';
import {
  MISIONES_PART_LABELS,
  SUBMUNDOS_ESTRATEGIA_LABELS,
  MUNDOS_PREMIUM_LABELS,
  nivelLabelPuntos,
} from '@/lib/worlds';
import { WorldsBg } from '@/components/worlds/worlds-bg';
import { InsigniaCelebracion } from '@/components/worlds/InsigniaCelebracion';
import { insigniasNuevas, insigniasVistas, marcarInsigniasVistas } from '@/lib/insignias';
import PageTour from '@/components/ui/executive/PageTour';
import type { TourStep } from '@/components/ui/executive/PageTour';

type Vista = 'mapa' | 'partida' | 'tablero' | 'estrategia' | 'dinero' | 'cliente' | 'normativo' | 'operativo' | 'cultura';
type VistaPremium = 'dinero' | 'cliente' | 'normativo' | 'operativo' | 'cultura';

const VISTAS_PREMIUM: VistaPremium[] = ['dinero', 'cliente', 'normativo', 'operativo', 'cultura'];

interface Progreso {
  nombre: string;
  puntos: number;
  nivel: string;
  partida: number[];
  tablero: boolean;
  premium?: boolean;
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
    'Anfitrión Babel · 2 misiones para calibrar tu empresa antes de la aventura. Al completarlas desbloqueas el Tablero de Retos.',
    'Hosted by Babel · 2 missions to calibrate your company before the adventure. Completing them unlocks the Challenges Board.',
  ],
  entrarPartida: ['► Entrar al mundo', '► Enter the world'],
  tableroCard: ['Tablero de Retos', 'Challenges Board'],
  tableroDesc: [
    'Retos semanales y mensuales sobre tus 11 temas de madurez. Se desbloquea terminando el Mundo de Partida.',
    'Weekly and monthly challenges over your 11 maturity topics. Unlocks by finishing the Starting World.',
  ],
  reqTablero: ['🔒 Requisito: «Objetivos Estratégicos»', '🔒 Requirement: «Strategic Objectives»'],
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
  abrirSub: ['Abrir misión', 'Open mission'],
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
    'Completa el Mundo de Partida para desbloquear el Tablero de Retos.',
    'Complete the Starting World to unlock the Challenges Board.',
  ],
  irCalibracion: ['→ Ir al Mundo de Partida', '→ Go to the Starting World'],
  misionCompleta: ['¡Misión completada!', 'Mission complete!'],
  tableroGanado: ['¡Tablero de Retos desbloqueado!', 'Challenges Board unlocked!'],
  errorProcesar: ['No se pudo procesar la acción.', 'Could not process the action.'],
  temaAria: ['Cambiar tema claro/oscuro', 'Toggle light/dark theme'],
  misApoyo: ['Apoyo de Especialistas', 'Specialist Support'],
  misApoyoDesc: [
    'Agenda una sesión con un mentor experto (Babel, Fisnando, Karmetin, Normau o Atech) para desatorar tu misión y avanzar con acompañamiento.',
    'Book a session with an expert mentor (Babel, Fisnando, Karmetin, Normau or Atech) to unblock your mission and move forward with support.',
  ],
  agendarMentor: ['Agendar con un mentor', 'Book a mentor session'],
  misPA: ['Misión de Plan de Acción', 'Action Plan Mission'],
  misPADesc: [
    'Se desbloquea cuando defines tu Plan de Acción. Conecta los temas de cada agente con las buenas prácticas a trabajar, mes a mes.',
    "Unlocks once you define your Action Plan. It connects each agent's topics with the practices to work on, month by month.",
  ],
  bloqueadaTag: ['Bloqueada', 'Locked'],
  paLockDesc: [
    'Define primero tu Plan de Acción (Plan de Acción Socioambiental de la Reflexión Estratégica) para desbloquear esta misión y ver tus actividades por agente.',
    'Define your Action Plan first (Socioenvironmental Action Plan of the Strategic Reflection) to unlock this mission and see your activities per agent.',
  ],
  crearMiPA: ['Definir mi Plan de Acción', 'Define my Action Plan'],
  verPA: ['Abrir el Plan de Acción', 'Open the Action Plan'],
  panelAgente: ['Agente', 'Agent'],
  panelTemas: ['Temas asignados a', 'Topics assigned to'],
  panelTodos: ['Actividades por agente', 'Activities per agent'],
  temaCol: ['Tema', 'Topic'],
  practicaCol: ['Siguiente práctica', 'Next practice'],
  nivelCol: ['Nivel', 'Level'],
  mesCol: ['Este mes', 'This month'],
  dominadoTag: ['Dominado', 'Mastered'],
  sinPend: ['Sin prácticas pendientes', 'No pending practices'],
  notaPanel: [
    'Las actividades parten de tu Evaluación de Madurez (el nivel más bajo no completado de cada tema) y del Plan de Madurez del mes actual.',
    "Activities come from your Maturity Assessment (the lowest incomplete level of each topic) and this month's Maturity Plan.",
  ],
} as const;

type Params = readonly [string, string];
const t2 = (lang: 'es' | 'en') => (p: Params) => (lang === 'en' ? p[1] : p[0]);

// ── Misiones "Plan de Acción" de los mundos: panel de actividades por agente ─
// Los temas asignados a cada agente salen del catálogo de prácticas de madurez
// (PRACTICAS_POR_TEMA: mentor por tema) y las actividades del nivel más bajo
// no completado de la evaluación + el Plan de Madurez del mes actual.

const NIVELES_ACT: Record<'es' | 'en', string[]> = {
  es: ['Ejecución', 'Estándar', 'Control', 'Optimización', 'Excelencia', 'Influencer'],
  en: ['Execution', 'Standard', 'Control', 'Optimization', 'Excellence', 'Influencer'],
};

interface CompromisoLeido {
  themeId?: string;
  estatus?: 'pendiente' | 'en_progreso' | 'completada';
}

interface PlanMadurezLeido {
  completados: Record<string, number>;
  compromisos: Record<string, CompromisoLeido[]>;
}

interface Actividad {
  themeId: DimensionId;
  terminado: boolean;
  practica: string | null;
  nivel: number;
  comp: CompromisoLeido | undefined;
}

function monthKeyOf(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function baseNivelDe(respuestas: Record<string, string[]> | null, themeId: DimensionId): number {
  const arr = respuestas?.[themeId];
  if (!arr) return 0;
  for (let i = 0; i < 6; i++) {
    if (arr[i] !== 'yes') return i;
  }
  return 6;
}

function PanelActividades({
  agente,
  lang,
  respuestas,
  plan,
}: {
  agente: MentorAgente | 'todos';
  lang: 'es' | 'en';
  respuestas: Record<string, string[]> | null;
  plan: PlanMadurezLeido;
}) {
  const en = t2(lang);
  const dims = React.useMemo(() => getMaturityDimensions(lang), [lang]);
  const temaDe = React.useMemo(() => {
    const m: Record<string, string> = {};
    dims.forEach((d) => {
      m[d.id] = d.tema;
    });
    return m;
  }, [dims]);
  const mesKey = monthKeyOf(new Date());
  const agentes: MentorAgente[] = agente === 'todos' ? MENTORES : [agente];

  const filas = React.useMemo(() => {
    const comps = plan.compromisos[mesKey] ?? [];
    return agentes.map((a) => {
      const fs: Actividad[] = [];
      for (const id of DIMENSION_IDS) {
        const prs = PRACTICAS_POR_TEMA[id];
        if (!prs.some((p) => p.mentor === a)) continue;
        const n = Math.min(6, baseNivelDe(respuestas, id) + (plan.completados[id] ?? 0));
        fs.push({
          themeId: id,
          terminado: n >= 6,
          practica: n < 6 ? prs[n].practica : null,
          nivel: n < 6 ? n : -1,
          comp: comps.find((c) => c.themeId === id),
        });
      }
      return { agente: a, filas: fs };
    });
  }, [agentes, plan, respuestas, mesKey]);

  const colSpan = agente === 'todos' ? 5 : 4;

  const chip = (c: CompromisoLeido | undefined) => {
    if (!c) {
      return <span className="text-slate-400 dark:text-slate-500">—</span>;
    }
    const cls =
      c.estatus === 'completada'
        ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
        : c.estatus === 'en_progreso'
          ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200'
          : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';
    const lbl =
      c.estatus === 'completada' ? en(I.completadaTag) : c.estatus === 'en_progreso' ? en(I.enCursoTag) : en(I.pendienteTag);
    return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${cls}`}>{lbl}</span>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {agente === 'todos' && <th className="pb-2">{en(I.panelAgente)}</th>}
            <th className="pb-2">{en(I.temaCol)}</th>
            <th className="pb-2">{en(I.practicaCol)}</th>
            <th className="pb-2 text-center">{en(I.nivelCol)}</th>
            <th className="pb-2">{en(I.mesCol)}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ agente: a, filas: fs }) => (
            <React.Fragment key={a}>
              {agente === 'todos' && (
                <tr className="border-t border-slate-300/40 dark:border-slate-600/40">
                  <td colSpan={colSpan} className="py-1.5 pt-2.5">
                    <span className="flex items-center gap-2 font-extrabold text-slate-700 dark:text-slate-200">
                      <AgentAvatar agente={a} size={20} className="shrink-0" onClick={() => undefined} />
                      {a}
                    </span>
                  </td>
                </tr>
              )}
              {fs.length === 0 && (
                <tr className="border-t border-slate-300/40 dark:border-slate-600/40">
                  <td colSpan={colSpan} className="py-1.5 text-slate-500 dark:text-slate-400">
                    {en(I.sinPend)}
                  </td>
                </tr>
              )}
              {fs.map((f) => (
                <tr key={f.themeId} className="border-t border-slate-300/40 dark:border-slate-600/40">
                  {agente === 'todos' && <td className="py-1.5 pr-2" />}
                  <td className="py-1.5 pr-2 font-bold text-slate-700 dark:text-slate-200">{temaDe[f.themeId] ?? f.themeId}</td>
                  <td className="py-1.5 pr-2 text-slate-600 dark:text-slate-300">
                    {f.terminado ? (
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">✓ {en(I.dominadoTag)}</span>
                    ) : (
                      f.practica
                    )}
                  </td>
                  <td className="py-1.5 text-center">
                    {f.terminado ? (
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">6/6</span>
                    ) : (
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-extrabold text-teal-700 dark:bg-teal-900 dark:text-teal-200">
                        {NIVELES_ACT[lang][f.nivel]}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pl-2">{chip(f.comp)}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MisionPlanAccion({
  agente,
  lang,
  planAccionDefinido,
  respuestas,
  plan,
  onIrPlan,
  esPremium,
}: {
  agente: MentorAgente;
  lang: 'es' | 'en';
  planAccionDefinido: boolean;
  respuestas: Record<string, string[]> | null;
  plan: PlanMadurezLeido;
  onIrPlan: () => void;
  esPremium: boolean;
}) {
  const en = t2(lang);
  const desbloqueada = planAccionDefinido && esPremium;
  return (
    <div className="world-glass world-grain p-5">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
            desbloqueada
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {desbloqueada ? `✓ ${en(I.listoTag)}` : `🔒 ${en(I.bloqueadaTag)}`}
        </span>
      </div>
      <div className="mt-3 text-4xl">📋</div>
      <h3 className="mt-1 text-base font-extrabold text-slate-800 dark:text-white">{en(I.misPA)}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.misPADesc)}</p>
      {!desbloqueada ? (
        <div className="mt-3 rounded-xl border border-slate-300/50 bg-white/40 p-4 dark:bg-white/5">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">🔒 {en(I.paLockDesc)}</p>
          <button
            className="mt-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
            onClick={onIrPlan}
          >
            {en(I.crearMiPA)}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-xs font-extrabold text-slate-700 dark:text-slate-200">
            {en(I.panelTemas)}{' '}
            <b className="text-teal-700 dark:text-teal-300">{agente}</b>
          </p>
          <div className="mt-2">
            <PanelActividades agente={agente} lang={lang} respuestas={respuestas} plan={plan} />
          </div>
          <button
            className="mt-3 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
            onClick={onIrPlan}
          >
            {en(I.verPA)} →
          </button>
        </>
      )}
    </div>
  );
}

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

export function WorldsBuilder({ vistaInicial }: { vistaInicial?: Vista }) {
  const router = useRouter();
  const { lang, setLang } = useDisplayLang();
  const T = t2(lang === 'es' ? 'es' : 'en');
  const en = (p: Params) => T(p);

  const [yo, setYo] = React.useState<Progreso | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [vista, setVista] = React.useState<Vista>(vistaInicial ?? 'mapa');
  const [toast, setToast] = React.useState<string | null>(null);
  const [confettiSeed, setConfettiSeed] = React.useState(0);
  const [completando, setCompletando] = React.useState<number | null>(null);
  const [uid, setUid] = React.useState<string | null>(null);
  const [respuestas, setRespuestas] = React.useState<Record<string, string[]> | null>(null);
  // Misión 0 del Mundo de Estrategia (Calibración): se marca COMPLETADA cuando
  // la Fase 0 de Babel ya fue aprobada por el usuario en su sesión.
  const [fase0Aprobada, setFase0Aprobada] = React.useState(false);
  const [planMadurez, setPlanMadurez] = React.useState<PlanMadurezLeido>({ completados: {}, compromisos: {} });
  const [planAccionDefinido, setPlanAccionDefinido] = React.useState(false);
  const [precioPlan, setPrecioPlan] = React.useState<number | null>(null);
  const [pagando, setPagando] = React.useState(false);

  const notificar = React.useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2900);
  }, []);

  // Mundos Premium: visibles y abiertos para todos. La barrera de pago
  // solo aparece al intentar entrar/interactuar con una MISIÓN dentro de
  // un mundo premium (pagó el plan, o un admin se lo otorgó manualmente,
  // o es admin — ver src/lib/premium.ts / /api/worlds).
  const [premiumLock, setPremiumLock] = React.useState(false);
  const [insigniaNuevaId, setInsigniaNuevaId] = React.useState<string | null>(null);
  const esPremium = yo?.premium === true;
  const abrirMundo = React.useCallback((destino: Vista) => {
    setVista(destino);
  }, []);

  // La barrera de pago ya NO se muestra al entrar a un mundo premium.
  // Se muestra al intentar ENTRAR/INTERACTUAR con una misión dentro de un
  // mundo premium (Estrategia o cualquiera de los 5 mundos: dinero,
  // cliente, normativo, operativo, cultura).
  const abrirMision = React.useCallback(
    (accion: () => void) => {
      if (!esPremium) {
        setPremiumLock(true);
        return;
      }
      accion();
    },
    [esPremium]
  );
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
          const nuevas = insigniasNuevas(usr.uid, {
            partida: data.yo.partida,
            tablero: data.yo.tablero,
            premium: data.yo.premium,
          });
          if (nuevas.length > 0) {
            setInsigniaNuevaId(nuevas[0]);
            festejar();
          }
        }
        try {
          const res2 = await fetch('/api/pagos/precio-plan', { headers: { Authorization: `Bearer ${token}` } });
          if (res2.ok) {
            const data2 = await res2.json();
            if (typeof data2?.precio === 'number') setPrecioPlan(data2.precio);
          }
        } catch (err) {
          console.error('[worlds] precio-plan', err);
        }
      } catch (err) {
        console.error('[worlds] carga', err);
      }
      setCargando(false);
    });
    return () => unsub();
  }, []);

  React.useEffect(() => {
    if (!uid) return;
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
  }, [uid]);

  // Misión 0 (Calibración) del Mundo de Estrategia: lee la sesión de Babel del
  // usuario y marca COMPLETADA si la Fase 0 ya fue aprobada.
  React.useEffect(() => {
    if (!uid) return;
    let vivo = true;
    getBabelSessionIfExists(uid)
      .then((session) => {
        if (!vivo || !session) return;
        const aprobada = (session.phases ?? []).some((p) => p.phase === 0 && p.approved);
        setFase0Aprobada(aprobada);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [uid]);

  const irAgendar = React.useCallback(() => {
    router.push(`/${lang === 'es' ? 'es' : 'en'}/agendar`);
  }, [router, lang]);

  const irPlanAccion = React.useCallback(() => {
    router.push(`/${lang === 'es' ? 'es' : 'en'}/babel/plan-accion`);
  }, [router, lang]);

  // Lee el Plan de Madurez y el Plan de Acción del usuario (localStorage) para
  // las misiones "Plan de Acción" de cada mundo (panel de actividades por
  // agente). El plan de acción se considera DEFINIDO cuando ya tiene acciones.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem('babel_madurez_plan_v1');
      if (raw) {
        const p = JSON.parse(raw) as { completados?: Record<string, number>; compromisos?: Record<string, CompromisoLeido[]> };
        setPlanMadurez({ completados: p?.completados ?? {}, compromisos: p?.compromisos ?? {} });
      }
    } catch (err) {
      console.error('[worlds] plan de madurez', err);
    }
    try {
      const raw = window.localStorage.getItem('babel_plan_accion_v2');
      if (raw) {
        const p = JSON.parse(raw) as { acciones?: unknown[] };
        setPlanAccionDefinido(Array.isArray(p?.acciones) && p.acciones.length > 0);
      }
    } catch (err) {
      console.error('[worlds] plan de accion', err);
    }
  }, []);

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
        const esFinalPartida = n === MISIONES_PART_LABELS.length;
        notificar(`+${data.pts} ${en(I.pts)} · ${esFinalPartida ? en(I.tableroGanado) : en(I.misionCompleta)}`);
        if (esFinalPartida) setVista('mapa');
      } else {
        notificar(String(data.error ?? en(I.errorProcesar)));
      }
    } catch (err) {
      notificar(en(I.errorProcesar));
    } finally {
      setCompletando(null);
    }
  }

  async function pagarPlanMensual() {
    if (pagando) return;
    const auth = getFirebaseAuth();
    const usr = auth.currentUser;
    if (!usr) return;
    setPagando(true);
    try {
      const token = await usr.getIdToken();
      const res = await fetch('/api/pagos/crear-preferencia', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: lang, returnPath: '/worlds' }),
      });
      const data = await res.json();
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        console.error('[worlds] crear-preferencia sin checkoutUrl', data);
        setPagando(false);
      }
    } catch (err) {
      console.error('[worlds] error al iniciar pago', err);
      setPagando(false);
    }
  }

  // Soporta /worlds?v=partida|tablero|estrategia para abrir directo una vista
  // (los enlaces del Inicio llevan este parámetro).
  React.useEffect(() => {
    if (cargando) return;
    const v = new URLSearchParams(window.location.search).get('v');
    const validas: string[] = ['partida', 'tablero', 'estrategia', ...VISTAS_PREMIUM];
    if (!v || !validas.includes(v)) return;
    // Los mundos premium (incluida Estrategia) ahora se pueden ABRIR sin
    // pagar; la barrera de pago aparece solo al intentar entrar a una misión.
    setVista(v as Vista);
  }, [cargando]);

  const hechas = yo?.partida ?? [];
  const mundoVista = MUNDOS_PREMIUM_LABELS.find((m) => m.id === vista);
  const vistaPremium = mundoVista?.id;

  return (
    <div className="relative min-h-screen">
      <WorldsBg />
      <Confetti seed={confettiSeed} />
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[99] w-max max-w-[92vw] -translate-x-1/2 rounded-full border border-teal-300/50 bg-[#0b2430]/90 px-5 py-3 text-sm font-bold text-white shadow-2xl backdrop-blur-xl">
          ⭐ {toast}
        </div>
      )}

      <InsigniaCelebracion
        insigniaId={insigniaNuevaId}
        lang={lang === 'en' ? 'en' : 'es'}
        onClose={() => {
          if (uid && insigniaNuevaId) {
            marcarInsigniasVistas(uid, [...insigniasVistas(uid), insigniaNuevaId]);
          }
          setInsigniaNuevaId(null);
        }}
      />

      {premiumLock && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setPremiumLock(false)}
        >
          <div
            className="world-glass world-grain max-w-sm rounded-2xl p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl">🔒</div>
            <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">
              {en(['Este mundo es Premium', 'This world is Premium'])}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {en([
                'Para interactuar en las misiones de este mundo necesitas contratar el plan mensual.',
                'To interact with the missions in this world you need to subscribe to the monthly plan.',
              ])}
            </p>
            <div className="mt-4 flex flex-col items-center justify-center gap-2">
              <button
                type="button"
                className="rounded-full bg-teal-600 px-4 py-2 text-xs font-extrabold text-white shadow hover:bg-teal-700 disabled:opacity-50"
                onClick={pagarPlanMensual}
                disabled={pagando}
              >
                {pagando
                  ? en(['Procesando...', 'Processing...'])
                  : en([`Pagar plan mensual por solo $${precioPlan ?? 99}`, `Pay monthly plan for only $${precioPlan ?? 99}`])}
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => setPremiumLock(false)}
              >
                {en(['Cerrar', 'Close'])}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="world-glass world-grain mb-6 flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2 text-lg font-extrabold text-slate-800 dark:text-white">
            <span className="text-2xl">🌍</span>{' '}
            {vistaPremium && mundoVista
              ? `${en(['Universo MBE - ', 'MBE Universe - '])}${lang === 'en' ? mundoVista.en : mundoVista.es}`
              : en([
                  vista === 'partida' ? 'Universo MBE - Mundo de partida'
                    : vista === 'tablero' ? 'Universo MBE - Tablero de retos'
                    : vista === 'estrategia' ? 'Universo MBE - Mundo de la Estrategia'
                    : 'Universo MBE - Mundos',
                  vista === 'partida' ? 'MBE Universe - Starting World'
                    : vista === 'tablero' ? 'MBE Universe - Challenges Board'
                    : vista === 'estrategia' ? 'MBE Universe - Strategy World'
                    : 'MBE Universe - Worlds',
                ])}
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
          </div>
        </div>

        <div id="worlds-saludo" className="world-glass mb-6 flex items-start gap-4 p-5">
          <AgentAvatar agente="Babel" pose="guiando" size={56} className="shrink-0" />
          <div className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-100">
            <p>
              <b className="text-teal-700 dark:text-teal-300">
                {en(I.saludo)}
                {yo?.nombre ? `, ${yo.nombre}!` : '!'} —
              </b>{' '}
              {en([
                'Completa todas las misiones para desbloquear tu Zona de Dinero y Equipo de trabajo Real. Todas las misiones puedes volverlas a hacer cuando consideres un cambio en tu empresa.',
                'Complete all missions to unlock your Money Zone and Real Working Team. You can redo every mission whenever you consider a change in your company.',
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <button id="worlds-mundo-partida" className="world-glass world-glass-hover world-grain p-5 text-left" onClick={() => setVista('partida')}>
                    <span className="mb-2 inline-block rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                      {en(I.gratisTag)}
                    </span>
                    <div className="text-4xl">🎓</div>
                    <h3 className="mt-2 text-base font-extrabold text-slate-800 dark:text-white">{en(I.mundoPartida)}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.mundoPartidaDesc)}</p>
                    <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">
                      {en(I.entrarPartida)} · {hechas.length}/{MISIONES_PART_LABELS.length}
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
                  <button className="world-glass world-glass-hover world-grain p-5 text-left" onClick={() => abrirMundo('estrategia')}>
                    <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-fuchsia-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-200">
                      {esPremium ? 'Premium' : '🔒 Premium'}
                    </span>
                    <div className="text-4xl">🧭</div>
                    <div className="mt-3 flex items-center gap-2">
                      <AgentAvatar agente="Babel" size={28} className="ring-2 ring-fuchsia-300/60" onClick={() => undefined} />
                      <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Estrategia</h3>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {en(I.host)} <b>Babel</b> · {SUBMUNDOS_ESTRATEGIA_LABELS.length} {en(I.submundos)} · {en(I.faseALista)}.
                    </p>
                    <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">{en(I.verMundo)}</p>
                  </button>

                  {MUNDOS_PREMIUM_LABELS.map((m) => (
                    <button
                      key={m.id}
                      className="world-glass world-glass-hover world-grain p-5 text-left"
                      onClick={() => abrirMundo(m.id)}
                    >
                      <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-fuchsia-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-200">
                        {esPremium ? 'Premium' : '🔒 Premium'}
                      </span>
                      <div className="text-4xl">{m.icon}</div>
                      <div className="mt-3 flex items-center gap-2">
                        <AgentAvatar agente={m.agente} size={28} className="ring-2 ring-fuchsia-300/60" onClick={() => undefined} />
                        <h3 className="text-base font-extrabold text-slate-800 dark:text-white">{lang === 'en' ? m.en : m.es}</h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {en(I.host)} <b>{m.agente}</b> · {en(I.misNum)} 1 · {en(I.misApoyo)} + {en(I.misPA)}.
                      </p>
                      <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">{en(I.verMundo)}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {vista === 'partida' && (
              <>
                <div id="worlds-misiones" className="grid gap-4 sm:grid-cols-2">
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
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {'ruta' in m && (
                            <button
                              className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
                              onClick={() => router.push(`/${lang === 'es' ? 'es' : 'en'}${m.ruta}`)}
                            >
                              {en(I.abrirHerramienta)}
                            </button>
                          )}
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

            {vistaPremium && mundoVista && (
              <>
                <div className="world-glass world-glass-hover world-grain mb-5 flex items-start gap-4 p-5">
                  <AgentAvatar agente={mundoVista.agente} pose="guiando" size={56} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-extrabold text-slate-800 dark:text-white">
                      {mundoVista.icon} {lang === 'en' ? mundoVista.en : mundoVista.es}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {lang === 'en' ? mundoVista.enDesc : mundoVista.esDesc}
                    </p>
                    <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">
                      {en(I.host)} <b>{mundoVista.agente}</b>
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    className="world-glass world-glass-hover world-grain p-5 text-left"
                    onClick={() => abrirMision(irAgendar)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-fuchsia-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-200">
                        {en(I.misNum)} 1
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                        {en(I.listoTag)}
                      </span>
                    </div>
                    <div className="mt-3 text-4xl">🤝</div>
                    <h3 className="mt-1 text-base font-extrabold text-slate-800 dark:text-white">
                      {lang === 'es' ? 'Misión 1. Apoyo de Especialistas' : 'Mission 1. Specialist Support'}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.misApoyoDesc)}</p>
                    <p className="mt-2 text-xs font-bold text-teal-700 dark:text-teal-300">{en(I.agendarMentor)} →</p>
                  </button>

                  <MisionPlanAccion
                    agente={mundoVista.agente}
                    lang={lang === 'es' ? 'es' : 'en'}
                    planAccionDefinido={planAccionDefinido}
                    respuestas={respuestas}
                    plan={planMadurez}
                    onIrPlan={() => abrirMision(irPlanAccion)}
                    esPremium={esPremium}
                  />
                </div>
              </>
            )}

            {vista === 'estrategia' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {SUBMUNDOS_ESTRATEGIA_LABELS.map((s) => {
                    // Misión 0 (Calibración) es la única con estado dinámico:
                    // COMPLETADA si la Fase 0 de Babel ya fue aprobada. Las
                    // demás misiones conservan su estado estático de worlds.ts.
                    const estadoEfectivo = s.n === 0 && fase0Aprobada ? 'completada' : s.estado;
                    return (
                      <div key={s.n} className="world-glass world-grain p-5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                              estadoEfectivo === 'completada'
                                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200'
                                : estadoEfectivo === 'listo'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
                                  : estadoEfectivo === 'wip'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
                                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {estadoEfectivo === 'completada'
                              ? en(I.completadaTag)
                              : estadoEfectivo === 'listo'
                                ? en(I.listoTag)
                                : estadoEfectivo === 'wip'
                                  ? en(I.enCursoTag)
                                  : en(I.pendienteTag)}
                          </span>
                          <span className="text-xs font-extrabold text-amber-600 dark:text-amber-300">
                            +{s.pts} {en(I.pts)}
                          </span>
                        </div>
                        <div className="mt-3 text-4xl">{s.icon}</div>
                        <h3 className="mt-1 text-sm font-extrabold text-slate-800 dark:text-white">
                          {lang === 'en' ? `Mission ${s.n}. ${s.en}` : `Misión ${s.n}. ${s.es}`}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{lang === 'en' ? s.enDesc : s.esDesc}</p>
                        <button
                          className="mt-3 rounded-lg border border-teal-400/60 bg-white/40 px-3 py-1.5 text-xs font-extrabold text-teal-700 backdrop-blur-md transition hover:bg-white/70 dark:bg-white/10 dark:text-teal-200 dark:hover:bg-white/20"
                          onClick={() => abrirMision(() => router.push(s.ruta))}
                        >
                          {en(I.abrirSub)} →
                        </button>
                      </div>
                    );
                  })}
                <div key="apoyo-especialistas" className="world-glass world-grain p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-fuchsia-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-200">
                        {en(I.misNum)} 7
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                        {en(I.listoTag)}
                      </span>
                    </div>
                    <div className="mt-3 text-4xl">🤝</div>
                    <h3 className="mt-1 text-sm font-extrabold text-slate-800 dark:text-white">
                      {lang === 'es' ? 'Misión 7. Apoyo de Especialistas' : 'Mission 7. Specialist Support'}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{en(I.misApoyoDesc)}</p>
                    <button
                      className="mt-3 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
                      onClick={() => abrirMision(irAgendar)}
                    >
                      {en(I.agendarMentor)} →
                    </button>
                  </div>
                </div>

                <div id="estrategia-plan-accion" className="world-glass world-grain mt-6 p-5">
                  <h2 className="text-base font-extrabold text-slate-800 dark:text-white">📋 {en(I.misPA)}</h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{en(I.misPADesc)}</p>
                  {!planAccionDefinido || !esPremium ? (
                    <div className="mt-3 rounded-xl border border-slate-300/50 bg-white/40 p-4 dark:bg-white/5">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">🔒 {en(I.paLockDesc)}</p>
                      <button
                        className="mt-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
                        onClick={() => abrirMision(irPlanAccion)}
                      >
                        {en(I.crearMiPA)}
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="mt-3 text-xs font-extrabold text-slate-700 dark:text-slate-200">🌐 {en(I.panelTodos)}</p>
                      <div className="mt-2">
                        <PanelActividades agente="todos" lang={lang === 'es' ? 'es' : 'en'} respuestas={respuestas} plan={planMadurez} />
                      </div>
                      <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{en(I.notaPanel)}</p>
                    </>
                  )}
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

      <PageTour
        pageId="worlds-vista"
        lang={lang === 'es' ? 'es' : 'en'}
        steps={[
          {
            selector: '#worlds-saludo',
            title: lang === 'es' ? 'Mundo de Partida' : 'Starting World',
            description: lang === 'es'
              ? 'Babel te da la bienvenida. Aquí calibras tu empresa: completa las misiones en orden y desbloquearás el Tablero de Retos.'
              : 'Babel welcomes you. Calibrate your company here: complete the missions in order and you will unlock the Challenges Board.',
          },
          {
            selector: '#worlds-mundo-partida',
            title: lang === 'es' ? `Las ${MISIONES_PART_LABELS.length} misiones` : `The ${MISIONES_PART_LABELS.length} missions`,
            description: lang === 'es'
              ? 'Cada misión abre una herramienta real (Dashboard u Objetivos estratégicos). Puedes repetirlas cuando cambie tu empresa.'
              : 'Each mission opens a real tool (Dashboard or Strategic Objectives). You can redo them whenever your company changes.',
          },
        ]}
      />
    </div>
  );
}