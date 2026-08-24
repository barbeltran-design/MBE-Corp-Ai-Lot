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
  type OrgData,
  FACTIBILIDAD_OPTIONS,
  IMPACTO_OPTIONS,
  ROLE_OPTIONS,
  priorityRank,
  priorityTier,
  suggestedDate,
  loadPlanAccion,
  savePlanAccion,
  loadOrgData,
  resolvePersonForRole,
  proyectoDeAccion,
  objetivosResueltosDeAccion,
  LABELS,
} from '@/lib/plan-accion';

type SortKey = 'accion' | 'prioridad' | 'objetivos' | 'mentor' | 'responsable' | 'fecha' | 'proyecto';

export default function AccionesPlanBuilder({ lang }: { lang: PlanLang }) {
  const t = LABELS[lang];

  const [objetivos, setObjetivos] = React.useState<Objetivo[]>([]);
  const [entornos, setEntornos] = React.useState<AmenazaOportunidad[]>([]);
  const [fds, setFds] = React.useState<FortalezaDebilidad[]>([]);
  const [proyectos, setProyectos] = React.useState<Proyecto[]>([]);
  const [acciones, setAcciones] = React.useState<Accion[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [org, setOrg] = React.useState<OrgData>({ assignments: {}, presidente: '', secretario: '', consejeros: [] });
  const [sortKey, setSortKey] = React.useState<SortKey | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  React.useEffect(() => {
    const plan = loadPlanAccion();
    if (plan) {
      setObjetivos(plan.objetivos);
      setEntornos(plan.entornos);
      setFds(plan.fds);
      setProyectos(plan.proyectos);
      setAcciones(plan.acciones);
    }
    setOrg(loadOrgData());
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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'desc' ? ' ▼' : ' ▲';
  };

  const filas = acciones.map((a) => {
    const proyecto = proyectoDeAccion(a.id, plan);
    const objetivosRes = objetivosResueltosDeAccion(a.id, plan);
    const rank = priorityRank(a.factibilidad, a.impacto);
    const tier = priorityTier(rank, lang);
    return { a, proyecto, objetivosRes, rank, tier };
  });

  if (sortKey) {
    const dir = sortDir === 'asc' ? 1 : -1;
    filas.sort((x, y) => {
      let cmp = 0;
      switch (sortKey) {
        case 'accion':
          cmp = (x.a.descripcion || '').localeCompare(y.a.descripcion || '');
          break;
        case 'prioridad':
          cmp = (17 - x.rank) - (17 - y.rank);
          break;
        case 'objetivos':
          cmp = x.objetivosRes.length - y.objetivosRes.length;
          break;
        case 'mentor':
          cmp = (x.a.mentor || '').localeCompare(y.a.mentor || '');
          break;
        case 'responsable':
          cmp = (x.a.responsableNombre || '').localeCompare(y.a.responsableNombre || '');
          break;
        case 'fecha':
          cmp = (x.a.fecha || '').localeCompare(y.a.fecha || '');
          break;
        case 'proyecto':
          cmp = (x.proyecto?.nombre || '').localeCompare(y.proyecto?.nombre || '');
          break;
        default:
          break;
      }
      return cmp * dir;
    });
  }

  const headerBtn = (key: SortKey, label: string) => (
    <th
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600 hover:text-slate-900"
      onClick={() => toggleSort(key)}
    >
      {label}
      {sortIndicator(key)}
    </th>
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
                {headerBtn('accion', t.accionCol)}
                {headerBtn('prioridad', t.prioridadCol)}
                {headerBtn('objetivos', t.objetivosCol)}
                {headerBtn('mentor', t.mentorCol)}
                {headerBtn('responsable', t.responsableCol)}
                {headerBtn('fecha', t.fechaCol)}
                {headerBtn('proyecto', t.proyectoCol)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filas.map(({ a, proyecto, objetivosRes, rank, tier }) => {
                const disponibles = objetivos.filter((o) => !objetivosRes.some((x) => x.id === o.id));
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
                    <td className="min-w-[12rem] px-3 py-2">
                      <ul className="flex flex-col gap-1">
                        {objetivosRes.length === 0 ? (
                          <li className="text-xs text-slate-400">{t.sinObjetivosVinculados}</li>
                        ) : (
                          objetivosRes.map((o) => (
                            <li
                              key={o.id}
                              className="flex items-center justify-between gap-2 rounded bg-slate-100 px-2 py-1 text-xs text-slate-700"
                            >
                              <span className="flex-1">{o.texto || '—'}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const nuevos = objetivosRes.filter((x) => x.id !== o.id).map((x) => x.id);
                                  updateAccion(a.id, { objetivoIdsManual: nuevos });
                                }}
                                className="shrink-0 text-[11px] font-medium text-red-600 hover:underline"
                              >
                                {t.quitarObjetivo}
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                      {disponibles.length > 0 ? (
                        <select
                          value=""
                          onChange={(ev) => {
                            const id = ev.target.value;
                            if (!id) return;
                            const actuales = objetivosRes.map((x) => x.id);
                            updateAccion(a.id, { objetivoIdsManual: [...actuales, id] });
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
                        >
                          <option value="">{t.agregarObjetivoLabel}</option>
                          {disponibles.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.texto || '—'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="mt-1 text-[10px] text-slate-400">{t.todosObjetivosAgregados}</p>
                      )}
                      {a.objetivoIdsManual !== undefined ? (
                        <button
                          type="button"
                          onClick={() => updateAccion(a.id, { objetivoIdsManual: undefined })}
                          className="mt-1 text-[11px] font-medium text-blue-600 hover:underline"
                        >
                          {t.volverAutomatico}
                        </button>
                      ) : null}
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
                      <select
                        value={a.responsableRoleKey || ''}
                        onChange={(ev) => {
                          const roleKey = ev.target.value;
                          const persona = roleKey ? resolvePersonForRole(roleKey, org) : '';
                          updateAccion(a.id, { responsableRoleKey: roleKey, responsableNombre: persona });
                        }}
                        className="w-full min-w-[11rem] rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        aria-label={t.responsableLabel}
                      >
                        <option value="">{t.responsableSinAsignar}</option>
                        {ROLE_OPTIONS.map((opt) => {
                          const persona = resolvePersonForRole(opt.key, org);
                          const roleName = lang === 'en' ? opt.nameEn : opt.nameEs;
                          return (
                            <option key={opt.key} value={opt.key}>
                              {roleName + (persona ? ' — ' + persona : ' (' + t.responsableSinAsignar + ')')}
                            </option>
                          );
                        })}
                      </select>
                      {a.responsableNombre ? (
                        <span className="mt-1 block text-[11px] text-slate-500">{a.responsableNombre}</span>
                      ) : null}
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
