'use client';

import React from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import BabelAvatar from '@/components/babel/BabelAvatar';

export type TourStep = {
  selector?: string;
  title: string;
  description: string;
  placement?: 'bottom' | 'top';
};

export type PageTourHandle = {
  openAyuda: () => void;
  openTour: () => void;
};

type PageTourProps = {
  pageId: string;
  steps: TourStep[];
  lang: 'es' | 'en';
  autoOpen?: boolean;
  showLauncher?: boolean;
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

function findStep(target: EventTarget | null, steps: TourStep[]): TourStep | null {
  let node: Element | null = target instanceof Element ? target : null;
  while (node) {
    const s = steps.find((x) => x.selector && node!.matches(x.selector));
    if (s) return s;
    node = node.parentElement;
  }
  return null;
}

const T_ES = {
  skip: 'Omitir',
  prev: 'Anterior',
  next: 'Siguiente',
  done: 'Listo',
  step: (a: number, b: number) => 'Paso ' + a + ' de ' + b,
  close: 'Cerrar',
  launcherAria: 'Ayuda de Babel',
  bubbleTitle: '¿Tienes duda de alguna sección?',
  bubbleDesc: 'Toca cualquier sección de la página y te la explico. También puedes volver a ver la guía paso a paso.',
  bubbleGuide: 'Ver guía paso a paso',
  bubbleClose: 'Ahora no',
  gotIt: 'Entendido',
  hint: 'Toca una sección para que te la explique',
};

const T_EN = {
  skip: 'Skip',
  prev: 'Previous',
  next: 'Next',
  done: 'Done',
  step: (a: number, b: number) => 'Step ' + a + ' of ' + b,
  close: 'Close',
  launcherAria: 'Babel help',
  bubbleTitle: 'Any doubts about a section?',
  bubbleDesc: 'Tap any section on the page and I will explain it. You can also replay the step-by-step guide.',
  bubbleGuide: 'Show step-by-step guide',
  bubbleClose: 'Not now',
  gotIt: 'Got it',
  hint: 'Tap a section and I will explain it',
};

export default React.forwardRef<PageTourHandle, PageTourProps>(function PageTour(
  { pageId, steps, lang, autoOpen = true, showLauncher = true },
  ref
) {
  const [modo, setModo] = React.useState<'cerrado' | 'tour' | 'ayuda'>('cerrado');
  const [indice, setIndice] = React.useState(0);
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [done, setDone] = React.useState(false);
  const [montado, setMontado] = React.useState(false);
  const [ayuda, setAyuda] = React.useState<{ step: TourStep; rect: Rect | null; pinned: boolean } | null>(null);

  const autoOpenedRef = React.useRef(false);
  const stepsRef = React.useRef(steps);
  stepsRef.current = steps;
  const launcherRef = React.useRef<HTMLButtonElement>(null);
  const bubbleRef = React.useRef<HTMLDivElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);

  React.useImperativeHandle(ref, () => ({
    openAyuda: () => {
      setAyuda(null);
      setModo('ayuda');
    },
    openTour: () => {
      setIndice(0);
      setModo('tour');
    },
  }));

  React.useEffect(() => {
    setMontado(true);
    setDone(leerProgreso(pageId));
  }, [pageId]);

  const marcarVisto = React.useCallback(() => {
    guardarProgreso(pageId);
    setDone(true);
  }, [pageId]);

  // Auto-open SOLO la primera vez (mientras no este marcado como visto y solo
  // una vez por montaje; cerrar no lo vuelve a abrir).
  React.useEffect(() => {
    if (!autoOpen || !montado || done || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    const t = window.setTimeout(() => {
      setIndice(0);
      setModo('tour');
    }, 900);
    return () => window.clearTimeout(t);
  }, [autoOpen, montado, done]);

  // Modo tour: spotlight + tooltip + scroll al elemento objetivo.
  React.useEffect(() => {
    if (modo !== 'tour') return;
    const stepsActual = stepsRef.current;
    const medirAhora = () => {
      const s = stepsActual[indice];
      setRect(medir(s && s.selector));
    };
    medirAhora();
    const t = window.setTimeout(() => {
      const s = stepsActual[indice];
      if (s && s.selector) {
        const el = document.querySelector(s.selector);
        if (el instanceof HTMLElement) {
          const r = el.getBoundingClientRect();
          if (r.top < 80 || r.bottom > window.innerHeight - 120) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }, 60);
    const intervalo = window.setInterval(medirAhora, 400);
    window.addEventListener('scroll', medirAhora, true);
    window.addEventListener('resize', medirAhora);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        marcarVisto();
        setModo('cerrado');
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(t);
      window.clearInterval(intervalo);
      window.removeEventListener('scroll', medirAhora, true);
      window.removeEventListener('resize', medirAhora);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [modo, indice, marcarVisto]);

  // Modo ayuda: el avatar pregunta y al tocar/señalar una seccion explica.
  React.useEffect(() => {
    if (modo !== 'ayuda') return;
    const stepsActual = stepsRef.current;
    const onMouseOver = (ev: MouseEvent) => {
      const s = findStep(ev.target, stepsActual);
      if (s) {
        setAyuda((prev) =>
          prev && prev.pinned && prev.step.selector === s.selector ? prev : { step: s, rect: medir(s.selector), pinned: false }
        );
      } else {
        setAyuda((prev) => (prev && !prev.pinned ? null : prev));
      }
    };
    const onClick = (ev: MouseEvent) => {
      const t = ev.target as Node | null;
      if (launcherRef.current && launcherRef.current.contains(t)) return;
      if (bubbleRef.current && bubbleRef.current.contains(t)) return;
      if (cardRef.current && cardRef.current.contains(t)) return;
      const s = findStep(ev.target, stepsActual);
      if (s) {
        setAyuda({ step: s, rect: medir(s.selector), pinned: true });
        const el = document.querySelector(s.selector || '');
        if (el instanceof HTMLElement) {
          const r = el.getBoundingClientRect();
          if (r.top < 80 || r.bottom > window.innerHeight - 120) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      } else {
        setAyuda(null);
        setModo('cerrado');
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setAyuda(null);
        setModo('cerrado');
      }
    };
    const intervalo = window.setInterval(() => {
      setAyuda((prev) => (prev ? { ...prev, rect: medir(prev.step.selector) } : prev));
    }, 400);
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [modo]);

  if (!montado) return null;

  const texts = lang === 'en' ? T_EN : T_ES;

  // Posicion del tooltip respecto a un rect.
  const cardW = 320;
  const cardH = 210;
  const posCard = (r: Rect | null): { top: number; left: number } => {
    if (r) {
      const stepActual = ayuda ? ayuda.step : stepsRef.current[indice];
      const placement = stepActual && stepActual.placement === 'top' ? 'top' : 'bottom';
      const top = placement === 'top' || r.bottom + cardH + 24 > window.innerHeight ? r.top - cardH - 14 : r.bottom + 14;
      const left = Math.min(Math.max(12, r.left + r.width / 2 - cardW / 2), window.innerWidth - cardW - 12);
      return { top: Math.max(12, top), left };
    }
    return { top: Math.max(12, window.innerHeight / 2 - cardH / 2), left: Math.min(Math.max(12, window.innerWidth / 2 - cardW / 2), window.innerWidth - cardW - 12) };
  };

  const spotlight: React.CSSProperties | null = rect
    ? {
        position: 'fixed',
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
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

  const cssAyuda = stepsRef.current
    .map((s) => {
      if (!s.selector) return '';
      return (
        s.selector +
        ' { outline: 2px dashed rgba(45,212,191,0.65); outline-offset: 3px; border-radius: 10px; cursor: pointer; }\n' +
        s.selector +
        ':hover { outline-color: #0d9488; }\n'
      );
    })
    .join('');

  const cardBase =
    'animate-slide-up rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700';

  return (
    <React.Fragment>
      {modo === 'tour' ? (
        <div className="fixed inset-0 z-[60]" style={{ pointerEvents: 'none' }}>
          <div style={spotlight} />
          <div
            className={cardBase}
            style={{ position: 'fixed', ...posCard(rect), width: cardW, zIndex: 62, pointerEvents: 'auto' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-teal-600 px-2 text-xs font-bold text-white">
                  {indice + 1}/{steps.length}
                </span>
                <span className="text-sm font-bold text-slate-800 dark:text-white">
                  {stepsRef.current[indice] ? stepsRef.current[indice].title : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  marcarVisto();
                  setModo('cerrado');
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                aria-label={texts.close}
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {stepsRef.current[indice] ? stepsRef.current[indice].description : ''}
            </p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  marcarVisto();
                  setModo('cerrado');
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {texts.skip}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIndice((prev) => Math.max(0, prev - 1))}
                  disabled={indice === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <ChevronLeft size={14} />
                  {texts.prev}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (indice + 1 >= steps.length) {
                      marcarVisto();
                      setModo('cerrado');
                    } else {
                      setIndice((prev) => prev + 1);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
                >
                  {indice + 1 >= steps.length ? texts.done : texts.next}
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {modo === 'ayuda' ? (
        <div className="fixed inset-0 z-[60]" style={{ pointerEvents: 'none' }}>
          <style>{cssAyuda}</style>
          {ayuda ? (
            <div
              ref={cardRef}
              className={cardBase}
              style={{ position: 'fixed', ...posCard(ayuda.rect), width: cardW, zIndex: 62, pointerEvents: 'auto' }}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-bold text-slate-800 dark:text-white">{ayuda.step.title}</span>
                <button
                  type="button"
                  onClick={() => setAyuda(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                  aria-label={texts.close}
                >
                  <X size={16} />
                </button>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{ayuda.step.description}</p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setAyuda(null);
                    setModo('cerrado');
                  }}
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
                >
                  {texts.gotIt}
                </button>
              </div>
            </div>
          ) : (
            <div
              ref={bubbleRef}
              className={cardBase}
              style={{
                position: 'fixed',
                bottom: 96,
                right: 20,
                width: 300,
                maxWidth: 'calc(100vw - 2.5rem)',
                zIndex: 62,
                pointerEvents: 'auto',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm font-bold text-slate-800 dark:text-white">{texts.bubbleTitle}</span>
                <button
                  type="button"
                  onClick={() => setModo('cerrado')}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                  aria-label={texts.close}
                >
                  <X size={16} />
                </button>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{texts.bubbleDesc}</p>
              <p className="mt-2 text-xs font-medium text-teal-700 dark:text-teal-300">{texts.hint}</p>
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIndice(0);
                    setModo('tour');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-teal-600 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-slate-700"
                >
                  {texts.bubbleGuide}
                </button>
                <button
                  type="button"
                  onClick={() => setModo('cerrado')}
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
                >
                  {texts.bubbleClose}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {showLauncher ? (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => {
            if (modo === 'ayuda') {
              setAyuda(null);
              setModo('cerrado');
            } else {
              setAyuda(null);
              setModo('ayuda');
            }
          }}
          aria-label={texts.launcherAria}
          title={texts.bubbleTitle}
          className="fixed bottom-4 right-4 z-50 rounded-full p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <BabelAvatar state="idle" size={64} />
        </button>
      ) : null}
    </React.Fragment>
  );
});
