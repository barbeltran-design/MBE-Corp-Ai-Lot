import React from 'react';
import { BABEL_AYUDA_EVENT } from '@/components/babel/BabelAvatar';

export type AgenteAvatarId = 'Babel' | 'Fisnando' | 'Karmetin' | 'Normau' | 'Atech';
export type AgentePose = 'reposando' | 'guiando';

type AgentAvatarProps = {
  agente?: AgenteAvatarId;
  pose?: AgentePose;
  size?: number;
  className?: string;
  onClick?: () => void;
};

const AGENTE_SLUG: Record<AgenteAvatarId, string> = {
  Babel: 'babel',
  Fisnando: 'fisnando',
  Karmetin: 'karmetin',
  Normau: 'normau',
  Atech: 'atech',
};

// Avatar por agente usando las ilustraciones PNG de MBE Worlds. Dos poses:
//   reposando -> la normal (idle)
//   guiando   -> cuando el agente responde/atiende una peticion de informacion
// Al hacer clic sin onClick: emite BABEL_AYUDA_EVENT (tutorial/ayuda por
// seccion, solo Babel) y ademas abre un modal con el avatar en grande (zoom).
export default function AgentAvatar({ agente = 'Babel', pose = 'reposando', size = 64, className = '', onClick }: AgentAvatarProps) {
  const esBabel = agente === 'Babel';
  const [zoom, setZoom] = React.useState(false);

  const manejarClic = () => {
    if (onClick) {
      onClick();
    } else {
      setZoom(true);
      if (esBabel) {
        window.dispatchEvent(new CustomEvent(BABEL_AYUDA_EVENT));
      }
    }
  };

  return (
    <>
      <div
        data-babel-avatar="true"
        aria-hidden={onClick || zoom ? undefined : 'true'}
        role={onClick ? 'button' : 'button'}
        onClick={manejarClic}
        className={
          'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/40 backdrop-blur-md transition-shadow duration-300 ' +
          'cursor-pointer ' +
          (className ? ' ' + className : '')
        }
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/avatars/${AGENTE_SLUG[agente]}-${pose}.png`}
          alt={`${agente} ${pose}`}
          width={size}
          height={size}
          className="animate-avatar-float h-full w-full object-cover"
        />
      </div>

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setZoom(false)}
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') setZoom(false);
          }}
          className="fixed inset-0 z-[58] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(ev) => ev.stopPropagation()}
            className="animate-pop-in relative flex flex-col items-center rounded-3xl border border-white/20 bg-gradient-to-b from-slate-800 to-slate-900 p-6 shadow-2xl shadow-black/50"
          >
            <button
              type="button"
              onClick={() => setZoom(false)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white transition hover:bg-white/20"
              aria-label="Cerrar zoom"
              title="Cerrar"
            >
              ×
            </button>
            <div className="h-64 w-64 overflow-hidden rounded-2xl shadow-xl ring-2 ring-teal-400/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/avatars/${AGENTE_SLUG[agente]}-${pose}.png`}
                alt={`${agente} ${pose}`}
                width={256}
                height={256}
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-4 text-base font-extrabold tracking-wide text-white">{agente}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-teal-300">
              {pose === 'guiando' ? 'Guiando' : 'Reposando'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}