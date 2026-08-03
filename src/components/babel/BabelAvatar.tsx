import React from 'react';

export type BabelAvatarState = 'idle' | 'thinking' | 'talking';

type BabelAvatarProps = {
  state?: BabelAvatarState;
  size?: number;
  className?: string;
  onClick?: () => void;
};

// Avatar dinamico de Babel: estratega de cuerpo completo en SVG propio (sin
// dependencias), paleta del logo MBE (teal #30B8D0 / #1D7686, ink #201818).
// Estados:
//   idle     -> flota suave y parpadea cada ~5s
//   thinking -> antena en ambar + tres puntos con aparicion escalonada
//   talking  -> la boca se abre y cierra con ondas de sonido
// Interaccion: onClick opcional (boton de ayuda de secciones).
export default function BabelAvatar({ state = 'idle', size = 64, className = '', onClick }: BabelAvatarProps) {
  const thinking = state === 'thinking';
  const talking = state === 'talking';
  return (
    <div
      aria-hidden={onClick ? undefined : 'true'}
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      className={
        'relative inline-flex items-center justify-center rounded-2xl transition-shadow duration-300 ' +
        (thinking ? 'shadow-lg ring-2 ring-teal-400/60' : '') +
        (onClick ? ' cursor-pointer' : '') +
        (className ? ' ' + className : '')
      }
      style={{ width: size, height: size }}
    >
      <div
        className={'animate-avatar-float ' + (talking ? 'scale-[1.02]' : '')}
        style={{ width: size * 0.78, height: size }}
      >
        <svg viewBox="0 0 160 205" width="100%" height="100%" className="block drop-shadow-sm">
          <defs>
            <linearGradient id="babel-avatar-head" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3ec8de" />
              <stop offset="100%" stopColor="#1d7686" />
            </linearGradient>
            <linearGradient id="babel-avatar-jacket" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1d8193" />
              <stop offset="100%" stopColor="#0f5a67" />
            </linearGradient>
          </defs>

          {/* Sombra de piso */}
          <ellipse cx="80" cy="198" rx="38" ry="6" fill="#0f172a" opacity="0.1" />

          {/* Antena con luz de estado */}
          <line x1="80" y1="30" x2="80" y2="20" stroke="#1d7686" strokeWidth="4" strokeLinecap="round" />
          <circle cx="80" cy="16" r="5" fill={thinking ? '#ffd166' : '#2fb8d1'} className={thinking ? 'animate-pulse-subtle' : ''} />

          {/* Puntos de pensamiento */}
          {thinking ? (
            <g>
              <circle cx="104" cy="22" r="3.2" fill="#2fb8d1" className="animate-avatar-think-dot" />
              <circle cx="113" cy="14" r="3.2" fill="#2fb8d1" className="animate-avatar-think-dot" style={{ animationDelay: '180ms' }} />
              <circle cx="122" cy="6" r="3.2" fill="#2fb8d1" className="animate-avatar-think-dot" style={{ animationDelay: '360ms' }} />
            </g>
          ) : null}

          {/* Ondas de sonido al hablar */}
          {talking ? (
            <g className="animate-pulse-subtle">
              <rect x="29" y="56" width="5" height="14" rx="2.5" fill="#2fb8d1" opacity="0.8" />
              <rect x="20" y="49" width="5" height="28" rx="2.5" fill="#2fb8d1" opacity="0.55" />
            </g>
          ) : null}

          {/* Cabeza */}
          <rect x="46" y="34" width="68" height="56" rx="16" fill="url(#babel-avatar-head)" />

          {/* Pelo */}
          <path
            d="M46 54 L46 44 Q46 32 58 32 L102 32 Q114 32 114 44 L114 54 L106 50 L54 50 Z"
            fill="#201818"
          />

          {/* Lentes de estratega */}
          <circle cx="63" cy="64" r="8" fill="rgba(255,255,255,0.15)" stroke="#201818" strokeWidth="2.5" />
          <circle cx="97" cy="64" r="8" fill="rgba(255,255,255,0.15)" stroke="#201818" strokeWidth="2.5" />
          <line x1="71" y1="64" x2="89" y2="64" stroke="#201818" strokeWidth="2.5" />
          <line x1="55" y1="64" x2="49" y2="58" stroke="#201818" strokeWidth="2.5" />
          <line x1="105" y1="64" x2="111" y2="58" stroke="#201818" strokeWidth="2.5" />

          {/* Ojos (parpadean en idle) */}
          <g className={thinking || talking ? '' : 'animate-avatar-blink'} style={{ transformOrigin: 'center' }}>
            <ellipse cx="63" cy="65" rx="5.2" ry="6.5" fill="#ffffff" />
            <ellipse cx="97" cy="65" rx="5.2" ry="6.5" fill="#ffffff" />
          </g>
          <circle cx="64.6" cy="67" r="2.7" fill="#201818" />
          <circle cx="95.4" cy="67" r="2.7" fill="#201818" />

          {/* Boca (se anima al hablar) */}
          <rect
            className={talking ? 'animate-avatar-talk' : ''}
            style={{ transformOrigin: 'center' }}
            x="70"
            y="86"
            width="20"
            height="6"
            rx="3"
            fill="#ffffff"
            fillOpacity="0.95"
          />

          {/* Cuello */}
          <rect x="72" y="88" width="16" height="12" fill="#14616e" />

          {/* Saco / traje */}
          <rect x="46" y="100" width="68" height="56" rx="14" fill="url(#babel-avatar-jacket)" />
          <polygon points="80,102 66,112 80,124 94,112" fill="#f1f5f9" />
          <polygon points="80,102 70,110 80,108" fill="#e2e8f0" />
          <polygon points="80,102 90,110 80,108" fill="#e2e8f0" />
          <polygon points="80,108 85,114 80,150 75,114" fill="#201818" />

          {/* Brazos */}
          <rect x="36" y="108" width="12" height="40" rx="6" fill="#1d8193" />
          <circle cx="42" cy="152" r="6.5" fill="#f6c9a2" />
          <rect x="112" y="108" width="12" height="40" rx="6" fill="#1d8193" />
          <circle cx="118" cy="152" r="6.5" fill="#f6c9a2" />

          {/* Tablet del plan (mano izquierda) */}
          <rect x="28" y="138" width="28" height="42" rx="5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="34" y1="148" x2="50" y2="148" stroke="#0ea5b7" strokeWidth="3" strokeLinecap="round" />
          <line x1="34" y1="156" x2="47" y2="156" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="34" y1="164" x2="43" y2="164" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" />

          {/* Piernas y zapatos */}
          <rect x="58" y="152" width="16" height="26" rx="5" fill="#201818" />
          <rect x="86" y="152" width="16" height="26" rx="5" fill="#201818" />
          <rect x="54" y="176" width="24" height="12" rx="6" fill="#0f5a67" />
          <rect x="82" y="176" width="24" height="12" rx="6" fill="#0f5a67" />
        </svg>
      </div>
    </div>
  );
}
