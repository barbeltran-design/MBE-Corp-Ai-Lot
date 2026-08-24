'use client';
import React from 'react';
import Link from 'next/link';
import { esMentorValido, MENTOR_IDS, type MentorId } from '@/lib/mentores';
import {
  type PlanLang,
  type Objetivo,
  type AmenazaOportunidad,
  type FortalezaDebilidad,
  type Proyecto,
  type Accion,
  FACTIBILIDAD_OPTIONS,
  IMPACTO_OPTIONS,
  priorityRank,
  priorityTier,
  suggestedDate,
  loadPlanAccion,
  savePlanAccion,
  proyectoDeAccion,
  objetivosDeAccion,
  LABELS,
} from '@/lib/plan-accion';

export default function AccionesPlanBuilder({ lang }: { lang: PlanLang }) {
  const t = LABELS[lang];

  const [objetivos, setObjetivos] = React.useState<Objetivo[]>([]);
  const [entornos, setEntornos] = React.useState<AmenazaOportunidad[]>([]);
  const [fds, setFds] = React.useState<FortalezaDebilidad[]>([]);
  const [proyectos, setProyectos] = React.useState<Proyecto[]>([]);
  const [acciones, setAcciones] = React.useState<Accion[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const plan = loadPlanAccion();
    if (plan) {
      setObjetivos(plan.objetivos);
      setEntornos(plan.entornos);
      setFds(plan.fds);
      setProyectos(plan.proyectos);
      setAcciones(plan.acciones);
    }
    setLoaded(true);
  }, []);

  React.useEffect(() => {
    if (!loaded) return;
    savePlanAccion({ objetivos, entornos, fds, proyectos, acciones });
  }, [objetivos, entornos, fds, proyectos, acciones, loaded]);

  const plan = { objetivos, entornos, fds, proyectos, acciones };

  const updateAccion = (id: string, patch: Partial<Accion>) =>
    setAcciones((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const merged = Object.assign({}, a, patch);
        const oldSuggested = suggestedDate(priorityRank(a.factibilidad, a.impacto));
        if ((patch.factibilidad || patch.impacto) && (!a.fecha || a.fecha === oldSuggested)) {
          merged.fecha = suggestedDate(priorityRank(merged.factibilidad, merged.impacto));
        }
        return merged;
      })
    );

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-800">{t.vistaAccionesTitle}</h3>
          <p className="mt-1 text-sm text-slate-500">{t.vistaAccionesSubtitle}</p>
        </div>
        <Link
          href={'/' + lang + '/babel/plan-accion'}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {'← ' + t.verPorObjetivos}
        </Link>
      </div>

      {acciones.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{t.sinAccionesPlan}</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">{t.accionCol}</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">{t.prioridadCol}</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">{t.objetivosCol}</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">{t.mentorCol}</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">{t.responsableCol}</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">{t.fechaCol}</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">{t.proyectoCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {acciones.map((a) => {
                const proyecto = proyectoDeAccion(a.id, plan);
                const objetivosImpactados = objetivosDeAccion(a.id, plan);
                const rank = priorityRank(a.factibilidad, a.impacto);
                const tier = priorityTier(rank, lang);
                return (
                  <tr key={a.id} className="align-top">
                    <td className="max-w-xs px-3 py-2">
                      <p className="whitespace-pre-wrap text-slate-800">{a.descripcion || '—'}</p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <select
                          value={a.factibilidad}
                          onChange={(ev) => updateAccion(a.id, { factibilidad: ev.target.value as Accion['factibilidad'] })}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        >
                          {FACTIBILIDAD_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {lang === 'en' ? opt.labelEn : opt.labelEs}
                            </option>
                          ))}
                        </select>
                        <select
                          value={a.impacto}
                          onChange={(ev) => updateAccion(a.id, { impacto: ev.target.value as Accion['impacto'] })}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        >
                          {IMPACTO_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {lang === 'en' ? opt.labelEn : opt.labelEs}
                            </option>
                          ))}
                        </select>
                        <span className={'inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-center text-xs font-medium ' + tier.classes}>
                          {'#' + rank + ' - ' + tier.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {objetivosImpactados.length === 0 ? (
                        <span className="text-xs text-slate-400">{t.sinObjetivosVinculados}</span>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {objetivosImpactados.map((o) => (
                            <li key={o.id} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                              {o.texto || '—'}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={esMentorValido(a.mentor) ? a.mentor : ''}
                        onChange={(ev) => updateAccion(a.id, { mentor: (ev.target.value || undefined) as MentorId | undefined })}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      >
                        <option value="">{lang === 'en' ? 'Auto' : 'Automatico'}</option>
                        {MENTOR_IDS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={a.responsableNombre}
                        onChange={(ev) => updateAccion(a.id, { responsableNombre: ev.target.value })}
                        placeholder={t.responsableNombreLabel}
                        className="w-full min-w-[9rem] rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={a.fecha}
                        onChange={(ev) => updateAccion(a.id, { fecha: ev.target.value })}
                        className="w-full min-w-[8.5rem] rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {proyecto ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-600">{proyecto.nombre || t.proyectoChip}</span>
                          <Link
                            href={'/' + lang + '/babel/plan-accion/proyecto/' + proyecto.id}
                            className="text-xs font-medium text-blue-600 hover:underline"
                          >
                            {t.verFichaProyecto}
                          </Link>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">{t.savedNote}</p>
    </div>
  );
}
