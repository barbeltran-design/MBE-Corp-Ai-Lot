'use client';

import React from 'react';
import { HelpCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';

export type TourStep = {
  selector?: string;
  title: string;
  description: string;
  placement?: 'bottom' | 'top';
};

type PageTourProps = {
  pageId: string;
  steps: TourStep[];
  lang: 'es' | 'en';
  autoOpen?: boolean;
};

const STORAGE_KEY = 'babel_tutorials_v1';

function leerProgreso(pageId: string): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed[pageId] === true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

function guardarProgreso(pageId: string) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = Object.assign({}, parsed, { [pageId]: true });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error(err);
  }
}

type Rect = { top: number; left: number; width: number; height: number; bottom: number };

function medir(selector?: string): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el || !(el instanceof HTMLElement)) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom };
}

export default function PageTour({ pageId, steps, lang, autoOpen = true }: PageTourProps) {
  const [abierto, setAbierto] = React.useState(false);
  const [indice, setIndice] = React.useState(0);
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [done, setDone] = React.useState(false);
  const [montado, setMontado] = React.useState(false);

  React.useEffect(() => {
    setMontado(true);
    setDone(leerProgreso(pageId));
  }, [pageId]);

  React.useEffect(() => {
    if (!autoOpen || !montado || done || abierto) return;
    const t = window.setTimeout(() => {
      setAbierto(true);
      setIndice(0);
    }, 900);
    return () => window.clearTimeout(t);
  }, [autoOpen, montado, done, abierto]);

  React.useEffect(() => {
    if (!abierto) return;
    const medirInterval = window.setInterval(() => {
      const step = steps[indice];
      setRect(medir(step && step.selector));
    }, 400);
    const medirAhora = () => {
      const step = steps[indice];
      setRect(medir(step && step.selector));
    };
    medirAhora();
    window.addEventListener('scroll', medirAhora, true);
    window.addEventListener('resize', medirAhora);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setAbierto(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearInterval(medirInterval);
      window.removeEventListener('scroll', medirAhora, true);
      window.removeEventListener('resize', medirAhora);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [abierto, indice, steps]);

  if (!montado) return null;

  const terminar = () => {
    guardarProgreso(pageId);
    setDone(true);
    setAbierto(false);
  };

  const omitir = () => {
    setAbierto(false);
  };

  const siguiente = () => {
    if (indice + 1 >= steps.length) {
      terminar();
    } else {
      setIndice((prev) => prev + 1);
    }
  };

  const step = steps[indice];
  const total = steps.length;
  const padding = 8;
  const spotlight: React.CSSProperties | null = rect
    ? {
        position: 'fixed',
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: 16,
        boxShadow: '0 0 0 9999px rgba(9, 14, 24, 0.62)',
        border: '2px solid #2dd4bf',
        zIndex: 61,
        pointerEvents: 'none',
        transition: 'top 200ms ease, left 200ms ease, width 200ms ease, height 200ms ease',
      }
    : {
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(9, 14, 24, 0.62)',
        zIndex: 61,
        pointerEvents: 'none',
      };

  const cardW = 320;
  let cardTop = 0;
  let cardLeft = 0;
  const cardH = 200;
  if (rect) {
    const step0 = step || ({} as TourStep);
    const placement = step0.placement || 'bottom';
    if (placement === 'bottom' && rect.bottom + cardH + 24 > window.innerHeight) {
      cardTop = Math.max(12, rect.top - cardH - 14);
      cardLeft = Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), window.innerWidth - cardW - 12);
    } else if (placement === 'bottom') {
      cardTop = rect.bottom + 14;
      cardLeft = Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), window.innerWidth - cardW - 12);
    } else {
      cardTop = Math.max(12, rect.top - cardH - 14);
      cardLeft = Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), window.innerWidth - cardW - 12);
    }
  } else {
    cardTop = Math.max(12, window.innerHeight / 2 - cardH / 2);
    cardLeft = Math.min(Math.max(12, window.innerWidth / 2 - cardW / 2), window.innerWidth - cardW - 12);
  }

  const texto = lang === 'en'
    ? { skip: 'Skip', prev: 'Previous', next: 'Next', done: 'Done', step: (a: number, b: number) => 'Step ' + a + ' of ' + b, launcher: 'Tutorial' }
    : { skip: 'Omitir', prev: 'Anterior', next: 'Siguiente', done: 'Listo', step: (a: number, b: number) => 'Paso ' + a + ' de ' + b, launcher: 'Tutorial' };

  return (
    <React.Fragment>
      {abierto ? (
        <div className="fixed inset-0 z-[60]" style={{ pointerEvents: 'none' }}>
          <div style={spotlight} />
          <div
            className="animate-slide-up rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
            style={{ position: 'fixed', top: cardTop, left: cardLeft, width: cardW, zIndex: 62, pointerEvents: 'auto' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-teal-600 px-2 text-xs font-bold text-white">
                  {indice + 1}/{total}
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-white">{step.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.description}</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={omitir}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {texto.skip}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIndice((prev) => Math.max(0, prev - 1))}
                  disabled={indice === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <ChevronLeft size={14} />
                  {texto.prev}
                </button>
                <button
                  type="button"
                  onClick={siguiente}
                  className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
                >
                  {indice + 1 >= total ? texto.done : texto.next}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setIndice(0);
          setAbierto(true);
        }}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 transition-transform hover:scale-105 hover:bg-teal-700"
      >
        <HelpCircle size={16} />
        {texto.launcher}
      </button>
    </React.Fragment>
  );
}
