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
// seccion, solo Babel). El zoom por hover vive solo en Inicio (CSS).
export default function AgentAvatar({ agente = 'Babel', pose = 'reposando', size = 64, className = '', onClick }: AgentAvatarProps) {
  const esBabel = agente === 'Babel';

  const manejarClic = () => {
    if (onClick) {
      onClick();
    } else if (esBabel) {
      window.dispatchEvent(new CustomEvent(BABEL_AYUDA_EVENT));
    }
  };

  return (
    <div
      data-babel-avatar="true"
      aria-hidden={onClick || esBabel ? undefined : 'true'}
      role="button"
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
  );
}
