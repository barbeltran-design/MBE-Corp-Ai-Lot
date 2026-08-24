'use client';
import React from 'react';
import Link from 'next/link';
import {
  type PlanLang,
  type Objetivo,
  type AmenazaOportunidad,
  type FortalezaDebilidad,
  type Proyecto,
  type Accion,
  priorityRank,
  priorityTier,
  daysUntil,
  loadPlanAccion,
  objetivosDeProyecto,
  LABELS,
} from '@/lib/plan-accion';

export default function FichaProyectoBuilder({ lang, proyectoId }: { lang: PlanLang; proyectoId: string }) {
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

  const plan = { objetivos, entornos, fds, proyectos, acciones };
  const proyecto = proyectos.find((p) => p.id === proyectoId);
  const objetivosImpactados = proyecto ? objetivosDeProyecto(proyecto.id, plan) : [];
  const accionesProyecto = acciones.filter((a) => a.proyectoId === proyectoId);

  if (loaded && !proyecto) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-slate-500">{t.noProyectoEncontrado}</p>
        <Link href={'/' + lang + '/babel/plan-accion/acciones'} className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
          {'← ' + t.verPorAcciones}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={'/' + lang + '/babel/plan-accion/acciones'} className="text-sm font-medium text-blue-600 hover:underline">
        {'← ' + t.verPorAcciones}
      </Link>

      <div className="mt-3 glass-panel p-4">
        <h3 className="text-xl font-bold text-slate-800">{t.fichaProyectoTitle}</h3>
        <p className="mt-1 text-lg font-semibold text-slate-700">{proyecto?.nombre || t.proyectoChip}</p>
        {proyecto?.responsableNombre ? (
          <p className="mt-1 text-sm text-slate-500">
            {t.responsableCol}: {proyecto.responsableNombre}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-semibold text-slate-800">{t.objetivosImpactadosLabel}</h4>
        {objetivosImpactados.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">{t.sinObjetivosVinculados}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {objetivosImpactados.map((o) => (
              <li key={o.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                {o.texto || '—'}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-slate-800">{t.fichaProyectoAccionesTitle}</h4>
        {accionesProyecto.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">{t.sinAccionesPlan}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {accionesProyecto.map((a) => {
              const rank = priorityRank(a.factibilidad, a.impacto);
              const tier = priorityTier(rank, lang);
              const dias = daysUntil(a.fecha);
              return (
                <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <p className="text-slate-800">{a.descripcion || '—'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className={'inline-block rounded-full px-2 py-0.5 font-medium ' + tier.classes}>{'#' + rank + ' - ' + tier.label}</span>
                    <span>{t.responsableCol}: {a.responsableNombre || '—'}</span>
                    <span>{t.fechaCol}: {a.fecha || '—'}</span>
                    {dias < 0 ? <span className="text-red-600">{t.overdue}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
