'use client';

import { useTranslations } from 'next-intl';
import AgentAvatar, { type AgenteAvatarId } from '@/components/agentes/AgentAvatar';

const AGENTES: AgenteAvatarId[] = ['Babel', 'Fisnando', 'Karmetin', 'Normau', 'Atech', 'Ecori'];

export function AgentsPreview() {
  const t = useTranslations('landing.agentsPreview');

  return (
    <section id="agentes" className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {t('title')}
        </h2>
        <p className="mt-3 text-slate-600">{t('subtitle')}</p>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {AGENTES.map((agente) => {
          const key = agente.toLowerCase();
          return (
            <div
              key={agente}
              className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-6 text-center shadow-sm transition-shadow hover:shadow-md"
            >
              <AgentAvatar agente={agente} pose="reposando" size={64} />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {t(`agents.${key}.name`)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t(`agents.${key}.domain`)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
