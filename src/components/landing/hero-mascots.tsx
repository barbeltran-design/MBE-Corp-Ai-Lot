'use client';

import { useTranslations } from 'next-intl';
import AgentAvatar, { type AgenteAvatarId } from '@/components/agentes/AgentAvatar';

// Reemplaza la foto estática del hero: los 6 agentes de IA (ya existentes en
// /public/avatars, mismos assets que usa AgentsPreview más abajo en la
// página) aparecen uno por uno como si se fueran "juntando" alrededor del
// centro, en pose "guiando" (la más expresiva de cada uno — Karmetin
// saludando, Ecori con el cartel de los ODS, etc.), y al final aparece un
// mensaje invitando a unirse. Instrucción del usuario: sustituir la imagen 1
// del hero por una animación con los personajes, al estilo del video de
// referencia que compartió (los personajes se juntan e invitan al
// observador a unirse).
//
// La animación de entrada es propia (definida abajo con `styled-jsx`, que ya
// viene incluido con Next.js — no es una librería nueva que haya que
// instalar) en vez de la utilidad compartida `animate-slide-up` de
// Tailwind: esa era demasiado rápida/sutil (220ms, 8px) para notarse como
// una animación real, y además mezclaba en el mismo elemento el centrado
// horizontal (translate-x-1/2) con el transform de la animación, lo que
// borraba el centrado del mensaje al terminar — por eso no se veía. Aquí
// cada pieza que se anima va en su propio div, separado del div que solo
// posiciona/centra, para que ambos transforms no choquen.
const AGENTES: { id: AgenteAvatarId; left: string; top: string }[] = [
  { id: 'Babel', left: '50%', top: '10%' },
  { id: 'Fisnando', left: '16%', top: '30%' },
  { id: 'Karmetin', left: '84%', top: '30%' },
  { id: 'Normau', left: '12%', top: '68%' },
  { id: 'Atech', left: '88%', top: '68%' },
  { id: 'Ecori', left: '50%', top: '84%' },
];

// ms entre la aparición de un agente y el siguiente (antes 150ms, muy rápido
// para notarse; ahora 220ms para que se vea claramente "uno por uno").
const RETRASO_ENTRE_AGENTES = 220;
// ms antes de que aparezca el primer agente.
const RETRASO_INICIAL = 200;
// duración de la animación de entrada de cada pieza (antes 220ms).
const DURACION_ENTRADA = 550;
// ms extra después del último agente antes de mostrar el mensaje de invitación.
const RETRASO_MENSAJE = 350;

export function HeroMascots() {
  const t = useTranslations('landing.hero');
  const delayMensajeMs = RETRASO_INICIAL + AGENTES.length * RETRASO_ENTRE_AGENTES + RETRASO_MENSAJE;

  return (
    <div
      className="relative mt-6 aspect-[4/3] w-full max-w-sm overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50 via-white to-emerald-50 shadow-lg"
      role="img"
      aria-label={t('title')}
    >
      {AGENTES.map((agente, i) => (
        // Este div SOLO posiciona/centra al agente (left/top + translate de
        // centrado) — no lleva animación, así su transform de centrado nunca
        // se pisa con el de la entrada.
        <div
          key={agente.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: agente.left, top: agente.top }}
        >
          {/* Este div interno SOLO anima la entrada (fade + escala + subida). */}
          <div className="hero-mascot-in" style={{ animationDelay: `${RETRASO_INICIAL + i * RETRASO_ENTRE_AGENTES}ms` }}>
            <AgentAvatar agente={agente.id} pose="guiando" size={56} />
          </div>
        </div>
      ))}

      {/* Mensaje de invitación: aparece al final, cuando ya se "juntaron" todos los agentes. */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
        <div
          className="hero-mascot-in whitespace-nowrap rounded-full bg-white/90 px-4 py-1.5 text-xs font-semibold text-emerald-700 shadow-md backdrop-blur"
          style={{ animationDelay: `${delayMensajeMs}ms` }}
        >
          {t('ctaPrimary')}
        </div>
      </div>

      <style jsx>{`
        .hero-mascot-in {
          opacity: 0;
          animation: hero-mascot-in ${DURACION_ENTRADA}ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes hero-mascot-in {
          from {
            opacity: 0;
            transform: translateY(22px) scale(0.82);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-mascot-in {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
