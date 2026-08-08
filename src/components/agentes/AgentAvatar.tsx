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
// Interaccion igual que BabelAvatar: sin onClick, tocar al avatar (el de
// Babel) emite BABEL_AYUDA_EVENT para que PageTour abra la ayuda por seccion.
export default function AgentAvatar({ agente = 'Babel', pose = 'reposando', size = 64, className = '', onClick }: AgentAvatarProps) {
  const esBabel = agente === 'Babel';
  return (
    <div
      data-babel-avatar="true"
      aria-hidden={onClick ? undefined : 'true'}
      role={onClick ? 'button' : undefined}
      onClick={() => {
        if (onClick) {
          onClick();
        } else if (esBabel) {
          window.dispatchEvent(new CustomEvent(BABEL_AYUDA_EVENT));
        }
      }}
      className={
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/40 backdrop-blur-md transition-shadow duration-300 ' +
        (onClick ? ' cursor-pointer' : '') +
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