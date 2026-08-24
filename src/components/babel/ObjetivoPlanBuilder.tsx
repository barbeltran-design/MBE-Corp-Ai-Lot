'use client';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AgentAvatar from '@/components/agentes/AgentAvatar';
import { esMentorValido, MENTOR_IDS, mentorPorPerspectiva, type MentorId } from '@/lib/mentores';
import {
  type PlanLang,
  type Estatus,
  type Objetivo,
  type AmenazaOportunidad,
  type FortalezaDebilidad,
  type Proyecto,
  type Accion,
  type Contacto,
  type OrgData,
  ROLE_OPTIONS,
  FACTIBILIDAD_OPTIONS,
  IMPACTO_OPTIONS,
  ESTATUS_OPTIONS,
  priorityRank,
  priorityTier,
  suggestedDate,
  roleLabel,
  whatsappLink,
  daysUntil,
  reminderMessage,
  newProyecto,
  newAccion,
  PERSPECTIVAS,
  perspectivaLabel,
  perspectivaEstilo,
  loadPlanAccion,
  savePlanAccion,
  loadContactos,
  loadOrgData,
  resolvePersonForRole,
  resolveCelular,
  accionesDeObjetivo,
  entornosDeObjetivo,
  fdsDeEntorno,
  proyectoDeFd,
  proyectoDeAccion,
  resumenDeObjetivo,
  LABELS,
} from '@/lib/plan-accion';

type TabActiva = 'acciones' | 'diagnostico';

export default function ObjetivoPlanBuilder({ lang, objetivoId }: { lang: PlanLang; objetivoId: string }) {
  const router = useRouter();
  const t = LABELS[lang];
  const [translationCache, setTranslationCache] = React.useState<Record<string, string>>({});
  const tr = React.useCallback(function (text: string): string {
    if (lang === 'es' || !text) return text;
    return translationCache[text] ?? text;
  }, [lang, translationCache]);

  const [objetivos, setObjetivos] = React.useState<Objetivo[]>([]);
  const [entornos, setEntornos] = React.useState<AmenazaOportunidad[]>([]);
  const [fds, setFds] = React.useState<FortalezaDebilidad[]>([]);
  const [proyectos, setProyectos] = React.useState<Proyecto[]>([]);
  const [acciones, setAcciones] = React.useState<Accion[]>([]);
  const [contactos, setContactos] = React.useState<Contacto[]>([]);
  const [org, setOrg] = React.useState<OrgData>({ assignments: {}, presidente: '', secretario: '', consejeros: [] });
  const [loaded, setLoaded] = React.useState(false);
  const [tab, setTab] = React.useState<TabActiva>('acciones');
  const [filtroEstatus, setFiltroEstatus] = React.useState<Estatus | ''>('');
  const [filtroProximas, setFiltroProximas] = React.useState(false);
  const [filtroVencidas, setFiltroVencidas] = React.useState(false);
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [wizardEntornoId, setWizardEntornoId] = React.useState('');
  const [wizardFdId, setWizardFdId] = React.useState('');
  const [wizardProyectoNombre, setWizardProyectoNombre] = React.useState('');
  const [ayudaAccionId, setAyudaAccionId] = React.useState('');
  const [eleccionAccionId, setEleccionAccionId] = React.useState('');
  const [ayudaModo, setAyudaModo] = React.useState<'tip' | 'chat'>('tip');
  const [ayudaTip, setAyudaTip] = React.useState('');
  const [ayudaHistorial, setAyudaHistorial] = React.useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [ayudaInput, setAyudaInput] = React.useState('');
  const [ayudaCargando, setAyudaCargando] = React.useState(false);

  React.useEffect(() => {
    const plan = loadPlanAccion();
    if (plan) {
      setObjetivos(plan.objetivos);
      setEntornos(plan.entornos);
      setFds(plan.fds);
      setProyectos(plan.proyectos);
      setAcciones(plan.acciones);
    }
    setContactos(loadContactos());
    setOrg(loadOrgData());
    setLoaded(true);
  }, []);

  React.useEffect(() => {
    if (!loaded) return;
    savePlanAccion({ objetivos, entornos, fds, proyectos, acciones });
  }, [objetivos, entornos, fds, proyectos, acciones, loaded]);

  React.useEffect(() => {
    if (!loaded || lang === 'es') return;
    const texts = new Set<string>();
    objetivos.forEach(function (o) { if (o.texto) texts.add(o.texto); });
    acciones.forEach(function (a) {
      if (a.descripcion) texts.add(a.descripcion);
      if (a.entregable) texts.add(a.entregable);
    });
    texts.forEach(function (text) {
      if (translationCache[text] !== undefined) return;
      fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLang: 'en' }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          const translated = data && typeof data.translation === 'string' ? data.translation : text;
          setTranslationCache(function (prev) { return { ...prev, [text]: translated }; });
        })
        .catch(function () {
          setTranslationCache(function (prev) { return { ...prev, [text]: text }; });
        });
    });
  }, [loaded, lang, objetivos, entornos, fds, acciones]);

  const plan = { objetivos, entornos, fds, proyectos, acciones };
  const objetivo = objetivos.find((o) => o.id === objetivoId);

  const updateObjetivo = (id: string, patch: Partial<Objetivo>) =>
    setObjetivos((prev) => prev.map((o) => (o.id === id ? Object.assign({}, o, patch) : o)));

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
  const removeAccion = (id: string) => setAcciones((prev) => prev.filter((a) => a.id !== id));

  const mentorDe = (_a: Accion): MentorId => {
    if (esMentorValido(_a.mentor)) return _a.mentor;
    // Fuente unica de la asignacion perspectiva -> mentor: PERSPECTIVA_MENTOR
    // en lib/mentores.ts (derivada de PERSPECTIVAS en lib/plan-accion.ts).
    return mentorPorPerspectiva(objetivo?.perspectiva || '') || 'Babel';
  };

  const clasificarSiFalta = (a: Accion) => {
    if (a.mentor || a.descripcion.trim().length < 4) return;
    fetch('/api/babel/clasificar-mentor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion: a.descripcion, language: lang, perspectiva: objetivo?.perspectiva || '' }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.mentor === 'string' && d.mentor) updateAccion(a.id, { mentor: d.mentor });
      })
      .catch(() => {});
  };

  const cerrarAyuda = () => {
    setAyudaAccionId('');
    setAyudaTip('');
    setAyudaHistorial([]);
    setAyudaInput('');
  };

  const abrirTip = (a: Accion) => {
    setAyudaAccionId(a.id);
    setAyudaModo('chat');
    setAyudaHistorial([]);
    setAyudaTip('');
    setAyudaInput('');
    setAyudaCargando(true);
    fetch('/api/mentores/ayuda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mentor: mentorDe(a),
        modo: 'tip',
        language: lang,
        accion: { descripcion: a.descripcion, entregable: a.entregable },
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        const respuesta = typeof d?.reply === 'string' ? d.reply : (d?.error || (lang === 'en' ? 'No response.' : 'Sin respuesta.'));
        setAyudaHistorial([{ role: 'assistant', content: respuesta }]);
      })
      .catch(() =>
        setAyudaHistorial([
          { role: 'assistant', content: lang === 'en' ? 'Could not reach the mentor.' : 'No se pudo contactar al mentor.' },
        ])
      )
      .finally(() => setAyudaCargando(false));
  };

  React.useEffect(() => {
    if (!ayudaAccionId) return;
    const el = document.getElementById('ayuda-panel-' + ayudaAccionId);
    if (el) {
      const idTimeout = window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      return () => window.clearTimeout(idTimeout);
    }
  }, [ayudaAccionId]);

  React.useEffect(() => {
    if (!ayudaAccionId) return;
    const el = document.getElementById('ayuda-panel-' + ayudaAccionId);
    if (el) {
      const idTimeout = window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      return () => window.clearTimeout(idTimeout);
    }
  }, [ayudaAccionId]);

  const abrirChat = () => {
    setAyudaModo('chat');
    setAyudaHistorial([]);
    setAyudaInput('');
  };

  const enviarMensajeChat = (a: Accion) => {
    const texto = ayudaInput.trim();
    if (!texto || ayudaCargando) return;
    const historialNuevo = ayudaHistorial.concat([{ role: 'user' as const, content: texto }]);
    setAyudaHistorial(historialNuevo);
    setAyudaInput('');
    setAyudaCargando(true);
    fetch('/api/mentores/ayuda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mentor: mentorDe(a),
        modo: 'chat',
        language: lang,
        accion: { descripcion: a.descripcion, entregable: a.entregable },
        mensajes: historialNuevo,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        const respuesta = typeof d?.reply === 'string' ? d.reply : d?.error || (lang === 'en' ? 'No response.' : 'Sin respuesta.');
        setAyudaHistorial((prev) => prev.concat([{ role: 'assistant' as const, content: respuesta }]));
      })
      .catch(() => {
        setAyudaHistorial((prev) =>
          prev.concat([{ role: 'assistant' as const, content: lang === 'en' ? 'Could not reach the mentor.' : 'No se pudo contactar al mentor.' }])
        );
      })
      .finally(() => setAyudaCargando(false));
  };

  const crearAccionManual = () => {
    if (!wizardEntornoId) return;
    const fdId = wizardFdId;
    let proyecto = proyectoDeFd(fdId, plan);
    if (!proyecto) {
      proyecto = newProyecto(fdId);
      setProyectos((prev) => prev.concat([proyecto as Proyecto]));
    }
    const nombre = wizardProyectoNombre.trim();
    if (nombre) {
      setProyectos((prev) => prev.map((p) => (p.id === proyecto.id ? Object.assign({}, p, { nombre }) : p)));
    }
    const accion = newAccion(proyecto.id, priorityRank('media', 'medio'));
    setAcciones((prev) => prev.concat([accion]));
    setWizardOpen(false);
    setWizardEntornoId('');
    setWizardFdId('');
    setWizardProyectoNombre('');
  };

  if (!objetivo) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="glass-panel p-6 text-center">
          <p className="text-sm text-slate-600">{t.noEncontrado}</p>
          <Link href={'/' + lang + '/babel/plan-accion'} className="mt-3 inline-block text-sm font-medium text-teal-700 hover:underline">
            ← {t.volver}
          </Link>
        </div>
      </div>
    );
  }

  const estilo = perspectivaEstilo(objetivo.perspectiva || '');
  const accionesDeO = accionesDeObjetivo(objetivoId, plan);
  const resumen = resumenDeObjetivo(objetivoId, plan);

  const filtradas = accionesDeO
    .filter((a) => {
      if (filtroEstatus && a.estatus !== filtroEstatus) return false;
      if (a.estatus === 'terminado') return !filtroProximas && !filtroVencidas;
      const d = daysUntil(a.fecha);
      if (filtroProximas && !(d >= 0 && d <= 30)) return false;
      if (filtroVencidas && !(d < 0)) return false;
      return true;
    })
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

  const ValidateBadge = (props: { validado: boolean; onToggle: () => void }) => {
    return (
      <button
        type="button"
        onClick={props.onToggle}
        className={
          'rounded-full px-2.5 py-1 text-xs font-medium ' +
          (props.validado ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800')
        }
      >
        {props.validado ? t.validado : t.pendienteValidar}
      </button>
    );
  };

  const renderAccion = (a: Accion) => {
    const rank = priorityRank(a.factibilidad, a.impacto);
    const tier = priorityTier(rank, lang);
    const proyecto = proyectoDeAccion(a.id, plan);
    const proyectoNombre = proyecto && proyecto.nombre ? proyecto.nombre : t.proyectoChip;
    const celular = resolveCelular(a.responsableNombre, a.responsableRoleKey, contactos);
    const d = daysUntil(a.fecha);
    const showDue = a.estatus !== 'terminado' && d <= 7;
    return (
      <div key={a.id} className="mb-3 glass-panel p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-800">
            {proyectoNombre}
          </span>
          <button
            type="button"
            onClick={() => setEleccionAccionId(a.id)}
            title={lang === 'en' ? 'Ask ' + mentorDe(a) + ' for help with this action' : 'Pide ayuda a ' + mentorDe(a) + ' con esta accion'}
            className="group inline-flex items-center gap-1.5 rounded-full border-2 border-teal-300 bg-white py-1 pl-1 pr-3 shadow-sm ring-2 ring-teal-100 transition hover:border-teal-400 hover:shadow-md"
          >
            <AgentAvatar agente={mentorDe(a)} pose="reposando" size={40} />
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white animate-pulse group-hover:animate-none">
              ?
            </span>
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">{t.accionDesc}</label>
            <textarea
              value={tr(a.descripcion)}
              onChange={(ev) => updateAccion(a.id, { descripcion: ev.target.value })}
              onBlur={() => clasificarSiFalta(a)}
              placeholder={t.accionPlaceholder}
              rows={3}
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-1.5 text-sm leading-snug"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t.responsableLabel}</label>
            <select
              value={a.responsableRoleKey}
              onChange={(ev) => {
                const roleKey = ev.target.value;
                const person = resolvePersonForRole(roleKey, org);
                updateAccion(a.id, { responsableRoleKey: roleKey, responsableNombre: person ? person : a.responsableNombre });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">{t.responsableLabel}</option>
              {ROLE_OPTIONS.map((opt) => {
                const person = resolvePersonForRole(opt.key, org);
                const label = roleLabel(opt.key, lang) + (person ? ' - ' + person : '');
                return (
                  <option key={opt.key} value={opt.key}>
                    {label}
                  </option>
                );
              })}
            </select>
            <input
              type="text"
              value={a.responsableNombre}
              onChange={(ev) => updateAccion(a.id, { responsableNombre: ev.target.value })}
              placeholder={t.responsableNombreLabel}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t.entregableLabel}</label>
            <textarea
              value={tr(a.entregable)}
              onChange={(ev) => updateAccion(a.id, { entregable: ev.target.value })}
              placeholder={t.entregablePlaceholder}
              rows={3}
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-1.5 text-sm leading-snug"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t.inversionLabel}</label>
            <input
              type="text"
              value={a.inversion}
              onChange={(ev) => updateAccion(a.id, { inversion: ev.target.value })}
              placeholder={t.inversionPlaceholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t.factibilidadLabel}</label>
            <select
              value={a.factibilidad}
              onChange={(ev) => updateAccion(a.id, { factibilidad: ev.target.value as Accion['factibilidad'] })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              {FACTIBILIDAD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {lang === 'en' ? opt.labelEn : opt.labelEs}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t.impactoLabel}</label>
            <select
              value={a.impacto}
              onChange={(ev) => updateAccion(a.id, { impacto: ev.target.value as Accion['impacto'] })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              {IMPACTO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {lang === 'en' ? opt.labelEn : opt.labelEs}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Mentor</label>
            <select
              value={esMentorValido(a.mentor) ? a.mentor : ''}
              onChange={(ev) => updateAccion(a.id, { mentor: ev.target.value || undefined })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">{lang === 'en' ? 'Auto' : 'Automatico'}</option>
              {MENTOR_IDS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t.prioridadLabel}</label>
            <span className={'inline-block rounded-full px-2.5 py-1 text-xs font-medium ' + tier.classes}>
              {'#' + rank + ' - ' + tier.label}
            </span>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t.fechaLabel}</label>
            <input
              type="date"
              value={a.fecha}
              onChange={(ev) => updateAccion(a.id, { fecha: ev.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            {showDue ? (
              <span
                className={
                  'mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ' +
                  (d < 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800')
                }
              >
                {d < 0 ? t.overdue : t.dueSoon}
              </span>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t.estatusLabel}</label>
            <select
              value={a.estatus}
              onChange={(ev) => updateAccion(a.id, { estatus: ev.target.value as Estatus })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              {ESTATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {lang === 'en' ? opt.labelEn : opt.labelEs}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <ValidateBadge validado={a.validado} onToggle={() => updateAccion(a.id, { validado: !a.validado })} />
          <button type="button" onClick={() => removeAccion(a.id)} className="text-xs font-medium text-red-600 hover:underline">
            {t.eliminar}
          </button>
        </div>
        <div className="mt-2">
          {celular ? (
            <a
              href={whatsappLink(celular, reminderMessage(lang, a.responsableNombre, a.descripcion, proyectoNombre, a.fecha, a.entregable))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              {t.sendReminder}
            </a>
          ) : (
            <p className="text-xs text-slate-400">{t.noPhone}</p>
          )}
        </div>
        {ayudaAccionId === a.id ? (
          <div id={'ayuda-panel-' + a.id} className="mt-2 rounded-lg border border-teal-200 bg-teal-50 p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs font-semibold text-teal-800">
                <AgentAvatar agente={mentorDe(a)} pose="reposando" size={18} />
                {mentorDe(a)}
              </span>
              <div className="flex items-center gap-2 text-xs">
                {ayudaModo === 'tip' ? (
                  <button type="button" onClick={abrirChat} className="font-medium text-teal-700 hover:underline">
                    {lang === 'en' ? 'Open chat' : 'Abrir chat'}
                  </button>
                ) : null}
                <button type="button" onClick={cerrarAyuda} className="text-slate-500 hover:underline">
                  {lang === 'en' ? 'Close' : 'Cerrar'}
                </button>
              </div>
            </div>
            {ayudaModo === 'tip' ? (
              <p className="whitespace-pre-wrap text-xs text-slate-700">
                {ayudaCargando ? (lang === 'en' ? 'Thinking...' : 'Pensando...') : ayudaTip}
              </p>
            ) : (
              <div>
                {ayudaHistorial.map((m, i) => (
                  <p
                    key={i}
                    className={
                      'mt-1 whitespace-pre-wrap text-xs ' + (m.role === 'user' ? 'font-medium text-slate-800' : 'text-slate-700')
                    }
                  >
                    {m.content}
                  </p>
                ))}
                {ayudaCargando ? (
                  <p className="mt-1 text-xs text-slate-500">{lang === 'en' ? 'Thinking...' : 'Pensando...'}</p>
                ) : null}
                <div className="mt-2 flex gap-1">
                  <input
                    type="text"
                    value={ayudaInput}
                    onChange={(ev) => setAyudaInput(ev.target.value)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') enviarMensajeChat(a);
                    }}
                    placeholder={lang === 'en' ? 'Ask a question...' : 'Escribe tu pregunta...'}
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => enviarMensajeChat(a)}
                    disabled={ayudaCargando}
                    className="rounded bg-teal-600 px-2 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    {lang === 'en' ? 'Send' : 'Enviar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={'/' + lang + '/babel/plan-accion'} className="text-sm font-medium text-teal-700 hover:underline">
        ← {t.volver}
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <AgentAvatar agente="Babel" pose="reposando" size={56} className="shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-slate-500">
            {t.breadcrumbPlan} · {perspectivaLabel(objetivo.perspectiva || '', lang)}
          </p>
          <input
            type="text"
            value={tr(objetivo.texto)}
            onChange={(ev) => updateObjetivo(objetivo.id, { texto: ev.target.value })}
            placeholder={t.objetivoPlaceholder}
            className="mt-0.5 w-full bg-transparent text-xl font-bold text-slate-800 outline-none"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={'rounded-full px-2.5 py-1 text-xs font-medium ' + estilo.chip}>
          {perspectivaLabel(objetivo.perspectiva || '', lang)}
        </span>
        <select
          value={objetivo.perspectiva || ''}
          onChange={(ev) => updateObjetivo(objetivo.id, { perspectiva: ev.target.value || undefined })}
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
          aria-label={t.perspectivaLabel}
        >
          <option value="">{t.sinPerspectiva}</option>
          {PERSPECTIVAS.map((p) => (
            <option key={p.key} value={p.key}>
              {lang === 'en' ? p.en : p.es}
            </option>
          ))}
        </select>
        <ValidateBadge validado={objetivo.validado} onToggle={() => updateObjetivo(objetivo.id, { validado: !objetivo.validado })} />
        <span className="text-xs text-slate-500">
          {resumen.total} {t.accionesShort} · {resumen.pendientes} {t.pendientesShort} · {resumen.vencidas} {t.vencidasShort}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('acciones')}
          className={
            'rounded-lg px-4 py-2 text-sm font-medium ' +
            (tab === 'acciones' ? 'bg-teal-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-100')
          }
        >
          {t.tabAcciones} ({accionesDeO.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('diagnostico')}
          className={
            'rounded-lg px-4 py-2 text-sm font-medium ' +
            (tab === 'diagnostico' ? 'bg-teal-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-100')
          }
        >
          {t.tabDiagnostico}
        </button>
      </div>

      {tab === 'acciones' ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtroEstatus}
              onChange={(ev) => setFiltroEstatus(ev.target.value as Estatus | '')}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              aria-label={t.estatusLabel}
            >
              <option value="">{t.filtroTodas}</option>
              {ESTATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {lang === 'en' ? opt.labelEn : opt.labelEs}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setFiltroProximas((prev) => !prev)}
              className={
                'rounded-full px-3 py-1.5 text-xs font-medium ' +
                (filtroProximas ? 'bg-teal-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-100')
              }
            >
              {t.filtroProximas}
            </button>
            <button
              type="button"
              onClick={() => setFiltroVencidas((prev) => !prev)}
              className={
                'rounded-full px-3 py-1.5 text-xs font-medium ' +
                (filtroVencidas ? 'bg-red-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-100')
              }
            >
              {t.filtroVencidas}
            </button>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="ml-auto rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              + {t.addAccion}
            </button>
          </div>

          <div className="mt-4">
            {filtradas.length === 0 ? (
              <p className="text-sm text-slate-500">{t.sinAcciones}</p>
            ) : (
              filtradas.map((a) => renderAccion(a))
            )}
          </div>
        </div>
      ) : (
        <div id="objetivo-diagnostico" className="mt-4">
          <p className="text-sm text-slate-500">{t.diagnosticoNota}</p>
          <div className="mt-3">
            {entornosDeObjetivo(objetivoId, plan).length === 0 ? (
              <p className="text-sm text-slate-500">{t.wizardEntornoHint}</p>
            ) : (
              entornosDeObjetivo(objetivoId, plan).map((e) => (
                <div key={e.id} className="mb-3 glass-panel p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        'rounded-full px-2.5 py-1 text-xs font-medium ' +
                        (e.tipo === 'amenaza' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800')
                      }
                    >
                      {e.tipo === 'amenaza' ? t.amenaza : t.oportunidad}
                    </span>
                    <span
                      className={
                        'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                        (e.validado ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800')
                      }
                    >
                      {e.validado ? t.validado : t.pendienteValidar}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{tr(e.descripcion)}</p>
                  <div className="mt-3 space-y-2">
                    {fdsDeEntorno(e.id, plan).map((f) => (
                      <div key={f.id} className="rounded-lg border border-slate-200 bg-white/60 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              'rounded-full px-2.5 py-1 text-xs font-medium ' +
                              (f.tipo === 'fortaleza' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
                            }
                          >
                            {f.tipo === 'fortaleza' ? t.fortaleza : t.debilidad}
                          </span>
                          <span
                            className={
                              'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                              (f.validado ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800')
                            }
                          >
                            {f.validado ? t.validado : t.pendienteValidar}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-700">{tr(f.descripcion)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">{t.savedNote}</p>

      {eleccionAccionId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEleccionAccionId('')}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            {(() => {
              const accionEligiendo = acciones.find((x) => x.id === eleccionAccionId);
              if (!accionEligiendo) return null;
              return (
                <>
                  <AgentAvatar agente={mentorDe(accionEligiendo)} pose="reposando" size={56} className="mx-auto" />
                  <h4 className="mt-3 text-base font-bold text-slate-800">
                    {lang === 'en' ? 'How would you like help?' : 'Como quieres que te ayudemos?'}
                  </h4>
                  <p className="mt-1 text-sm text-slate-600">
                    {lang === 'en'
                      ? 'Chat now with the AI mentor, or book a FREE 30-minute session with a real mentor.'
                      : 'Quieres ayuda de la IA o prefieres una asesoria gratuita de 30 minutos con un mentor?'}
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEleccionAccionId('');
                        abrirTip(accionEligiendo);
                      }}
                      className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                    >
                      {lang === 'en' ? 'AI help (chat)' : 'Ayuda de la IA (chat)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEleccionAccionId('');
                        router.push('/' + lang + '/agendar');
                      }}
                      className="rounded-lg border border-teal-600 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"
                    >
                      {lang === 'en' ? 'Free 30-min mentor session' : 'Asesoria gratuita de 30 min con un mentor'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEleccionAccionId('')}
                      className="mt-1 text-xs font-medium text-slate-500 hover:underline"
                    >
                      {lang === 'en' ? 'Cancel' : 'Cancelar'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {wizardOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setWizardOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <h4 className="text-lg font-bold text-slate-800">{t.addAccion}</h4>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">{t.wizardObjetivo}</label>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{tr(objetivo.texto)}</p>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">{t.wizardEntorno}</label>
              <select
                value={wizardEntornoId}
                onChange={(ev) => {
                  setWizardEntornoId(ev.target.value);
                  setWizardFdId('');
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">--</option>
                {entornosDeObjetivo(objetivoId, plan).map((e) => (
                  <option key={e.id} value={e.id}>
                    {(e.tipo === 'amenaza' ? t.amenaza : t.oportunidad) + ': ' + e.descripcion}
                  </option>
                ))}
              </select>
              {entornosDeObjetivo(objetivoId, plan).length === 0 ? (
                <p className="mt-1.5 text-xs text-amber-700">{t.wizardEntornoHint}</p>
              ) : null}
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">{t.wizardFD}</label>
              <select
                value={wizardFdId}
                onChange={(ev) => setWizardFdId(ev.target.value)}
                disabled={!wizardEntornoId}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">{t.wizardSinFD}</option>
                {wizardEntornoId
                  ? fdsDeEntorno(wizardEntornoId, plan).map((f) => (
                      <option key={f.id} value={f.id}>
                        {(f.tipo === 'fortaleza' ? t.fortaleza : t.debilidad) + ': ' + f.descripcion}
                      </option>
                    ))
                  : null}
              </select>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-600">{t.wizardProyecto}</label>
              <input
                type="text"
                value={wizardProyectoNombre}
                onChange={(ev) => setWizardProyectoNombre(ev.target.value)}
                placeholder={t.wizardProyectoPlaceholder}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWizardOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                {t.wizardCancelar}
              </button>
              <button
                type="button"
                onClick={crearAccionManual}
                disabled={!wizardEntornoId}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {t.wizardCrear}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
