import React from 'react';

export type BabelAvatarState = 'idle' | 'thinking' | 'talking';

type BabelAvatarProps = {
  state?: BabelAvatarState;
  size?: number;
  className?: string;
};

// Avatar dinamico de Babel: SVG propio sin dependencias (paleta del logo MBE:
// teal #30B8D0 / #1D7686 e ink #201818). Estados:
//   idle     -> flota suave y parpadea cada ~5s
//   thinking -> anillo pulsante + tres puntos con aparicion escalonada
//   talking  -> la boca se abre y cierra (ondas de sonido)
export default function BabelAvatar({ state = 'idle', size = 64, className = '' }: BabelAvatarProps) {
  const thinking = state === 'thinking';
  const talking = state === 'talking';
  return (
    <div
      aria-hidden="true"
      className={
        'relative inline-flex items-center justify-center rounded-2xl transition-shadow duration-300 ' +
        (thinking ? 'shadow-lg ring-2 ring-teal-400/60' : '') +
        (className ? ' ' + className : '')
      }
      style={{ width: size, height: size }}
    >
      <div className={'animate-avatar-float ' + (talking ? 'scale-105' : '')} style={{ width: size * 0.86, height: size * 0.86 }}>
        <svg viewBox="0 0 120 120" width="100%" height="100%" className="block drop-shadow-sm">
          <defs>
            <linearGradient id="babel-avatar-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#35c3d9" />
              <stop offset="100%" stopColor="#1d7686" />
            </linearGradient>
          </defs>

          {/* Antena con luz de estado */}
          <line x1="60" y1="16" x2="60" y2="30" stroke="#1d7686" strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="12" r="5.5" fill={thinking ? '#ffd166' : '#2fb8d1'} className={thinking ? 'animate-pulse-subtle' : ''} />

          {/* Cabeza */}
          <rect x="18" y="30" width="84" height="78" rx="26" fill="url(#babel-avatar-grad)" />
          <rect x="22" y="34" width="76" height="70" rx="22" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="3" />

          {/* Ojos (parpadean en idle) */}
          <g className={thinking || talking ? '' : 'animate-avatar-blink'} style={{ transformOrigin: 'center' }}>
            <ellipse cx="43" cy="62" rx="7.5" ry="9.5" fill="#ffffff" />
            <ellipse cx="77" cy="62" rx="7.5" ry="9.5" fill="#ffffff" />
          </g>
          <circle cx="45" cy="64" r="3.2" fill="#201818" />
          <circle cx="75" cy="64" r="3.2" fill="#201818" />

          {/* Boca (se anima al hablar) */}
          <rect
            className={talking ? 'animate-avatar-talk' : ''}
            style={{ transformOrigin: 'center' }}
            x="44"
            y="88"
            width="32"
            height="8"
            rx="4"
            fill="#ffffff"
            fillOpacity="0.95"
          />

          {/* Ondas de sonido al hablar */}
          {talking ? (
            <g className="animate-pulse-subtle">
              <rect x="22" y="78" width="4" height="12" rx="2" fill="#ffffff" fillOpacity="0.55" />
              <rect x="94" y="78" width="4" height="12" rx="2" fill="#ffffff" fillOpacity="0.55" />
            </g>
          ) : null}
        </svg>
      </div>

      {/* Puntos de pensamiento */}
      {thinking ? (
        <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block h-1.5 w-1.5 rounded-full bg-teal-500 animate-avatar-think-dot"
              style={{ animationDelay: i * 180 + 'ms' }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
