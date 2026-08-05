'use client';
import * as React from 'react';
import { ExternalLink, RefreshCw, Search } from 'lucide-react';
import BabelAvatar from '@/components/babel/BabelAvatar';
import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';
import {
  DATOS_CONVOCATORIAS,
  ESTADOS_MX,
  FUENTES,
  ODS_NAMES,
  calcularMontoAbiertas,
  diasRestantes,
  estatusReal,
  evaluarConvocatoria,
  ordenarPorVencimiento,
  type Convocatoria,
  type Evaluacion,
  type PerfilBusqueda,
} from '@/lib/convocatorias-data';

type ConvoLang = 'es' | 'en';
type Vista = 'perfil' | 'catalogo';

const LABELS = {
  es: {
    title: 'Convocatorias y fondos',
    subtitle:
      'Directorio de convocatorias, premios, becas y fondos alineados a los ODS para organizaciones, emprendimientos y proyectos socioambientales en México y el mundo. Captura el perfil de tu organizacion y te mostramos a cuales puedes aplicar y por que. Todo se calcula en tu navegador.',
    statsTotal: 'convocatorias en seguimiento',
    statsAbiertas: 'abiertas ahora',
    statsMonto: 'disponible en abiertas (estimado)',
    statsAct: 'ultima actualizacion',
    buscarTitle: 'Encuentra tus convocatorias',
    buscarSub:
      'Captura el perfil de tu organizacion y te mostramos a cuales puedes aplicar y por que. Todo se calcula en tu navegador; nada se envia a internet.',
    lblTipo: 'Tipo de organizacion',
    tipoPlaceholder: 'Selecciona...',
    tipoOsc: 'OSC / asociacion civil legalmente constituida',
    tipoEmpresa: 'Empresa / microempresa establecida',
    tipoEmprendimientoOperacion: 'Emprendimiento en operacion (etapa temprana)',
    tipoEmprendimientoIdea: 'Proyecto en etapa de idea',
    tipoPersonaFisica: 'Persona fisica / profesionista independiente',
    tipoAcademia: 'Equipo de investigacion / academia',
    tipoComunidadIndigena: 'Comunidad o grupo indigena',
    lblEstado: 'Ubicacion (estado)',
    lblAnios: 'Años de operacion',
    aniosPlaceholder: 'Ej. 3',
    lblEdad: 'Edad del responsable/lider',
    edadPlaceholder: 'Ej. 35',
    lblOds: 'Temas / ODS de tu proyecto (opcional, marca los que apliquen)',
    chkMujeres: 'Proyecto liderado por mujeres',
    chkIndigenas: 'Liderado por mujeres indigenas / comunidad indigena',
    btnBuscar: 'Buscar mis convocatorias',
    btnLimpiar: 'Limpiar',
    btnCatalogo: 'Ver todo el catalogo',
    alertaMinima: 'Indica al menos el tipo de organizacion y/o la ubicacion.',
    resumen: 'Tu organizacion es elegible para {n} convocatoria(s); {a} esta(n) abierta(s) ahora.',
    grupoElegibles: 'Convocatorias para las que eres elegible',
    grupoNoElegibles: 'No elegibles por ahora (con el motivo)',
    sinCoincidencias:
      'Sin coincidencias exactas',
    sinCoincidenciasDesc:
      'No encontramos convocatorias que cumplas al 100%. Revisa los requisitos abajo o ajusta el perfil.',
    porQueAplicas: 'Por que aplicas:',
    noCumples: 'No cumples:',
    buscaPlaceholder: 'Buscar por nombre, tema, ODS...',
    fTodos: 'Todos',
    fEstatus: 'Estatus',
    fTipo: 'Tipo',
    fAmbito: 'Ambito',
    vacio: 'No hay convocatorias que coincidan con tu busqueda.',
    requisitos: 'Requisitos:',
    monto: 'Monto:',
    fechaLimite: 'Fecha limite:',
    verConvocatoria: 'Ver convocatoria',
    diasCierra: 'Cierra en {d} dias',
    cierraHoy: 'Cierra hoy!',
    fechaPorConfirmar: 'Fecha por confirmar',
    fuentesTitle: 'Fuentes profesionales para encontrar mas fondos',
    fuentesSub:
      'Estas son las plataformas y agregadores donde viven cientos de convocatorias. La busqueda automatica semanal ya las revisa; aqui las tienes a la mano para explorar por tu cuenta.',
    abrir: 'Abrir',
    guardado: 'Directorio de convocatorias con datos de 2025-2026. Verifica siempre los requisitos completos en la liga oficial de cada convocatoria.',
    hoyLabel: '{dia}/{mes}/{anio}',
  },
  en: {
    title: 'Calls & Grants',
    subtitle:
      'Directory of calls for proposals, awards, fellowships and grants aligned with the SDGs for organizations, ventures and socio-environmental projects in Mexico and worldwide. Fill in your organization profile and we will show you which ones you can apply to and why. Everything is computed in your browser.',
    statsTotal: 'calls being tracked',
    statsAbiertas: 'open right now',
    statsMonto: 'available in open calls (estimated)',
    statsAct: 'last update',
    buscarTitle: 'Find your calls',
    buscarSub:
      'Enter your organization profile and we will show you which calls you can apply to and why. Everything is computed in your browser; nothing is sent to the internet.',
    lblTipo: 'Organization type',
    tipoPlaceholder: 'Select...',
    tipoOsc: 'NGO / legally established civil association',
    tipoEmpresa: 'Established company / micro-business',
    tipoEmprendimientoOperacion: 'Venture in operation (early stage)',
    tipoEmprendimientoIdea: 'Project at idea stage',
    tipoPersonaFisica: 'Individual / independent professional',
    tipoAcademia: 'Research team / academia',
    tipoComunidadIndigena: 'Indigenous community or group',
    lblEstado: 'Location (state)',
    lblAnios: 'Years in operation',
    aniosPlaceholder: 'E.g. 3',
    lblEdad: 'Age of the person in charge/leader',
    edadPlaceholder: 'E.g. 35',
    lblOds: 'Topics / SDGs of your project (optional, check the ones that apply)',
    chkMujeres: 'Women-led project',
    chkIndigenas: 'Led by indigenous women / indigenous community',
    btnBuscar: 'Find my calls',
    btnLimpiar: 'Clear',
    btnCatalogo: 'Back to full catalog',
    alertaMinima: 'Select at least the organization type and/or the location.',
    resumen: 'Your organization is eligible for {n} call(s); {a} are open right now.',
    grupoElegibles: 'Calls you are eligible for',
    grupoNoElegibles: 'Not eligible yet (with the reason)',
    sinCoincidencias: 'No exact matches',
    sinCoincidenciasDesc:
      'We could not find calls you fully meet. Review the requirements below or adjust your profile.',
    porQueAplicas: 'Why you apply:',
    noCumples: 'You do not meet:',
    buscaPlaceholder: 'Search by name, topic, SDG...',
    fTodos: 'All',
    fEstatus: 'Status',
    fTipo: 'Type',
    fAmbito: 'Scope',
    vacio: 'No calls match your search.',
    requisitos: 'Requirements:',
    monto: 'Amount:',
    fechaLimite: 'Deadline:',
    verConvocatoria: 'View call',
    diasCierra: 'Closes in {d} days',
    cierraHoy: 'Closes today!',
    fechaPorConfirmar: 'Date TBD',
    fuentesTitle: 'Professional sources to find more funding',
    fuentesSub:
      'These are the platforms and aggregators where hundreds of calls live. The automatic weekly search already checks them; here they are at hand for you to explore on your own.',
    abrir: 'Open',
    guardado:
      'Calls directory with 2025-2026 data. Always verify the full requirements on the official link of each call.',
    hoyLabel: '{dia}/{mes}/{anio}',
  },
};

const PASOS_TOUR: Record<ConvoLang, TourStep[]> = {
  es: [
    {
      selector: '#convocatorias-title',
      title: 'Convocatorias y fondos',
      description:
        'Directorio de convocatorias, premios, becas y fondos alineados a los ODS para tu organización. Céntrate en los que están abiertos.',
    },
    {
      selector: '#convocatorias-buscar',
      title: 'Encuentra tus convocatorias',
      description:
        'Captura el perfil de tu organización (tipo, ubicación, años de operación, edad, ODS y liderazgo) y pulsa "Buscar mis convocatorias" para ver a cuáles puedes aplicar y por qué.',
    },
    {
      selector: '#convocatorias-catalogo',
      title: 'Catálogo completo',
      description:
        'Explora las 35 convocatorias con buscador por nombre, tema u ODS, y filtros por estatus, tipo y ámbito. Cada tarjeta incluye requisitos, monto, fecha límite y la liga oficial.',
    },
    {
      selector: '#convocatorias-fuentes',
      title: 'Fuentes profesionales',
      description:
        'Plataformas y agregadores donde se publican cientos de convocatorias y fondos para que amplíes tu búsqueda.',
    },
  ],
  en: [
    {
      selector: '#convocatorias-title',
      title: 'Calls & Grants',
      description:
        'Directory of calls for proposals, awards, fellowships and grants aligned with the SDGs for your organization. Focus on the ones that are open.',
    },
    {
      selector: '#convocatorias-buscar',
      title: 'Find your calls',
      description:
        'Enter your organization profile (type, location, years in operation, age, SDGs and leadership) and press "Find my calls" to see which ones you can apply to and why.',
    },
    {
      selector: '#convocatorias-catalogo',
      title: 'Full catalog',
      description:
        'Browse the 35 calls with a search box by name, topic or SDG, and filters by status, type and scope. Each card includes requirements, amount, deadline and the official link.',
    },
    {
      selector: '#convocatorias-fuentes',
      title: 'Professional sources',
      description:
        'Platforms and aggregators where hundreds of calls and funds are published, so you can expand your search.',
    },
  ],
};

function fechaHoy(hoy: Date): string {
  const d = String(hoy.getDate()).padStart(2, '0');
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  return d + '/' + m + '/' + hoy.getFullYear();
}

function claseEstatus(estatus: string): string {
  if (estatus === 'Abierta') return 'bg-green-100 text-green-800';
  if (estatus === 'Cerrada') return 'bg-red-100 text-red-800';
  return 'bg-slate-100 text-slate-600';
}

function diasTxt(dias: number | null, t: typeof LABELS.es): { txt: string; color: string } {
  if (dias === null) return { txt: t.fechaPorConfirmar, color: 'text-slate-400' };
  if (dias < 0) return { txt: 'Cerrada', color: 'text-red-600' };
  if (dias === 0) return { txt: t.cierraHoy, color: 'text-red-600' };
  return { txt: t.diasCierra.replace('{d}', String(dias)), color: dias <= 14 ? 'text-red-600' : 'text-green-600' };
}

export default function ConvocatoriasBuilder({ lang }: { lang: ConvoLang }) {
  const t = LABELS[lang];
  const [hoy, setHoy] = React.useState<Date | null>(null);

  const [tipo, setTipo] = React.useState('');
  const [estado, setEstado] = React.useState('');
  const [anios, setAnios] = React.useState('');
  const [edad, setEdad] = React.useState('');
  const [odsSel, setOdsSel] = React.useState<number[]>([]);
  const [mujeres, setMujeres] = React.useState(false);
  const [indigenas, setIndigenas] = React.useState(false);

  const [vista, setVista] = React.useState<Vista>('catalogo');
  const [resumen, setResumen] = React.useState('');
  const [elegibles, setElegibles] = React.useState<{ c: Convocatoria; r: Evaluacion }[]>([]);
  const [noElegibles, setNoElegibles] = React.useState<{ c: Convocatoria; r: Evaluacion }[]>([]);
  const [evaluado, setEvaluado] = React.useState(false);

  const [busca, setBusca] = React.useState('');
  const [fEstatus, setFEstatus] = React.useState('');
  const [fTipo, setFTipo] = React.useState('');
  const [fAmbito, setFAmbito] = React.useState('');

  React.useEffect(() => {
    setHoy(new Date());
  }, []);

  const hoyD = hoy ?? new Date();

  const datos = React.useMemo(() => ordenarPorVencimiento(DATOS_CONVOCATORIAS, hoyD), [hoyD]);
  const abiertas = React.useMemo(() => datos.filter((c) => estatusReal(c, hoyD) === 'Abierta').length, [datos, hoyD]);
  const monto = React.useMemo(() => calcularMontoAbiertas(DATOS_CONVOCATORIAS, hoyD), [hoyD]);
  const tiposUnicos = React.useMemo(() => Array.from(new Set(DATOS_CONVOCATORIAS.map((c) => c.tipo))).sort(), []);
  const ambitosUnicos = React.useMemo(() => Array.from(new Set(DATOS_CONVOCATORIAS.map((c) => c.ambito))).sort(), []);

  const toggleOds = (n: number) =>
    setOdsSel((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  const limpiar = () => {
    setTipo('');
    setEstado('');
    setAnios('');
    setEdad('');
    setOdsSel([]);
    setMujeres(false);
    setIndigenas(false);
    setEvaluado(false);
    setResumen('');
  };

  const buscar = () => {
    if (!tipo && !estado) {
      alert(t.alertaMinima);
      return;
    }
    const perfil: PerfilBusqueda = {
      tipo,
      estado,
      anios: anios === '' ? null : Number(anios),
      edad: edad === '' ? null : Number(edad),
      ods: odsSel,
      mujeres,
      indigenas,
    };
    const evaluadas = DATOS_CONVOCATORIAS.map((c) => ({ c, r: evaluarConvocatoria(c, perfil) }));
    const eleg = evaluadas
      .filter((x) => x.r.elegible)
      .sort(
        (a, b) =>
          (estatusReal(a.c, hoyD) === 'Abierta' ? 0 : 1) - (estatusReal(b.c, hoyD) === 'Abierta' ? 0 : 1) ||
          b.r.odsMatch - a.r.odsMatch ||
          (diasRestantes(a.c, hoyD) ?? 999) - (diasRestantes(b.c, hoyD) ?? 999)
      );
    const noEleg = evaluadas.filter((x) => !x.r.elegible);
    const abiertasEleg = eleg.filter((x) => estatusReal(x.c, hoyD) === 'Abierta').length;
    setElegibles(eleg);
    setNoElegibles(noEleg);
    setResumen(t.resumen.replace('{n}', String(eleg.length)).replace('{a}', String(abiertasEleg)));
    setEvaluado(true);
    setVista('perfil');
    window.setTimeout(() => {
      document.getElementById('convocatorias-resultados')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const verCatalogo = () => {
    setVista('catalogo');
    setEvaluado(false);
  };

  const filtradas = React.useMemo(() => {
    const q = busca.toLowerCase();
    return datos.filter((c) => {
      const txt = (c.convocatoria + ' ' + c.descripcion + ' ' + c.ods + ' ' + c.requisitos + ' ' + c.tipo + ' ' + c.ambito).toLowerCase();
      return (
        (!q || txt.includes(q)) &&
        (!fEstatus || estatusReal(c, hoyD) === fEstatus) &&
        (!fTipo || c.tipo === fTipo) &&
        (!fAmbito || c.ambito === fAmbito)
      );
    });
  }, [busca, fEstatus, fTipo, fAmbito, datos, hoyD]);

  const tarjeta = (c: Convocatoria, extraClase?: string, razones?: { si: string[]; no: string[] }) => {
    const est = estatusReal(c, hoyD);    const d = diasTxt(diasRestantes(c, hoyD), t);
    return (
      <div
        className={
          'flex flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm ' +
          (extraClase === 'ok'
            ? 'border-l-4 border-l-green-500'
            : extraClase === 'no'
              ? 'border-l-4 border-l-red-500 opacity-85'
              : '')
        }
      >
        <div className="mb-2 flex flex-wrap gap-1.5">
          <span className={'rounded-full px-2.5 py-0.5 text-[11px] font-semibold ' + claseEstatus(est)}>{est || '—'}</span>
          <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">{c.tipo}</span>
        </div>
        <h4 className="text-sm font-bold leading-snug text-slate-800">{c.convocatoria}</h4>
        {c.ods ? <p className="mt-0.5 text-[11px] italic text-slate-500">{c.ods}</p> : null}
        {razones ? (
          <div
            className={
              'mt-2 rounded-md px-2.5 py-1.5 text-xs leading-relaxed ' +
              (razones.si.length ? 'bg-green-50 text-green-800' : razones.no.length ? 'bg-red-50 text-red-800' : '')
            }
          >
            {razones.si.length ? (
              <>
                <span className="font-bold">{t.porQueAplicas}</span> {razones.si.join(' · ')}
              </>
            ) : null}
            {razones.no.length ? (
              <>
                <span className="font-bold">{t.noCumples}</span> {razones.no.join(' · ')}
              </>
            ) : null}
          </div>
        ) : null}
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{c.descripcion}</p>
        <p className="mt-2 text-xs text-slate-700">
          <b>{t.requisitos}</b> {c.requisitos}
        </p>
        <p className="mt-1 text-xs text-slate-700">
          <b>{t.monto}</b> {c.monto}
        </p>
        <p className="mt-1 text-xs text-slate-700">
          <b>{t.fechaLimite}</b> {c.fecha_limite} · {c.ambito}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
          <span className={'text-xs font-bold ' + d.color}>{d.txt}</span>
          <a
            href={c.liga}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            {t.verConvocatoria} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <BabelAvatar size={56} className="shrink-0" />
        <div>
          <h3 id="convocatorias-title" className="text-xl font-bold text-slate-800">
            {t.title}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xl font-bold text-slate-800">{datos.length}</p>
          <p className="text-xs text-slate-500">{t.statsTotal}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 shadow-sm">
          <p className="text-xl font-bold text-green-800">{abiertas}</p>
          <p className="text-xs text-green-700">{t.statsAbiertas}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xl font-bold text-slate-800">{monto.parts}</p>
          <p className="text-xs text-slate-500">{t.statsMonto}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xl font-bold text-slate-800">{fechaHoy(hoyD)}</p>
          <p className="text-xs text-slate-500">{t.statsAct}</p>
        </div>
      </div>

      {/* Buscar por perfil */}
      <div id="convocatorias-buscar" className="mt-5 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-700">{t.buscarTitle}</h4>
        <p className="mt-1 text-xs text-slate-500">{t.buscarSub}</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.lblTipo}</label>
            <select
              value={tipo}
              onChange={(ev) => setTipo(ev.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700"
            >
              <option value="">{t.tipoPlaceholder}</option>
              <option value="osc">{t.tipoOsc}</option>
              <option value="empresa">{t.tipoEmpresa}</option>
              <option value="emprendimiento_operacion">{t.tipoEmprendimientoOperacion}</option>
              <option value="emprendimiento_idea">{t.tipoEmprendimientoIdea}</option>
              <option value="persona_fisica">{t.tipoPersonaFisica}</option>
              <option value="academia">{t.tipoAcademia}</option>
              <option value="comunidad_indigena">{t.tipoComunidadIndigena}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.lblEstado}</label>
            <select
              value={estado}
              onChange={(ev) => setEstado(ev.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700"
            >
              <option value="">{t.tipoPlaceholder}</option>
              {ESTADOS_MX.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.lblAnios}</label>
            <input
              type="number"
              min={0}
              value={anios}
              onChange={(ev) => setAnios(ev.target.value)}
              placeholder={t.aniosPlaceholder}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.lblEdad}</label>
            <input
              type="number"
              min={0}
              value={edad}
              onChange={(ev) => setEdad(ev.target.value)}
              placeholder={t.edadPlaceholder}
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-500">{t.lblOds}</label>
          <div className="grid max-h-40 grid-cols-1 gap-1 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.keys(ODS_NAMES).map((k) => {
              const n = Number(k);
              const on = odsSel.includes(n);
if (!hoy) {
    return (
      <div className="flex items-center gap-3">
        <BabelAvatar size={56} className="shrink-0" />
        <div>
          <h3 id="convocatorias-title" className="text-xl font-bold text-slate-800">
            {t.title}
          </h3>
        </div>
      </div>
    );
  }

  return (
                <label key={n} className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={on} onChange={() => toggleOds(n)} className="h-3.5 w-3.5" />
                  {n}. {ODS_NAMES[n]}
                </label>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={mujeres} onChange={(ev) => setMujeres(ev.target.checked)} className="h-3.5 w-3.5" />
            {t.chkMujeres}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={indigenas} onChange={(ev) => setIndigenas(ev.target.checked)} className="h-3.5 w-3.5" />
            {t.chkIndigenas}
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={buscar}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Search className="h-4 w-4" /> {t.btnBuscar}
          </button>
          <button
            type="button"
            onClick={limpiar}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> {t.btnLimpiar}
          </button>
        </div>
        {resumen ? <p className="mt-3 text-sm font-semibold text-slate-700">{resumen}</p> : null}
      </div>

      {/* Resultados del perfil */}
      {vista === 'perfil' && evaluado ? (
        <div id="convocatorias-resultados" className="mt-5">
          {elegibles.length ? (
            <div>
              <h4 className="text-sm font-semibold text-green-700">✅ {t.grupoElegibles}</h4>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {elegibles.map((x) => tarjeta(x.c, 'ok', x.r))}
              </div>
            </div>
          ) : (
            <div>
              <h4 className="text-sm font-semibold text-slate-700">{t.sinCoincidencias}</h4>
              <p className="mt-1 text-sm text-slate-500">{t.sinCoincidenciasDesc}</p>
            </div>
          )}
          {noElegibles.length ? (
            <div className="mt-5">
              <h4 className="text-sm font-semibold text-slate-700">⚠️ {t.grupoNoElegibles}</h4>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {noElegibles.map((x) => tarjeta(x.c, 'no', x.r))}
              </div>
            </div>
          ) : null}
          <div className="mt-4">
            <button
              type="button"
              onClick={verCatalogo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {t.btnCatalogo}
            </button>
          </div>
        </div>
      ) : null}

      {/* Catalogo completo */}
      <div id="convocatorias-catalogo" className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={busca}
            onChange={(ev) => setBusca(ev.target.value)}
            placeholder={t.buscaPlaceholder}
            className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700"
          />
          <select
            value={fEstatus}
            onChange={(ev) => setFEstatus(ev.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
          >
            <option value="">{t.fTodos} {t.fEstatus.toLowerCase()}</option>
            <option value="Abierta">Abierta</option>
            <option value="Cerrada">Cerrada</option>
          </select>
          <select
            value={fTipo}
            onChange={(ev) => setFTipo(ev.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
          >
            <option value="">{t.fTodos} {t.fTipo.toLowerCase()}</option>
            {tiposUnicos.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <select
            value={fAmbito}
            onChange={(ev) => setFAmbito(ev.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
          >
            <option value="">{t.fTodos} {t.fAmbito.toLowerCase()}</option>
            {ambitosUnicos.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
        {filtradas.length ? (
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {filtradas.map((c) => tarjeta(c))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            {t.vacio}
          </div>
        )}
      </div>

      {/* Fuentes */}
      <div id="convocatorias-fuentes" className="mt-6 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-700">🔎 {t.fuentesTitle}</h4>
        <p className="mt-1 text-xs text-slate-500">{t.fuentesSub}</p>
        {FUENTES.map((sec) => (
          <div key={sec.titulo} className="mt-4">
            <h5 className="text-xs font-bold text-slate-700">{sec.titulo}</h5>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sec.items.map((f) => (
                <div key={f.nombre} className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-xs font-semibold text-slate-800">{f.nombre}</p>
                  <p className="mt-1 flex-1 text-xs text-slate-600">{f.descripcion}</p>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    {t.abrir} → <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-400">{t.guardado}</p>
      <PageTour pageId="convocatorias" steps={lang === 'en' ? PASOS_TOUR.en : PASOS_TOUR.es} lang={lang} />
    </div>
  );
}
