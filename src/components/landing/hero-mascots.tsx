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
// Implementación 100% CSS (clases que YA existen en tailwind.config.ts:
// animate-slide-up para la entrada, animate-avatar-float para el flotado
// continuo que trae AgentAvatar) — sin agregar ninguna librería nueva, para
// no tener que tocar package.json/package-lock.json a mano en GitHub.
const AGENTES: { id: AgenteAvatarId; left: string; top: string }[] = [
  { id: 'Babel', left: '50%', top: '10%' },
  { id: 'Fisnando', left: '16%', top: '30%' },
  { id: 'Karmetin', left: '84%', top: '30%' },
  { id: 'Normau', left: '12%', top: '68%' },
  { id: 'Atech', left: '88%', top: '68%' },
  { id: 'Ecori', left: '50%', top: '84%' },
];

// ms entre la aparición de un agente y el siguiente.
const RETRASO_ENTRE_AGENTES = 150;
// ms antes de que aparezca el primer agente.
const RETRASO_INICIAL = 150;
// ms extra después del último agente antes de mostrar el mensaje de invitación.
const RETRASO_MENSAJE = 250;

export function HeroMascots() {
  const t = useTranslations('landing.hero');

  return (
    <div
      className="relative mt-6 aspect-[4/3] w-full max-w-sm overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50 via-white to-emerald-50 shadow-lg"
      role="img"
      aria-label={t('title')}
    >
      {AGENTES.map((agente, i) => (
        <div
          key={agente.id}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: agente.left, top: agente.top }}
        >
          <div
            className="opacity-0 animate-slide-up motion-reduce:animate-none motion-reduce:opacity-100"
            style={{ animationDelay: `${RETRASO_INICIAL + i * RETRASO_ENTRE_AGENTES}ms` }}
          >
            <AgentAvatar agente={agente.id} pose="guiando" size={56} />
          </div>
        </div>
      ))}

      {/* Mensaje de invitación: aparece al final, cuando ya se "juntaron" todos los agentes. */}
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-4 py-1.5 text-xs font-semibold text-emerald-700 opacity-0 shadow-md backdrop-blur animate-slide-up motion-reduce:animate-none motion-reduce:opacity-100"
        style={{ animationDelay: `${RETRASO_INICIAL + AGENTES.length * RETRASO_ENTRE_AGENTES + RETRASO_MENSAJE}ms` }}
      >
        {t('ctaPrimary')}
      </div>
    </div>
  );
}
