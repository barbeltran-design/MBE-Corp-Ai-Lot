'use client';

import * as React from 'react';
import { insigniaPorId } from '@/lib/insignias';

interface Props {
  insigniaId: string | null;
  lang: 'es' | 'en';
  onClose: () => void;
}

/**
 * Modal de felicitación cuando el usuario alcanza una insignia nueva.
 * Se muestra sobre la vista actual (Mundos, Club, etc.) y se cierra al
 * hacer clic fuera o en "Genial".
 */
export function InsigniaCelebracion({ insigniaId, lang, onClose }: Props) {
  const insignia = insigniaId ? insigniaPorId(insigniaId) : undefined;
  if (!insignia) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="world-glass world-grain max-w-sm animate-in fade-in zoom-in rounded-2xl p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-6xl">{insignia.icon}</div>
        <p className="mt-2 text-xs font-extrabold uppercase tracking-wide text-amber-600 dark:text-amber-300">
          {lang === 'en' ? '🎉 New badge!' : '🎉 ¡Nueva insignia!'}
        </p>
        <h3 className="mt-1 text-lg font-extrabold text-slate-800 dark:text-white">
          {lang === 'en' ? insignia.en : insignia.es}
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {lang === 'en' ? insignia.descEn : insignia.descEs}
        </p>
        <button
          type="button"
          className="mt-4 rounded-full bg-teal-600 px-5 py-2 text-xs font-extrabold text-white shadow hover:bg-teal-700"
          onClick={onClose}
        >
          {lang === 'en' ? 'Awesome!' : '¡Genial!'}
        </button>
      </div>
    </div>
  );
}
