'use client';

import * as React from 'react';
import AgentAvatar from '@/components/agentes/AgentAvatar';

export type PuntoRecorridoId =
  | 'resumen'
  | 'evaluacion'
  | 'madurez'
  | 'objetivos'
  | 'reflexion'
  | 'organigrama'
  | 'planaccion'
  | 'convocatorias'
  | 'partida'
  | 'tablero'
  | 'refplace'
  | 'club'
  | 'estrategia';

export interface PuntoRecorrido {
  id: PuntoRecorridoId;
  ruta: string;
  interno: boolean;
  icono: string;
  es: string;
  en: string;
  x: number;
  y: number;
}

// El recorrido oficial de MBE: todas las secciones de la App como puntos de un
// mapa estilo Mario World. El avatar de Babel avanza de punto en punto.
export const PUNTOS_RECORRIDO: PuntoRecorrido[] = [
  { id: 'resumen', ruta: '/executive-preview', interno: false, icono: '🏠', es: 'Resumen ejecutivo', en: 'Executive summary', x: 20, y: 250 },
  { id: 'evaluacion', ruta: '/dashboard', interno: false, icono: '📊', es: 'Evaluación de madurez', en: 'Maturity assessment', x: 150, y: 80 },
  { id: 'madurez', ruta: '/babel/madurez', interno: false, icono: '📈', es: 'Mejora del nivel de madurez', en: 'Maturity improvement', x: 280, y: 240 },
  { id: 'objetivos', ruta: '/babel/indicadores', interno: false, icono: '🎯', es: 'Objetivos estratégicos', en: 'Strategic objectives', x: 410, y: 80 },
  { id: 'reflexion', ruta: '/babel', interno: false, icono: '💡', es: 'Reflexión estratégica', en: 'Strategic reflection', x: 540, y: 230 },
  { id: 'organigrama', ruta: '/babel/organigrama', interno: false, icono: '🏢', es: 'Organigrama y roles', en: 'Org chart & roles', x: 670, y: 90 },
  { id: 'planaccion', ruta: '/babel/plan-accion', interno: false, icono: '📋', es: 'Plan de acción', en: 'Action plan', x: 800, y: 240 },
  { id: 'convocatorias', ruta: '/babel/convocatorias', interno: false, icono: '📣', es: 'Convocatorias y fondos', en: 'Calls & grants', x: 930, y: 90 },
  { id: 'partida', ruta: '/worlds', interno: true, icono: '🎓', es: 'Mundo de Partida', en: 'Starting World', x: 1060, y: 230 },
  { id: 'tablero', ruta: '/worlds', interno: true, icono: '🎲', es: 'Tablero de Retos', en: 'Challenges Board', x: 1190, y: 90 },
  { id: 'refplace', ruta: '/refplace', interno: false, icono: '🛒', es: 'Reference Place', en: 'Reference Place', x: 1320, y: 230 },
  { id: 'club', ruta: '/club', interno: false, icono: '📅', es: 'Juntas de mentoría', en: 'Mentoring meetings', x: 1450, y: 90 },
  { id: 'estrategia', ruta: '/worlds', interno: true, icono: '🧭', es: 'Mundo de la Estrategia', en: 'Strategy World', x: 1580, y: 230 },
];

const ANCHO = 1620;
const ALTO = 300;

type WorldMapProps = {
  lang: 'es' | 'en';
  doneIds: string[];
  onNavegar: (p: PuntoRecorrido) => void;
  onCompletar: (id: PuntoRecorridoId) => void;
  hideHeader?: boolean;
};

function esEtiqueta(p: PuntoRecorrido, lang: 'es' | 'en'): string {
  return lang === 'en' ? p.en : p.es;
}

// Mapa estilo Mario World: camino serpenteante con cada sección de la app como
// un punto. El avatar de Babel avanza de punto en punto (transición CSS) a
// medida que el usuario completa secciones.
export function WorldMap({ lang, doneIds, onNavegar, onCompletar, hideHeader = false }: WorldMapProps) {
  const contRef = React.useRef<HTMLDivElement>(null);
  const [mover, setMover] = React.useState(false);

  const avatarPosId: PuntoRecorridoId = doneIds.length >= PUNTOS_RECORRIDO.length ? PUNTOS_RECORRIDO[PUNTOS_RECORRIDO.length - 1].id : (PUNTOS_RECORRIDO[doneIds.length]?.id ?? PUNTOS_RECORRIDO[0].id);
  const avatarPos = PUNTOS_RECORRIDO.find((p) => p.id === avatarPosId) ?? PUNTOS_RECORRIDO[0];
  const meta = doneIds.length >= PUNTOS_RECORRIDO.length;

  // El primer frame deja el avatar en su punto sin transición; después se
  // activa la animación para que el desplazamiento punto a punto sea visible.
  React.useEffect(() => {
    const t = window.setTimeout(() => setMover(true), 90);
    return () => window.clearTimeout(t);
  }, []);

  // Centra el punto del avatar al avanzaar.
  React.useEffect(() => {
    const c = contRef.current;
    if (!c) return;
    const target = avatarPos.x - c.clientWidth / 2 + 40;
    c.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [avatarPosId, avatarPos.x]);

  return (
    <div className="world-glass world-grain overflow-hidden">
      {/* Encabezado del mapa */}
      {!hideHeader && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 pr-14">
          <div className="text-lg font-extrabold text-slate-800 dark:text-white">🗺️ {lang === 'es' ? 'Tu recorrido MBE' : 'Your MBE journey'}</div>
          <div className="ml-auto flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-100">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
              ✓ {doneIds.length}/{PUNTOS_RECORRIDO.length} {lang === 'es' ? 'completados' : 'completed'}
            </span>
            {meta && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                🏆 {lang === 'es' ? '¡Recorrido completo!' : 'Journey complete!'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Escenario (scroll horizontal) */}
      <div ref={contRef} className="overflow-x-auto">
        <div className="relative" style={{ width: ANCHO, height: ALTO }}>
          {/* Cielo, nubes y árboles */}
          <div className="pointer-events-none absolute inset-0 rounded-b-2xl bg-gradient-to-b from-sky-200/70 via-teal-100/60 to-emerald-200/50 dark:from-slate-800/80 dark:via-slate-900/60 dark:to-slate-800/40" />
          <span className="pointer-events-none absolute left-[120px] top-[26px] text-4xl opacity-70">☁️</span>
          <span className="pointer-events-none absolute left-[420px] top-[10px] text-3xl opacity-50">☁️</span>
          <span className="pointer-events-none absolute left-[900px] top-[30px] text-4xl opacity-70">☁️</span>
          <span className="pointer-events-none absolute left-[1250px] top-[14px] text-3xl opacity-60">🌤️</span>
          <span className="pointer-events-none absolute left-[150px] top-[150px] text-3xl opacity-40">🌳</span>
          <span className="pointer-events-none absolute left-[980px] top-[170px] text-3xl opacity-40">🌳</span>
          <span className="pointer-events-none absolute left-[1390px] top-[160px] text-3xl opacity-40">🌳</span>

          {/* Camino serpenteante */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="none">
            <path
              d={PUNTOS_RECORRIDO.reduce((d, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${d} L ${p.x} ${p.y}`), '')}
              fill="none"
              stroke="#e8c882"
              strokeWidth={30}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.35}
            />
            <path
              d={PUNTOS_RECORRIDO.reduce((d, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${d} L ${p.x} ${p.y}`), '')}
              fill="none"
              stroke="#f5d692"
              strokeWidth={18}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Puntos de la ruta */}
          {PUNTOS_RECORRIDO.map((p) => {
            const idx = PUNTOS_RECORRIDO.indexOf(p);
            const hecho = idx < doneIds.length;
            const actual = idx === doneIds.length;
            const abierto = idx <= doneIds.length;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => abierto && onNavegar(p)}
                title={esEtiqueta(p, lang)}
                className={
                  'group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full p-1 transition-transform hover:scale-110 ' +
                  (abierto ? 'cursor-pointer' : 'cursor-not-allowed')
                }
                style={{ left: p.x, top: p.y }}
              >
                <span
                  className={
                    'relative flex h-11 w-11 items-center justify-center rounded-full border-2 text-xl shadow-lg backdrop-blur-md ' +
                    (hecho
                      ? 'border-emerald-400 bg-emerald-100/90 dark:bg-emerald-900/90'
                      : actual
                        ? 'border-teal-400 bg-white/90 ring-4 ring-teal-400/40 dark:bg-slate-800/90'
                        : 'border-slate-300 bg-white/50 opacity-60 dark:bg-slate-800/60')
                  }
                >
                  {hecho ? '✅' : p.icono}
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 max-w-none whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-1 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {esEtiqueta(p, lang) + (hecho ? ' ✓' : '')}
                </span>
              </button>
            );
          })}

          {/* Bandera de meta */}
          <div className="pointer-events-none absolute z-10" style={{ left: ANCHO - 44, top: ALTO - 14 }}>
            <span className="flex flex-col items-center">
              <span className="text-3xl">{meta ? '🏁' : '🚩'}</span>
              <span className="mt-0.5 rounded-md bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-bold text-white">{lang === 'es' ? 'META' : 'FINISH'}</span>
            </span>
          </div>

          {/* Avatar avanzando por el camino */}
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: avatarPos.x,
              top: avatarPos.y - 52,
              transition: mover ? 'left 1.1s cubic-bezier(.5,.05,.2,1), top 1.1s cubic-bezier(.5,.05,.2,1)' : 'none',
            }}
          >
            <AgentAvatar agente="Babel" size={52} className="shadow-xl shadow-teal-500/30 ring-2 ring-teal-300/70" />
          </div>
        </div>
      </div>

      {/* Panel de la sección actual y controles */}
      <div className="border-t border-white/10 px-4 py-3">
        {meta ? (
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-300">
            {lang === 'es'
              ? '¡Completaste todo el recorrido! Sigue avanzando con los Mundos Premium y los retos del Tablero.'
              : 'You completed the whole journey! Keep going with the Premium Worlds and the Board challenges.'}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-slate-800 dark:text-white">
                {avatarPos.icono} {esEtiqueta(avatarPos, lang)}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {lang === 'es'
                  ? 'Abre la sección para trabajarla y marca aquí cuando la completes: Babel avanzará al siguiente punto.'
                  : 'Open the section, work on it, and mark it done here: Babel will advance to the next point.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavegar(avatarPos)}
              className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-400 px-3 py-1.5 text-xs font-extrabold text-white shadow-md shadow-teal-500/30 transition hover:opacity-90"
            >
              {lang === 'es' ? 'Abrir sección →' : 'Open section →'}
            </button>
            <button
              type="button"
              onClick={() => onCompletar(avatarPosId)}
              className="rounded-lg border border-emerald-400/60 bg-white/40 px-3 py-1.5 text-xs font-extrabold text-emerald-700 backdrop-blur-md transition hover:bg-white/70 dark:bg-white/10 dark:text-emerald-200 dark:hover:bg-white/20"
            >
              ✓ {lang === 'es' ? 'Completar y avanzar' : 'Complete & advance'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorldMap;