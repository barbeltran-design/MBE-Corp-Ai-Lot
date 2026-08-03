'use client';
import React from 'react';
import FinancialGoalsBuilder from '@/components/babel/FinancialGoalsBuilder';

type PlanLang = 'es' | 'en';
type BSCPerspectiva = 'financiera' | 'clientes' | 'procesos_internos' | 'aprendizaje_crecimiento' | 'socioambiental';
type Frecuencia = 'semanal' | 'mensual' | 'trimestral' | 'semestral' | 'anual';

type Indicador = {
  id: string;
  perspectiva: BSCPerspectiva | '';
  nombre: string;
  formula: string;
  objetivo: string;
  meta: string;
  unidadMedida: string;
  frecuencia: Frecuencia;
  origen: 'ia' | 'manual';
  validado: boolean;
};

const FIN_GOALS_LAST_KEY = 'babel_financial_goals_v1';
const INDICADORES_KEY = 'babel_indicadores_v1';

const PERSPECTIVA_OPTIONS: { value: BSCPerspectiva; labelEs: string; labelEn: string }[] = [
  { value: 'financiera', labelEs: 'Financiera', labelEn: 'Financial' },
  { value: 'clientes', labelEs: 'Clientes', labelEn: 'Customer' },
  { value: 'procesos_internos', labelEs: 'Procesos Internos', labelEn: 'Internal Processes' },
  { value: 'aprendizaje_crecimiento', labelEs: 'Aprendizaje y Crecimiento', labelEn: 'Learning and Growth' },
  { value: 'socioambiental', labelEs: 'Socioambiental', labelEn: 'Social-Environmental' },
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

function perspectivaLabel(value: BSCPerspectiva | '', lang: PlanLang): string {
  for (let i = 0; i < PERSPECTIVA_OPTIONS.length; i++) {
    if (PERSPECTIVA_OPTIONS[i].value === value) {
      return lang === 'en' ? PERSPECTIVA_OPTIONS[i].labelEn : PERSPECTIVA_OPTIONS[i].labelEs;
    }
  }
  return '';
}

const LABELS = {
  es: {
    title: 'Objetivos Estratégicos (Balanced Scorecard)',
    subtitle:
      'Babel propone los objetivos del Balanced Scorecard: el nombre y la redaccion del objetivo vienen del catalogo estandar y Babel solo completa los valores entre corchetes [] usando tus objetivos financieros y el giro de tu negocio. Puedes modificar cualquier campo y validar cada objetivo.',
    generar: 'Generar propuesta con Babel',
    generando: 'Generando propuesta...',
    agregarManual: 'Agregar objetivo manualmente',
    errorTitle: 'No se pudo generar la propuesta automatica',
    errorHint: 'Puedes seguir agregando objetivos de forma manual mientras tanto.',
    summaryTotal: 'Objetivos totales',
    summaryValidados: 'Validados',
    summaryPendientes: 'Pendientes de validar',
    summaryFinanciera: 'Perspectiva financiera',
    summaryClientes: 'Perspectiva clientes',
    summaryProcesos: 'Perspectiva procesos internos',
    summaryAprendizaje: 'Perspectiva aprendizaje y crecimiento',
    summarySocioambiental: 'Perspectiva socioambiental',
    perspectivaLabel: 'Perspectiva (Balanced Scorecard)',
    nombreLabel: 'Nombre del objetivo',
    nombrePlaceholder: 'Ej. Ingresos (Ventas)',
    formulaLabel: 'Formula de calculo',
    formulaPlaceholder: 'Ej. (Ventas del mes / Ingreso meta) x 100',
    objetivoRedaccionLabel: 'Objetivo',
    objetivoRedaccionPlaceholder: 'Redaccion del objetivo con los valores entre corchetes completados por Babel.',
    metaLabel: 'Meta',
    metaPlaceholder: 'Ej. $50,000 mensuales',
    unidadMedidaLabel: 'Unidad de Medida',
    unidadMedidaPlaceholder: 'Ej. $, %, numero de clientes',
    frecuenciaLabel: 'Frecuencia de medida',
    validado: 'Validado',
    pendienteValidar: 'Pendiente de validar',
    eliminar: 'Eliminar',
    origenIA: 'Propuesto por Babel',
    origenManual: 'Agregado manualmente',
    savedNote: 'Los cambios se guardan automaticamente en este navegador.',
  },
  en: {
    title: 'Strategic Objectives (Balanced Scorecard)',
    subtitle:
      'Babel proposes the Balanced Scorecard objectives: the name and the objective wording come from the standard catalog and Babel only completes the values in square brackets [] using your financial goals and your business type. You can edit any field and validate each objective.',
    generar: 'Generate proposal with Babel',
    generando: 'Generating proposal...',
    agregarManual: 'Add objective manually',
    errorTitle: 'The automatic proposal could not be generated',
    errorHint: 'You can keep adding objectives manually in the meantime.',
    summaryTotal: 'Total objectives',
    summaryValidados: 'Validated',
    summaryPendientes: 'Pending validation',
    summaryFinanciera: 'Financial perspective',
    summaryClientes: 'Customer perspective',
    summaryProcesos: 'Internal processes perspective',
    summaryAprendizaje: 'Learning and growth perspective',
    summarySocioambiental: 'Social-environmental perspective',
    perspectivaLabel: 'Perspective (Balanced Scorecard)',
    nombreLabel: 'Objective name',
    nombrePlaceholder: 'E.g. Income (Sales)',
    formulaLabel: 'Calculation formula',
    formulaPlaceholder: 'E.g. (Monthly sales / Goal revenue) x 100',
    objetivoRedaccionLabel: 'Objective',
    objetivoRedaccionPlaceholder: 'Objective wording with the bracketed values completed by Babel.',
    metaLabel: 'Target',
    metaPlaceholder: 'E.g. $50,000 monthly',
    unidadMedidaLabel: 'Unit of measure',
    unidadMedidaPlaceholder: 'E.g. $, %, number of customers',
    frecuenciaLabel: 'Measurement frequency',
    validado: 'Validated',
    pendienteValidar: 'Pending validation',
    eliminar: 'Remove',
    origenIA: 'Proposed by Babel',
    origenManual: 'Added manually',
    savedNote: 'Changes are saved automatically in this browser.',
  },
};

function blankIndicador(): Indicador {
  return {
    id: generateId(),
    perspectiva: '',
    nombre: '',
    formula: '',
    objetivo: '',
    meta: '',
    unidadMedida: '',
    frecuencia: 'mensual',
    origen: 'manual',
    validado: false,
  };
}

interface RawIndicadorIA {
  perspectiva?: string;
  nombre?: string;
  objetivo?: string;
  formula?: string;
  meta?: string;
  unidadMedida?: string;
  frecuencia?: string;
}

function isFrecuencia(value: string): value is Frecuencia {
  return value === 'semanal' || value === 'mensual' || value === 'trimestral' || value === 'semestral' || value === 'anual';
}

function isPerspectiva(value: string): value is BSCPerspectiva {
  return PERSPECTIVA_OPTIONS.some((p) => p.value === value);
}

// Construye el contexto financiero compacto que Babel usa para llenar los
// [corchetes] de la perspectiva financiera, leyendo el ultimo guardado de
// FinancialGoalsBuilder (clave babel_financial_goals_v1).
function buildFinancialContext(lang: PlanLang): string {
  try {
    const raw = window.localStorage.getItem(FIN_GOALS_LAST_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    const i = parsed && parsed.input;
    const r = parsed && parsed.result;
    if (!i || !r) return '';
    const money = (v: number): string => '$' + Math.round(v).toLocaleString(lang === 'en' ? 'en-US' : 'es-MX');
    const monthly = lang === 'en' ? 'monthly' : 'mensuales';
    const channels =
      Array.isArray(i.channels) && i.channels.length > 0
        ? i.channels.map((c: { name: string; pct: number }) => c.name + ' (' + Math.round(c.pct) + '%)').join(', ')
        : lang === 'en'
          ? 'not declared'
          : 'no declarados';
    return [
      (lang === 'en' ? 'Break-even point: ' : 'Punto de equilibrio: ') + money(r.breakEvenWithMarketing) + ' ' + monthly,
      (lang === 'en' ? 'Goal revenue: ' : 'Ingreso meta: ') + money(r.targetRevenueWithMarketing) + ' ' + monthly,
      (lang === 'en' ? 'Desired profit: ' : 'Utilidad deseada: ') + money(i.desiredProfit) + ' ' + monthly,
      (lang === 'en' ? 'Fixed expenses: ' : 'Gastos fijos: ') + money(r.fixedTotal) + ' ' + monthly,
      (lang === 'en' ? 'Variable expenses: ' : '% Gastos variables: ') + (r.totalVariablePctWithMarketing * 100).toFixed(1) + '%',
      (lang === 'en' ? 'Income channels: ' : 'Canales de ingreso: ') + channels,
    ].join(' | ');
  } catch {
    return '';
  }
}

export default function IndicadoresBuilder({ lang }: { lang: PlanLang }) {
  const t = LABELS[lang];
  const [translationCache, setTranslationCache] = React.useState<Record<string, string>>({});
  const tr = React.useCallback(function (text: string): string {
    if (lang === 'es' || !text) return text;
    return translationCache[text] ?? text;
  }, [lang, translationCache]);

  const [indicadores, setIndicadores] = React.useState<Indicador[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState('');

  React.useEffect(() => {
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
      if (ind.objetivo) texts.add(ind.objetivo);
      if (ind.meta) texts.add(ind.meta);
      if (ind.unidadMedida) texts.add(ind.unidadMedida);
    });
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
  }, [loaded, lang, indicadores]);

  React.useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(INDICADORES_KEY, JSON.stringify(indicadores));
    } catch (err) {
      console.error(err);
    }
  }, [indicadores, loaded]);

  const addIndicador = () => setIndicadores((prev) => prev.concat([blankIndicador()]));
  const updateIndicador = (id: string, patch: Partial<Indicador>) =>
    setIndicadores((prev) => prev.map((it) => (it.id === id ? Object.assign({}, it, patch) : it)));
  const removeIndicador = (id: string) => setIndicadores((prev) => prev.filter((it) => it.id !== id));

  const generarPropuesta = async () => {
    setGenerating(true);
    setGenError('');
    try {
      const financialContext = buildFinancialContext(lang);
      const res = await fetch('/api/babel/indicadores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, financialContext }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.indicadores)) {
        setGenError((data && data.error) || (lang === 'en' ? 'Unknown error contacting Babel.' : 'Error desconocido al contactar a Babel.'));
        return;
      }
      const nuevos: Indicador[] = (data.indicadores as RawIndicadorIA[]).slice(0, 18).map((raw) => {
        const perspectivaRaw = (raw.perspectiva || '').trim().toLowerCase();
        const frecuenciaRaw = (raw.frecuencia || 'mensual').trim().toLowerCase();
        return {
          id: generateId(),
          perspectiva: isPerspectiva(perspectivaRaw) ? perspectivaRaw : '',
          nombre: (raw.nombre || '').trim(),
          formula: (raw.formula || '').trim(),
          objetivo: (raw.objetivo || '').trim(),
          meta: (raw.meta || '').trim(),
          unidadMedida: (raw.unidadMedida || '').trim(),
          frecuencia: isFrecuencia(frecuenciaRaw) ? frecuenciaRaw : 'mensual',
          origen: 'ia',
          validado: false,
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
      if (ind.perspectiva === value) count = count + 1;
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
          {ind.perspectiva ? (
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
              {perspectivaLabel(ind.perspectiva, lang)}
            </span>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
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

        <div className="mt-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">{t.objetivoRedaccionLabel}</label>
          <textarea
            value={tr(ind.objetivo)}
            onChange={(ev) => updateIndicador(ind.id, { objetivo: ev.target.value })}
            rows={3}
            placeholder={t.objetivoRedaccionPlaceholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.metaLabel}</label>
            <input
              type="text"
              value={tr(ind.meta)}
              onChange={(ev) => updateIndicador(ind.id, { meta: ev.target.value })}
              placeholder={t.metaPlaceholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">{t.unidadMedidaLabel}</label>
            <input
              type="text"
              value={tr(ind.unidadMedida)}
              onChange={(ev) => updateIndicador(ind.id, { unidadMedida: ev.target.value })}
              placeholder={t.unidadMedidaPlaceholder}
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
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
          <div className="text-lg font-bold text-slate-800">{perspectivaCount('aprendizaje_crecimiento')}</div>
          <div className="text-xs text-slate-500">{t.summaryAprendizaje}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
          <div className="text-lg font-bold text-slate-800">{perspectivaCount('socioambiental')}</div>
          <div className="text-xs text-slate-500">{t.summarySocioambiental}</div>
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

      <p className="mt-4 text-xs text-slate-400">{t.savedNote}</p>
    </div>
  );
}
