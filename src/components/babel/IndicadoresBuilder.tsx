'use client';
import React from 'react';
import FinancialGoalsBuilder from '@/components/babel/FinancialGoalsBuilder';

type PlanLang = 'es' | 'en';
type BSCPerspectiva = 'financiera' | 'clientes' | 'procesos_internos' | 'aprendizaje_crecimiento';
type Frecuencia = 'semanal' | 'mensual' | 'trimestral' | 'semestral' | 'anual';

type RoleOption = { key: string; nameEs: string; nameEn: string };

// ---------------------------------------------------------------------------
// Estos tipos son un espejo de solo lectura de los datos que guarda
// PlanAccionBuilder.tsx en localStorage (clave babel_plan_accion_v2). Este
// componente NUNCA escribe de vuelta en esa clave — solo la lee para poder
// alinear los indicadores con los objetivos, amenazas/oportunidades y
// acciones que el usuario ya definio ahi.
// ---------------------------------------------------------------------------
type PlanObjetivo = { id: string; perspectiva: BSCPerspectiva; texto: string };
type PlanEntorno = { id: string; objetivoId: string; tipo: 'amenaza' | 'oportunidad'; descripcion: string };
type PlanFD = { id: string; entornoId: string; tipo: 'fortaleza' | 'debilidad'; descripcion: string };
type PlanProyecto = { id: string; fdId: string; nombre: string };
type PlanAccion = {
  id: string;
  proyectoId: string;
  descripcion: string;
  responsableRoleKey: string;
  responsableNombre: string;
};

type Indicador = {
  id: string;
  objetivoId: string;
  entornoId: string;
  accionesIds: string[];
  nombre: string;
  formula: string;
  especifico: string;
  medible: string;
  alcanzable: string;
  relevante: string;
  temporal: string;
  lineaBase: string;
  meta: string;
  fechaLimite: string;
  frecuencia: Frecuencia;
  responsableRoleKey: string;
  responsableNombre: string;
  origen: 'ia' | 'manual';
  validado: boolean;
  notaIA: string;
};

type OrgAssignments = Record<string, { person: string }>;

const PLAN_STORAGE_KEY = 'babel_plan_accion_v2';
const ORG_KEY = 'babel_orgchart_v1';
const BOARD_KEY = 'babel_orgchart_board_v1';
const INDICADORES_KEY = 'babel_indicadores_v1';

const ROLE_OPTIONS: RoleOption[] = [
  { key: 'consejo_administrativo', nameEs: 'Consejo Administrativo', nameEn: 'Board of Directors' },
  { key: 'planeacion_estrategica', nameEs: 'Planeacion Estrategica', nameEn: 'Strategic Planning' },
  { key: 'finanzas', nameEs: 'Finanzas', nameEn: 'Finance' },
  { key: 'cobranza', nameEs: 'Cobranza', nameEn: 'Collections' },
  { key: 'facturacion', nameEs: 'Facturacion', nameEn: 'Invoicing' },
  { key: 'contabilidad', nameEs: 'Contabilidad', nameEn: 'Accounting' },
  { key: 'pago_proveedores', nameEs: 'Pago a Proveedores', nameEn: 'Vendor Payments' },
  { key: 'administracion', nameEs: 'Administracion', nameEn: 'Administration' },
  { key: 'recursos_humanos', nameEs: 'Recursos Humanos', nameEn: 'Human Resources' },
  { key: 'legal', nameEs: 'Legal', nameEn: 'Legal' },
  { key: 'comercial', nameEs: 'Comercial', nameEn: 'Commercial' },
  { key: 'mercadotecnia', nameEs: 'Mercadotecnia', nameEn: 'Marketing' },
  { key: 'relaciones_publicas', nameEs: 'Relaciones Publicas', nameEn: 'Public Relations' },
  { key: 'servicio_clientes', nameEs: 'Servicio a Clientes', nameEn: 'Customer Service' },
  { key: 'ventas', nameEs: 'Ventas', nameEn: 'Sales' },
  { key: 'operacion', nameEs: 'Operacion', nameEn: 'Operations' },
  { key: 'procesos', nameEs: 'Procesos', nameEn: 'Processes' },
  { key: 'sistemas', nameEs: 'Sistemas', nameEn: 'Systems' },
  { key: 'desarrollo_proveedores', nameEs: 'Desarrollo de Proveedores', nameEn: 'Vendor Development' },
];

const PERSPECTIVA_OPTIONS: { value: BSCPerspectiva; labelEs: string; labelEn: string }[] = [
  { value: 'financiera', labelEs: 'Financiera', labelEn: 'Financial' },
  { value: 'clientes', labelEs: 'Clientes', labelEn: 'Customer' },
  { value: 'procesos_internos', labelEs: 'Procesos Internos', labelEn: 'Internal Processes' },
  { value: 'aprendizaje_crecimiento', labelEs: 'Aprendizaje y Crecimiento', labelEn: 'Learning and Growth' },
];

const FRECUENCIA_OPTIONS: { value: Frecuencia; labelEs: string; labelEn: string }[] = [
  { value: 'semanal', labelEs: 'Semanal', labelEn: 'Weekly' },
  { value: 'mensual', labelEs: 'Mensual', labelEn: 'Monthly' },
  { value: 'trimestral', labelEs: 'Trimestral', labelEn: 'Quarterly' },
  { value: 'semestral', labelEs: 'Semestral', labelEn: 'Semiannual' },
  { value: 'anual', labelEs: 'Anual', labelEn: 'Annual' },
];

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function roleLabel(roleKey: string, lang: PlanLang): string {
  let found: RoleOption | null = null;
  for (let i = 0; i < ROLE_OPTIONS.length; i++) {
    if (ROLE_OPTIONS[i].key === roleKey) {
      found = ROLE_OPTIONS[i];
      break;
    }
  }
  if (!found) return '';
  return lang === 'en' ? found.nameEn : found.nameEs;
}

function perspectivaLabel(value: BSCPerspectiva | '', lang: PlanLang): string {
  for (let i = 0; i < PERSPECTIVA_OPTIONS.length; i++) {
    if (PERSPECTIVA_OPTIONS[i].value === value) {
      return lang === 'en' ? PERSPECTIVA_OPTIONS[i].labelEn : PERSPECTIVA_OPTIONS[i].labelEs;
    }
  }
  return '';
}

// Empareja un texto que devolvio la IA contra una lista de objetos con
// descripcion, por igualdad exacta primero y si no por coincidencia parcial.
// Devuelve el id encontrado o '' si no hubo match razonable.
function matchTextToId<T extends { id: string }>(text: string, list: T[], getText: (item: T) => string): string {
  const clean = (text || '').trim().toLowerCase();
  if (!clean) return '';
  for (let i = 0; i < list.length; i++) {
    if (getText(list[i]).trim().toLowerCase() === clean) return list[i].id;
  }
  for (let i = 0; i < list.length; i++) {
    const itemText = getText(list[i]).trim().toLowerCase();
    if (itemText.length > 0 && (itemText.indexOf(clean) !== -1 || clean.indexOf(itemText) !== -1)) {
      return list[i].id;
    }
  }
  return '';
}

const LABELS = {
  es: {
    title: 'Objetivos Estratégicos (SMART + Balanced Scorecard)',
    subtitle:
      'Babel propone indicadores con metodologia SMART, alineados a las 4 perspectivas del Balanced Scorecard, vinculados a tus amenazas/oportunidades y a las acciones ya asignadas en tu Plan de Accion. Puedes modificar cualquier campo y validar cada indicador.',
    noObjetivos:
      'Todavia no hay objetivos de negocio registrados en tu Plan de Accion. Ve primero a "Plan de Accion Estrategico" y captura al menos un objetivo, sus amenazas u oportunidades y algunas acciones — despues regresa aqui para generar la propuesta de indicadores.',
    generar: 'Generar propuesta con Babel',
    generando: 'Generando propuesta...',
    agregarManual: 'Agregar indicador manualmente',
    errorTitle: 'No se pudo generar la propuesta automatica',
    errorHint: 'Puedes seguir agregando indicadores de forma manual mientras tanto.',
    summaryTotal: 'Indicadores totales',
    summaryValidados: 'Validados',
    summaryPendientes: 'Pendientes de validar',
    summaryFinanciera: 'Perspectiva financiera',
    summaryClientes: 'Perspectiva clientes',
    summaryProcesos: 'Perspectiva procesos internos',
    summaryAprendizaje: 'Perspectiva aprendizaje y crecimiento',
    objetivoLabel: 'Objetivo de negocio vinculado',
    objetivoPlaceholder: 'Selecciona un objetivo',
    perspectivaLabel: 'Perspectiva (Balanced Scorecard)',
    sinVincular: 'Sin vincular',
    entornoLabel: 'Amenaza u oportunidad relacionada',
    entornoPlaceholder: 'Ninguna en particular',
    accionesLabel: 'Acciones del Plan Estratégico relacionadas',
    nombreLabel: 'Nombre del indicador',
    nombrePlaceholder: 'Ej. Tasa de conversion de cotizacion a venta',
    formulaLabel: 'Formula de calculo',
    formulaPlaceholder: 'Ej. (Ventas cerradas / Cotizaciones enviadas) x 100',
    especificoLabel: 'S - Especifico: que se mide exactamente y por que',
    medibleLabel: 'M - Medible: unidad de medida',
    alcanzableLabel: 'A - Alcanzable: por que la meta es realista',
    relevanteLabel: 'R - Relevante: por que importa para este objetivo',
    temporalLabel: 'T - Temporal: en que plazo se evalua',
    lineaBaseLabel: 'Linea base (valor actual)',
    metaLabel: 'Meta (valor objetivo)',
    fechaLimiteLabel: 'Fecha limite para alcanzar la meta',
    frecuenciaLabel: 'Frecuencia de medicion',
    responsableLabel: 'Responsable (rol del organigrama)',
    responsableNombreLabel: 'Nombre del responsable',
    validado: 'Validado',
    pendienteValidar: 'Pendiente de validar',
    eliminar: 'Eliminar',
    origenIA: 'Propuesto por Babel',
    origenManual: 'Agregado manualmente',
    notaIALabel: 'Nota de Babel (texto original no vinculado automaticamente)',
    savedNote: 'Los cambios se guardan automaticamente en este navegador.',
  },
  en: {
    title: 'Strategic Objectives (SMART + Balanced Scorecard)',
    subtitle:
      'Babel proposes indicators using the SMART methodology, aligned to the 4 Balanced Scorecard perspectives, linked to your threats/opportunities and to the actions already assigned in your Action Plan. You can edit any field and validate each indicator.',
    noObjetivos:
      'There are no business objectives registered in your Action Plan yet. Go to "Strategic Action Plan" first and capture at least one objective, its threats or opportunities, and some actions — then come back here to generate the indicator proposal.',
    generar: 'Generate proposal with Babel',
    generando: 'Generating proposal...',
    agregarManual: 'Add indicator manually',
    errorTitle: 'The automatic proposal could not be generated',
    errorHint: 'You can keep adding indicators manually in the meantime.',
    summaryTotal: 'Total indicators',
    summaryValidados: 'Validated',
    summaryPendientes: 'Pending validation',
    summaryFinanciera: 'Financial perspective',
    summaryClientes: 'Customer perspective',
    summaryProcesos: 'Internal processes perspective',
    summaryAprendizaje: 'Learning and growth perspective',
    objetivoLabel: 'Linked business objective',
    objetivoPlaceholder: 'Select an objective',
    perspectivaLabel: 'Perspective (Balanced Scorecard)',
    sinVincular: 'Not linked',
    entornoLabel: 'Related threat or opportunity',
    entornoPlaceholder: 'None in particular',
    accionesLabel: 'Related Strategic Plan actions',
    nombreLabel: 'Indicator name',
    nombrePlaceholder: 'E.g. Quote-to-sale conversion rate',
    formulaLabel: 'Calculation formula',
    formulaPlaceholder: 'E.g. (Closed sales / Quotes sent) x 100',
    especificoLabel: 'S - Specific: what exactly is measured and why',
    medibleLabel: 'M - Measurable: unit of measure',
    alcanzableLabel: 'A - Achievable: why the target is realistic',
    relevanteLabel: 'R - Relevant: why it matters for this objective',
    temporalLabel: 'T - Time-bound: over what period it is evaluated',
    lineaBaseLabel: 'Baseline (current value)',
    metaLabel: 'Target value',
    fechaLimiteLabel: 'Deadline to reach the target',
    frecuenciaLabel: 'Measurement frequency',
    responsableLabel: 'Owner (org chart role)',
    responsableNombreLabel: 'Owner name',
    validado: 'Validated',
    pendienteValidar: 'Pending validation',
    eliminar: 'Remove',
    origenIA: 'Proposed by Babel',
    origenManual: 'Added manually',
    notaIALabel: "Note from Babel (original text not automatically linked)",
    savedNote: 'Changes are saved automatically in this browser.',
  },
};

function blankIndicador(): Indicador {
  return {
    id: generateId(),
    objetivoId: '',
    entornoId: '',
    accionesIds: [],
    nombre: '',
    formula: '',
    especifico: '',
    medible: '',
    alcanzable: '',
    relevante: '',
    temporal: '',
    lineaBase: '',
    meta: '',
    fechaLimite: '',
    frecuencia: 'mensual',
    responsableRoleKey: '',
    responsableNombre: '',
    origen: 'manual',
    validado: false,
    notaIA: '',
  };
}

interface RawIndicadorIA {
  objetivoTexto?: string;
  entornoTexto?: string;
  accionesTexto?: string[];
  nombre?: string;
  formula?: string;
  especifico?: string;
  medible?: string;
  alcanzable?: string;
  relevante?: string;
  temporal?: string;
  lineaBase?: string;
  meta?: string;
  fechaLimiteSugerida?: string;
  frecuencia?: string;
  responsableRoleKey?: string;
}

function isFrecuencia(value: string): value is Frecuencia {
  return value === 'semanal' || value === 'mensual' || value === 'trimestral' || value === 'semestral' || value === 'anual';
}

export default function IndicadoresBuilder({ lang }: { lang: PlanLang }) {
  const t = LABELS[lang];
  const [translationCache, setTranslationCache] = React.useState<Record<string, string>>({});
  const tr = React.useCallback(function (text: string): string {
    if (lang === 'es' || !text) return text;
    return translationCache[text] ?? text;
  }, [lang, translationCache]);

  const [objetivos, setObjetivos] = React.useState<PlanObjetivo[]>([]);
  const [entornos, setEntornos] = React.useState<PlanEntorno[]>([]);
  const [fds, setFds] = React.useState<PlanFD[]>([]);
  const [proyectos, setProyectos] = React.useState<PlanProyecto[]>([]);
  const [acciones, setAcciones] = React.useState<PlanAccion[]>([]);
  const [orgAssignments, setOrgAssignments] = React.useState<OrgAssignments>({});
  const [boardPresidente, setBoardPresidente] = React.useState('');

  const [indicadores, setIndicadores] = React.useState<Indicador[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState('');

  React.useEffect(() => {
    try {
      const rawPlan = window.localStorage.getItem(PLAN_STORAGE_KEY);
      if (rawPlan) {
        const parsed = JSON.parse(rawPlan);
        if (parsed && Array.isArray(parsed.objetivos)) setObjetivos(parsed.objetivos);
        if (parsed && Array.isArray(parsed.entornos)) setEntornos(parsed.entornos);
        if (parsed && Array.isArray(parsed.fds)) setFds(parsed.fds);
        if (parsed && Array.isArray(parsed.proyectos)) setProyectos(parsed.proyectos);
        if (parsed && Array.isArray(parsed.acciones)) setAcciones(parsed.acciones);
      }
    } catch (err) {
      console.error(err);
    }
    try {
      const rawOrg = window.localStorage.getItem(ORG_KEY);
      if (rawOrg) {
        const parsedOrg = JSON.parse(rawOrg);
        if (parsedOrg && typeof parsedOrg === 'object') setOrgAssignments(parsedOrg);
      }
    } catch (err) {
      console.error(err);
    }
    try {
      const rawBoard = window.localStorage.getItem(BOARD_KEY);
      if (rawBoard) {
        const parsedBoard = JSON.parse(rawBoard);
        if (parsedBoard && typeof parsedBoard.presidente === 'string') setBoardPresidente(parsedBoard.presidente);
      }
    } catch (err) {
      console.error(err);
    }
    try {
      const rawInd = window.localStorage.getItem(INDICADORES_KEY);
      if (rawInd) {
        const parsedInd = JSON.parse(rawInd);
        if (Array.isArray(parsedInd)) setIndicadores(parsedInd);
      }
    } catch (err) {
      console.error(err);
    }
    setLoaded(true);
  }, []);

  React.useEffect(() => {
    if (!loaded || lang === 'es') return;
    const texts = new Set<string>();
    indicadores.forEach(function (ind) {
      if (ind.nombre) texts.add(ind.nombre);
      if (ind.formula) texts.add(ind.formula);
      if (ind.especifico) texts.add(ind.especifico);
      if (ind.medible) texts.add(ind.medible);
      if (ind.alcanzable) texts.add(ind.alcanzable);
      if (ind.relevante) texts.add(ind.relevante);
      if (ind.temporal) texts.add(ind.temporal);
      if (ind.lineaBase) texts.add(ind.lineaBase);
      if (ind.meta) texts.add(ind.meta);
      if (ind.notaIA) texts.add(ind.notaIA);
    });
    objetivos.forEach(function (o) { if (o.texto) texts.add(o.texto); });
    entornos.forEach(function (e) { if (e.descripcion) texts.add(e.descripcion); });
    proyectos.forEach(function (p) { if (p.nombre) texts.add(p.nombre); });
    acciones.forEach(function (a) { if (a.descripcion) texts.add(a.descripcion); });
    texts.forEach(function (text) {
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
  }, [loaded, lang, indicadores, objetivos, entornos, proyectos, acciones]);

  React.useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(INDICADORES_KEY, JSON.stringify(indicadores));
    } catch (err) {
      console.error(err);
    }
  }, [indicadores, loaded]);

  const resolvePersonForRole = (roleKey: string): string => {
    if (!roleKey) return '';
    if (roleKey === 'consejo_administrativo') return boardPresidente;
    const a = orgAssignments[roleKey];
    return a && a.person ? a.person : '';
  };

  const objetivoPerspectivaById = (id: string): BSCPerspectiva | '' => {
    for (let i = 0; i < objetivos.length; i++) {
      if (objetivos[i].id === id) return objetivos[i].perspectiva;
    }
    return '';
  };

  const entornosDeObjetivo = (objetivoId: string): PlanEntorno[] => {
    if (!objetivoId) return [];
    return entornos.filter((e) => e.objetivoId === objetivoId);
  };

  const proyectoNombreById = (id: string): string => {
    for (let i = 0; i < proyectos.length; i++) {
      if (proyectos[i].id === id) return proyectos[i].nombre;
    }
    return '';
  };

  const accionesDisponibles: { id: string; label: string }[] = acciones.map((a) => {
    const proyectoNombre = proyectoNombreById(a.proyectoId);
    const base = a.descripcion || (lang === 'en' ? '(untitled action)' : '(accion sin titulo)');
    const translatedBase = tr(base);
    const translatedProyecto = proyectoNombre ? tr(proyectoNombre) : '';
    return { id: a.id, label: translatedProyecto ? translatedBase + ' — ' + translatedProyecto : translatedBase };
  });

  const addIndicador = () => setIndicadores((prev) => prev.concat([blankIndicador()]));
  const updateIndicador = (id: string, patch: Partial<Indicador>) =>
    setIndicadores((prev) => prev.map((it) => (it.id === id ? Object.assign({}, it, patch) : it)));
  const removeIndicador = (id: string) => setIndicadores((prev) => prev.filter((it) => it.id !== id));

  const toggleAccionVinculada = (indicadorId: string, accionId: string) => {
    setIndicadores((prev) =>
      prev.map((it) => {
        if (it.id !== indicadorId) return it;
        const active = it.accionesIds.indexOf(accionId) !== -1;
        const next = active ? it.accionesIds.filter((a) => a !== accionId) : it.accionesIds.concat([accionId]);
        return Object.assign({}, it, { accionesIds: next });
      }),
    );
  };

  const buildPlanContextText = (): string => {
    const lines: string[] = [];
    objetivos.forEach((o) => {
      lines.push('OBJETIVO [' + o.perspectiva + ']: ' + o.texto);
      const entornosDeO = entornos.filter((e) => e.objetivoId === o.id);
      entornosDeO.forEach((e) => {
        lines.push('  ' + (e.tipo === 'amenaza' ? 'AMENAZA' : 'OPORTUNIDAD') + ': ' + e.descripcion);
        const fdsDeE = fds.filter((f) => f.entornoId === e.id);
        fdsDeE.forEach((f) => {
          const proyectosDeF = proyectos.filter((p) => p.fdId === f.id);
          proyectosDeF.forEach((p) => {
            const accionesDeP = acciones.filter((a) => a.proyectoId === p.id);
            accionesDeP.forEach((a) => {
              const persona = a.responsableNombre || resolvePersonForRole(a.responsableRoleKey) || roleLabel(a.responsableRoleKey, lang);
              lines.push('    ACCION (proyecto "' + p.nombre + '"): ' + a.descripcion + ' | responsable: ' + persona);
            });
          });
        });
      });
    });
    return lines.join('\n');
  };

  const generarPropuesta = async () => {
    setGenerating(true);
    setGenError('');
    try {
      const planContext = buildPlanContextText();
      const roleKeysList = ROLE_OPTIONS.map((r) => r.key).join(', ');
      const res = await fetch('/api/babel/indicadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, planContext: planContext, roleKeys: roleKeysList }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.indicadores)) {
        setGenError((data && data.error) || (lang === 'en' ? 'Unknown error contacting Babel.' : 'Error desconocido al contactar a Babel.'));
        return;
      }
      const nuevos: Indicador[] = (data.indicadores as RawIndicadorIA[]).slice(0, 14).map((raw) => {
        const objetivoId = matchTextToId(raw.objetivoTexto || '', objetivos, (o) => o.texto);
        const entornoId = matchTextToId(raw.entornoTexto || '', entornos, (e) => e.descripcion);
        const accionesTexto = Array.isArray(raw.accionesTexto) ? raw.accionesTexto : [];
        const accionesIds: string[] = [];
        accionesTexto.forEach((txt) => {
          const matched = matchTextToId(txt, acciones, (a) => a.descripcion);
          if (matched) accionesIds.push(matched);
        });
        const notasSinVincular: string[] = [];
        if (raw.objetivoTexto && !objetivoId) notasSinVincular.push('Objetivo (IA): ' + raw.objetivoTexto);
        if (raw.entornoTexto && !entornoId) notasSinVincular.push('Amenaza/oportunidad (IA): ' + raw.entornoTexto);
        accionesTexto.forEach((txt) => {
          const matched = matchTextToId(txt, acciones, (a) => a.descripcion);
          if (!matched && txt) notasSinVincular.push('Accion (IA): ' + txt);
        });
        const roleKeyRaw = (raw.responsableRoleKey || '').trim();
        const roleKeyValido = ROLE_OPTIONS.some((r) => r.key === roleKeyRaw) ? roleKeyRaw : '';
        const frecuenciaRaw = (raw.frecuencia || 'mensual').trim().toLowerCase();
        const frecuencia: Frecuencia = isFrecuencia(frecuenciaRaw) ? frecuenciaRaw : 'mensual';
        return {
          id: generateId(),
          objetivoId: objetivoId,
          entornoId: entornoId,
          accionesIds: accionesIds,
          nombre: raw.nombre || '',
          formula: raw.formula || '',
          especifico: raw.especifico || '',
          medible: raw.medible || '',
          alcanzable: raw.alcanzable || '',
          relevante: raw.relevante || '',
          temporal: raw.temporal || '',
          lineaBase: raw.lineaBase || '',
          meta: raw.meta || '',
          fechaLimite: raw.fechaLimiteSugerida || '',
          frecuencia: frecuencia,
          responsableRoleKey: roleKeyValido,
          responsableNombre: roleKeyValido ? resolvePersonForRole(roleKeyValido) : '',
          origen: 'ia',
          validado: false,
          notaIA: notasSinVincular.join(' | '),
        };
      });
      setIndicadores((prev) => prev.concat(nuevos));
    } catch (err) {
      setGenError(lang === 'en' ? 'Connection error while contacting Babel.' : 'Error de conexion al contactar a Babel.');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const perspectivaCount = (value: BSCPerspectiva): number => {
    let count = 0;
    indicadores.forEach((ind) => {
      if (objetivoPerspectivaById(ind.objetivoId) === value) count = count + 1;
    });
    return count;
  };

  let validados = 0;
  indicadores.forEach((ind) => {
    if (ind.validado) validados = validados + 1;
  });
  const pendientes = indicadores.length - validados;

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

  const renderIndicador = (ind: Indicador) => {
    const perspectiva = objetivoPerspectivaById(ind.objetivoId);
    const entornosDisponibles = entornosDeObjetivo(ind.objetivoId);
    return (
      <div key={ind.id} className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={
              'rounded-full px-2.5 py-1 text-xs font-medium ' +
              (ind.origen === 'ia' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600')
            }
          >
            {ind.origen === 'ia' ? t.origenIA : t.origenManual}
          </span>
          {perspectiva ? (
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
              {perspectivaLabel(perspectiva, lang)}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{t.sinVincular}</span>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.objetivoLabel}</label>
            <select
              value={ind.objetivoId}
              onChange={(ev) => updateIndicador(ind.id, { objetivoId: ev.target.value, entornoId: '' })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">{t.objetivoPlaceholder}</option>
              {objetivos.map((o) => (
                <option key={o.id} value={o.id}>
                  {tr(o.texto) || t.objetivoPlaceholder}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.entornoLabel}</label>
            <select
              value={ind.entornoId}
              onChange={(ev) => updateIndicador(ind.id, { entornoId: ev.target.value })}
              disabled={!ind.objetivoId}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100"
            >
              <option value="">{t.entornoPlaceholder}</option>
              {entornosDisponibles.map((e) => (
                <option key={e.id} value={e.id}>
                  {(e.tipo === 'amenaza' ? '⚠ ' : '✦ ') + tr(e.descripcion)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">{t.accionesLabel}</label>
          <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
            {accionesDisponibles.length === 0 ? (
              <span className="text-xs text-slate-400">—</span>
            ) : (
              accionesDisponibles.map((opt) => {
                const active = ind.accionesIds.indexOf(opt.id) !== -1;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleAccionVinculada(ind.id, opt.id)}
                    className={
                      'rounded-full px-2 py-0.5 text-xs font-medium ' +
                      (active ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-400' : 'bg-slate-100 text-slate-600')
                    }
                  >
                    {tr(opt.label)}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.nombreLabel}</label>
            <input
              type="text"
              value={tr(ind.nombre)}
              onChange={(ev) => updateIndicador(ind.id, { nombre: ev.target.value })}
              placeholder={t.nombrePlaceholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.formulaLabel}</label>
            <input
              type="text"
              value={tr(ind.formula)}
              onChange={(ev) => updateIndicador(ind.id, { formula: ev.target.value })}
              placeholder={t.formulaPlaceholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.especificoLabel}</label>
            <textarea
              value={tr(ind.especifico)}
              onChange={(ev) => updateIndicador(ind.id, { especifico: ev.target.value })}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.medibleLabel}</label>
            <input
              type="text"
              value={tr(ind.medible)}
              onChange={(ev) => updateIndicador(ind.id, { medible: ev.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.alcanzableLabel}</label>
            <textarea
              value={tr(ind.alcanzable)}
              onChange={(ev) => updateIndicador(ind.id, { alcanzable: ev.target.value })}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.relevanteLabel}</label>
            <textarea
              value={tr(ind.relevante)}
              onChange={(ev) => updateIndicador(ind.id, { relevante: ev.target.value })}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.temporalLabel}</label>
            <input
              type="text"
              value={tr(ind.temporal)}
              onChange={(ev) => updateIndicador(ind.id, { temporal: ev.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.lineaBaseLabel}</label>
            <input
              type="text"
              value={tr(ind.lineaBase)}
              onChange={(ev) => updateIndicador(ind.id, { lineaBase: ev.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.metaLabel}</label>
            <input
              type="text"
              value={tr(ind.meta)}
              onChange={(ev) => updateIndicador(ind.id, { meta: ev.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.fechaLimiteLabel}</label>
            <input
              type="date"
              value={ind.fechaLimite}
              onChange={(ev) => updateIndicador(ind.id, { fechaLimite: ev.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.frecuenciaLabel}</label>
            <select
              value={ind.frecuencia}
              onChange={(ev) => updateIndicador(ind.id, { frecuencia: ev.target.value as Frecuencia })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              {FRECUENCIA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {lang === 'en' ? opt.labelEn : opt.labelEs}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.responsableLabel}</label>
            <select
              value={ind.responsableRoleKey}
              onChange={(ev) => {
                const roleKey = ev.target.value;
                const person = resolvePersonForRole(roleKey);
                updateIndicador(ind.id, { responsableRoleKey: roleKey, responsableNombre: person ? person : ind.responsableNombre });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">{t.responsableLabel}</option>
              {ROLE_OPTIONS.map((opt) => {
                const person = resolvePersonForRole(opt.key);
                const label = roleLabel(opt.key, lang) + (person ? ' - ' + person : '');
                return (
                  <option key={opt.key} value={opt.key}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.responsableNombreLabel}</label>
            <input
              type="text"
              value={ind.responsableNombre}
              onChange={(ev) => updateIndicador(ind.id, { responsableNombre: ev.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        {ind.notaIA ? (
          <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            <span className="font-medium">{t.notaIALabel}: </span>
            {tr(ind.notaIA)}
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between">
          <ValidateBadge validado={ind.validado} onToggle={() => updateIndicador(ind.id, { validado: !ind.validado })} />
          <button type="button" onClick={() => removeIndicador(ind.id)} className="text-xs font-medium text-red-600 hover:underline">
            {t.eliminar}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h3 className="text-xl font-bold text-slate-800">{t.title}</h3>
      <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>

      <div className="mt-4">
        <FinancialGoalsBuilder lang={lang} />
      </div>

      {loaded && objetivos.length === 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{t.noObjetivos}</div>
      ) : (
        <React.Fragment>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-lg font-bold text-slate-800">{indicadores.length}</div>
              <div className="text-xs text-slate-500">{t.summaryTotal}</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
              <div className="text-lg font-bold text-green-700">{validados}</div>
              <div className="text-xs text-green-600">{t.summaryValidados}</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
              <div className="text-lg font-bold text-amber-700">{pendientes}</div>
              <div className="text-xs text-amber-600">{t.summaryPendientes}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-lg font-bold text-slate-800">{perspectivaCount('financiera')}</div>
              <div className="text-xs text-slate-500">{t.summaryFinanciera}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-lg font-bold text-slate-800">{perspectivaCount('clientes')}</div>
              <div className="text-xs text-slate-500">{t.summaryClientes}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-lg font-bold text-slate-800">{perspectivaCount('procesos_internos')}</div>
              <div className="text-xs text-slate-500">{t.summaryProcesos}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={generarPropuesta}
              disabled={generating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {generating ? t.generando : t.generar}
            </button>
            <button
              type="button"
              onClick={addIndicador}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t.agregarManual}
            </button>
          </div>

          {genError ? (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-medium">{t.errorTitle}</p>
              <p className="mt-0.5">{genError}</p>
              <p className="mt-0.5 text-xs text-red-500">{t.errorHint}</p>
            </div>
          ) : null}

          <div className="mt-6">{indicadores.map((ind) => renderIndicador(ind))}</div>
        </React.Fragment>
      )}

      <p className="mt-4 text-xs text-slate-400">{t.savedNote}</p>
    </div>
  );
}
