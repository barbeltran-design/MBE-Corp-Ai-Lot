'use client';
import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import AgentAvatar from '@/components/agentes/AgentAvatar';
import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';
import { getFirebaseAuth } from '@/lib/firebase';
import { getLatestAssessmentAnswers } from '@/lib/assessment';
import { DIMENSION_IDS, getMaturityDimensions, type DimensionId } from '@/lib/maturity-dimensions';
import { MENTORES, PRACTICAS_POR_TEMA, type MentorAgente, type PracticaMadurez } from '@/lib/madurez-practicas';
import type { DimensionAnswers } from '@/lib/maturity-scoring';

type PlanLang = 'es' | 'en';
type Estatus = 'pendiente' | 'en_progreso' | 'completada';
type TareaEstatus = 'todo' | 'doing' | 'done';

const PLAN_KEY = 'babel_madurez_plan_v1';

interface Compromiso {
  id: string;
  themeId: DimensionId;
  nivel: number;
  practica: string;
  mentor: MentorAgente;
  estatus: Estatus;
}

interface TareaScrum {
  id: string;
  texto: string;
  estatus: TareaEstatus;
}

interface Sprint {
  accion: string; // "themeId|nivel" o ''
  tareas: TareaScrum[];
}

interface PlanMadurez {
  v: number;
  completados: Partial<Record<DimensionId, number>>;
  compromisos: Record<string, Compromiso[]>;
  sprints: Record<string, Sprint>;
}

const LEVEL_LABELS: Record<PlanLang, string[]> = {
  es: ['Ejecucion', 'Estandar', 'Control', 'Optimizacion', 'Excelencia', 'Influencer'],
  en: ['Execution', 'Standard', 'Control', 'Optimization', 'Excellence', 'Influencer'],
};

const MESES: Record<PlanLang, string[]> = {
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const MENTOR_COLOR: Record<MentorAgente, string> = {
  Babel: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200',
  Fisnando: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  Karmetin: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
  Normau: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  Atech: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
};

const LABELS = {
  es: {
    title: 'Plan de Madurez',
    subtitle:
      'Cada mes se trabaja una practica con cada agente (Babel, Fisnando, Karmetin, Normau y Atech) en el orden de los temas de la Evaluacion de Madurez: se parte del nivel mas bajo de Rumbo Estrategico y se avanza hasta Cultura Organizacional, para regresar en ciclo al siguiente nivel de cada tema. Las practicas sugeridas salen de tu evaluacion (el nivel mas bajo no completado) y todo es editable.',
    sinEvaluacion:
      'Aun no se encontro tu Evaluacion de Madurez. Completa el diagnostico para que las sugerencias partan de tu nivel real; mientras tanto el plan parte del nivel Ejecucion.',
    agentesTitle: 'Siguiente practica por agente',
    agenteSinPendientes: 'No quedan practicas pendientes',
    planMensualTitle: 'Plan del mes',
    planMensualHint: 'Cada mes se agenda una practica con cada agente. Actualiza el estatus cuando la completes.',
    actualizarMes: 'Actualizar plan del mes',
    temaCol: 'Tema',
    nivelCol: 'Nivel',
    practicaCol: 'Buena practica',
    estatusCol: 'Estatus',
    eliminar: 'Eliminar',
    pendiente: 'Pendiente',
    enProgreso: 'En progreso',
    completada: 'Completada',
    marcarCompletada: 'Marcar completada',
    temasTitle: 'Practicas por tema',
    temaCompleto: 'Tema al maximo (6 niveles)',
    siguienteCol: 'Siguiente practica',
    scrumTitle: 'Scrum semanal',
    scrumHint: 'Cada semana se decide UNA accion a realizar y se divide en tareas. Toca una tarjeta para moverla de columna.',
    accionSemana: 'Accion de la semana',
    accionSinOpciones: 'No hay practicas pendientes para elegir',
    tareaPlaceholder: 'Describe la tarea de la semana...',
    agregarTarea: 'Agregar',
    colTodo: 'A realizar',
    colDoing: 'En curso',
    colDone: 'Hechas',
    guardado: 'Los cambios se guardan automaticamente en este navegador.',
    semanaLabel: 'Semana del {desde} al {hasta}',
    mesLabel: '{mes} {anio}',
    sinAccion: 'Elige una accion para esta semana',
    emptyMes: 'Este mes no tiene compromisos. Toca "Actualizar plan del mes".',
    sinCompromiso: 'Sin practica asignada este mes',
  },
  en: {
    title: 'Maturity Plan',
    subtitle:
      'Each month you work on one practice with each agent (Babel, Fisnando, Karmetin, Normau and Atech) following the order of the Maturity Assessment topics: starting from the lowest level of Strategic Direction and advancing through Organizational Culture, then cycling back to the next level of each topic. Suggested practices come from your assessment (lowest incomplete level) and everything is editable.',
    sinEvaluacion:
      'Your Maturity Assessment was not found yet. Complete the diagnosis so suggestions start from your real level; in the meantime the plan starts from the Execution level.',
    agentesTitle: 'Next practice per agent',
    agenteSinPendientes: 'No pending practices left',
    planMensualTitle: 'Monthly plan',
    planMensualHint: 'Each month schedules one practice per agent. Update the status when you complete it.',
    actualizarMes: 'Refresh monthly plan',
    temaCol: 'Topic',
    nivelCol: 'Level',
    practicaCol: 'Good practice',
    estatusCol: 'Status',
    eliminar: 'Remove',
    pendiente: 'Pending',
    enProgreso: 'In progress',
    completada: 'Completed',
    marcarCompletada: 'Mark as completed',
    temasTitle: 'Practices by topic',
    temaCompleto: 'Topic at maximum (6 levels)',
    siguienteCol: 'Next practice',
    scrumTitle: 'Weekly scrum',
    scrumHint: 'Each week ONE action is chosen and broken into tasks. Tap a card to move it across columns.',
    accionSemana: 'Action of the week',
    accionSinOpciones: 'No pending practices to choose from',
    tareaPlaceholder: "Describe this week's task...",
    agregarTarea: 'Add',
    colTodo: 'To do',
    colDoing: 'In progress',
    colDone: 'Done',
    guardado: 'Changes are saved automatically in this browser.',
    semanaLabel: 'Week of {desde} to {hasta}',
    mesLabel: '{mes} {anio}',
    sinAccion: 'Pick an action for this week',
    emptyMes: 'This month has no commitments. Tap "Refresh monthly plan".',
    sinCompromiso: 'No practice assigned this month',
  },
};

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function monthKeyOf(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
}

function addMonths(monthKey: string, delta: number): string {
  const parts = monthKey.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function monthLabel(monthKey: string, lang: PlanLang): string {
  const parts = monthKey.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  return LABELS[lang].mesLabel.replace('{mes}', MESES[lang][d.getMonth()]).replace('{anio}', String(d.getFullYear()));
}

function lunesDe(date: Date): Date {
  const c = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = c.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  c.setDate(c.getDate() + diff);
  return c;
}

function addWeeks(monday: Date, delta: number): Date {
  const c = new Date(monday);
  c.setDate(c.getDate() + delta * 7);
  return c;
}

function weekKeyOf(monday: Date): string {
  return (
    monday.getFullYear() +
    '-' +
    String(monday.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(monday.getDate()).padStart(2, '0')
  );
}

function fmtDay(date: Date, lang: PlanLang): string {
  return date.getDate() + ' ' + MESES[lang][date.getMonth()];
}

const PASOS_TOUR: Record<PlanLang, TourStep[]> = {
  es: [
    { selector: '#madurez-plan-title', title: 'Mejora del Nivel de Madurez', description: 'Aquí defines las acciones para mejorar la madurez de tu organización: cada mes una práctica con cada agente, en el orden de los temas de la evaluación.' },
    { selector: '#madurez-scrum', title: 'Scrum semanal', description: 'Semana a semana se elige UNA acción y se divide en tareas. Toca una tarjeta para moverla entre columnas.' },
    { selector: '#madurez-agentes', title: 'Siguiente práctica por agente', description: 'Cada agente (Babel, Fisnando, Karmetin, Normau y Atech) tiene asignada la siguiente práctica sugerida, partiendo del nivel más bajo no completado de tu evaluación.' },
    { selector: '#madurez-mensual', title: 'Plan del mes', description: 'Cada mes se agenda una práctica con cada agente. Actualiza el estatus a Completada para avanzar automáticamente al siguiente nivel del tema.' },
    { selector: '#madurez-temas', title: 'Prácticas por tema', description: 'El detalle de los 11 temas: la siguiente práctica a trabajar y, si ya la dominas, márcala completada.' },
  ],
  en: [
    { selector: '#madurez-plan-title', title: 'Maturity Level Improvement', description: 'This is where you define the actions to improve your organization\'s maturity: one practice with each agent per month, following the assessment topic order.' },
    { selector: '#madurez-scrum', title: 'Weekly scrum', description: 'Week by week you choose ONE action and break it into tasks. Tap a card to move it across columns.' },
    { selector: '#madurez-agentes', title: 'Next practice per agent', description: 'Each agent (Babel, Fisnando, Karmetin, Normau and Atech) has its next suggested practice, starting from the lowest incomplete level of your assessment.' },
    { selector: '#madurez-mensual', title: 'Monthly plan', description: 'Each month schedules one practice per agent. Update the status to Completed to automatically advance to the next level of the topic.' },
    { selector: '#madurez-temas', title: 'Practices by topic', description: 'The detail of the 11 topics: the next practice to work on and, if you already master it, mark it as completed.' },
  ],
};

export default function MaturityPlanBuilder({ lang }: { lang: PlanLang }) {
  const t = LABELS[lang];
  const dimensions = React.useMemo(() => getMaturityDimensions(lang), [lang]);
  const temaDe = React.useMemo(() => {
    const m: Record<string, string> = {};
    dimensions.forEach((d) => {
      m[d.id] = d.tema;
    });
    return m;
  }, [dimensions]);

  const [user, setUser] = React.useState<User | null | undefined>(undefined);
  const [answers, setAnswers] = React.useState<DimensionAnswers | null>(null);
  const [plan, setPlan] = React.useState<PlanMadurez>(() => ({ v: 1, completados: {}, compromisos: {}, sprints: {} }));
  const [loaded, setLoaded] = React.useState(false);
  const [mesSel, setMesSel] = React.useState<string>(() => monthKeyOf(new Date()));
  const [semanaOffset, setSemanaOffset] = React.useState(0);
  const [nuevaTarea, setNuevaTarea] = React.useState('');

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const ans = await getLatestAssessmentAnswers(user.uid);
        if (!cancelled) setAnswers(ans);
      } catch (err) {
        console.error('[MBE Madurez] failed to load assessment', err);
        if (!cancelled) setAnswers(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PLAN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setPlan({
            v: 1,
            completados: parsed.completados ?? {},
            compromisos: parsed.compromisos ?? {},
            sprints: parsed.sprints ?? {},
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
    setLoaded(true);
  }, []);

  React.useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    } catch (err) {
      console.error(err);
    }
  }, [plan, loaded]);

  const baseNivel = React.useCallback(
    (themeId: DimensionId): number => {
      if (!answers) return 0;
      const arr = answers[themeId];
      if (!arr) return 0;
      for (let i = 0; i < 6; i++) {
        if (arr[i] !== 'yes') return i;
      }
      return 6;
    },
    [answers]
  );

  const siguienteNivel = React.useCallback(
    (themeId: DimensionId): number => {
      const b = baseNivel(themeId) + (plan.completados[themeId] ?? 0);
      return b > 6 ? 6 : b;
    },
    [baseNivel, plan.completados]
  );

  const proximaPractica = React.useCallback(
    (themeId: DimensionId): { nivel: number; practica: PracticaMadurez } | null => {
      const n = siguienteNivel(themeId);
      if (n >= 6) return null;
      return { nivel: n, practica: PRACTICAS_POR_TEMA[themeId][n] };
    },
    [siguienteNivel]
  );

  const siguienteDeAgente = React.useCallback(
    (mentor: MentorAgente): { themeId: DimensionId; nivel: number; practica: PracticaMadurez } | null => {
      for (const id of DIMENSION_IDS) {
        const sig = proximaPractica(id);
        if (sig && sig.practica.mentor === mentor) return { themeId: id, ...sig };
      }
      return null;
    },
    [proximaPractica]
  );

  const generarMes = (mesKey: string) => {
    setPlan((prev) => {
      const actuales = prev.compromisos[mesKey] ?? [];
      const nuevos = [...actuales];
      let cambio = false;
      const findSig = (mentor: MentorAgente): { themeId: DimensionId; nivel: number; practica: PracticaMadurez } | null => {
        for (const id of DIMENSION_IDS) {
          if (nuevos.some((c) => c.themeId === id)) continue;
          const n = baseNivel(id) + (prev.completados[id] ?? 0);
          if (n >= 6) continue;
          const pr = PRACTICAS_POR_TEMA[id][n];
          if (pr.mentor === mentor) return { themeId: id, nivel: n, practica: pr };
        }
        return null;
      };
      for (const mentor of MENTORES) {
        if (nuevos.some((c) => c.mentor === mentor)) continue;
        const sig = findSig(mentor);
        if (sig) {
          nuevos.push({
            id: generateId(),
            themeId: sig.themeId,
            nivel: sig.nivel,
            practica: sig.practica.practica,
            mentor,
            estatus: 'pendiente',
          });
          cambio = true;
        }
      }
      if (!cambio) return prev;
      return { ...prev, compromisos: { ...prev.compromisos, [mesKey]: nuevos } };
    });
  };

  const cambiarEstatus = (mesKey: string, id: string, estatus: Estatus) => {
    setPlan((prev) => {
      const actuales = prev.compromisos[mesKey] ?? [];
      const comp = actuales.find((c) => c.id === id);
      if (!comp) return prev;
      const completados = { ...prev.completados };
      if (estatus === 'completada' && comp.estatus !== 'completada') {
        completados[comp.themeId] = (completados[comp.themeId] ?? 0) + 1;
      } else if (estatus !== 'completada' && comp.estatus === 'completada') {
        const v = (completados[comp.themeId] ?? 0) - 1;
        completados[comp.themeId] = v > 0 ? v : 0;
      }
      return {
        ...prev,
        completados,
        compromisos: {
          ...prev.compromisos,
          [mesKey]: actuales.map((c) => (c.id === id ? { ...c, estatus } : c)),
        },
      };
    });
  };

  const eliminarCompromiso = (mesKey: string, id: string) => {
    setPlan((prev) => {
      const actuales = prev.compromisos[mesKey] ?? [];
      const comp = actuales.find((c) => c.id === id);
      if (!comp) return prev;
      const completados = { ...prev.completados };
      if (comp.estatus === 'completada') {
        const v = (completados[comp.themeId] ?? 0) - 1;
        completados[comp.themeId] = v > 0 ? v : 0;
      }
      return {
        ...prev,
        completados,
        compromisos: { ...prev.compromisos, [mesKey]: actuales.filter((c) => c.id !== id) },
      };
    });
  };

  const marcarTemaCompletado = (themeId: DimensionId) => {
    setPlan((prev) => {
      const actuales = prev.compromisos[mesSel] ?? [];
      const n = baseNivel(themeId) + (prev.completados[themeId] ?? 0);
      if (n >= 6) return prev;
      const pr = PRACTICAS_POR_TEMA[themeId][n];
      const existente = actuales.find((c) => c.themeId === themeId);
      const yaCompletada = Boolean(existente && existente.estatus === 'completada');
      const compromisos = existente
        ? actuales.map((c) => (c.themeId === themeId ? { ...c, estatus: 'completada' as Estatus } : c))
        : actuales.concat([
            {
              id: generateId(),
              themeId,
              nivel: n,
              practica: pr.practica,
              mentor: pr.mentor,
              estatus: 'completada' as Estatus,
            },
          ]);
      return {
        ...prev,
        completados: {
          ...prev.completados,
          [themeId]: (prev.completados[themeId] ?? 0) + (yaCompletada ? 0 : 1),
        },
        compromisos: { ...prev.compromisos, [mesSel]: compromisos },
      };
    });
  };

  // ── Scrum semanal ─────────────────────────────────────────────────────────
  const semanaLunes = React.useMemo(() => addWeeks(lunesDe(new Date()), semanaOffset), [semanaOffset]);
  const semKey = weekKeyOf(semanaLunes);
  const sprint = plan.sprints[semKey];

  const accionPorDefecto = React.useMemo(() => {
    const mesKey = monthKeyOf(semanaLunes);
    const comps = plan.compromisos[mesKey] ?? [];
    for (const c of comps) {
      if (c.estatus !== 'completada') return c.themeId + '|' + c.nivel;
    }
    for (const id of DIMENSION_IDS) {
      const sig = proximaPractica(id);
      if (sig) return id + '|' + sig.nivel;
    }
    return '';
  }, [plan.compromisos, proximaPractica, semanaLunes]);

  const accionSel = sprint ? sprint.accion : accionPorDefecto;

  const opcionesAccion = React.useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const mesKey = monthKeyOf(semanaLunes);
    const comps = plan.compromisos[mesKey] ?? [];
    comps.forEach((c) => {
      if (c.estatus !== 'completada') {
        opts.push({ value: c.themeId + '|' + c.nivel, label: (temaDe[c.themeId] || c.themeId) + ' - ' + c.practica });
      }
    });
    DIMENSION_IDS.forEach((id) => {
      const sig = proximaPractica(id);
      if (!sig) return;
      const value = id + '|' + sig.nivel;
      if (opts.some((o) => o.value === value)) return;
      opts.push({
        value,
        label: (temaDe[id] || id) + ' (' + LEVEL_LABELS[lang][sig.nivel] + ') - ' + sig.practica.practica,
      });
    });
    return opts;
  }, [plan.compromisos, proximaPractica, semanaLunes, lang, temaDe]);

  const labelDeAccion = React.useCallback(
    (value: string): string => {
      const parts = value.split('|');
      const id = parts[0] as DimensionId;
      const n = Number(parts[1] || 0);
      const pr = PRACTICAS_POR_TEMA[id]?.[n];
      return (temaDe[id] || id) + ' (' + LEVEL_LABELS[lang][n] + ') - ' + (pr?.practica || '');
    },
    [lang, temaDe]
  );

  const opcionesEfectivas = React.useMemo(() => {
    if (!accionSel) return opcionesAccion;
    if (opcionesAccion.some((o) => o.value === accionSel)) return opcionesAccion;
    return [{ value: accionSel, label: labelDeAccion(accionSel) }, ...opcionesAccion];
  }, [accionSel, opcionesAccion, labelDeAccion]);

  const fijarAccion = (value: string) => {
    setPlan((prev) => ({
      ...prev,
      sprints: { ...prev.sprints, [semKey]: { accion: value, tareas: prev.sprints[semKey]?.tareas ?? [] } },
    }));
  };

  const agregarTarea = () => {
    const texto = nuevaTarea.trim();
    if (!texto) return;
    setPlan((prev) => ({
      ...prev,
      sprints: {
        ...prev.sprints,
        [semKey]: {
          accion: prev.sprints[semKey]?.accion ?? accionPorDefecto,
          tareas: (prev.sprints[semKey]?.tareas ?? []).concat([{ id: generateId(), texto, estatus: 'todo' as TareaEstatus }]),
        },
      },
    }));
    setNuevaTarea('');
  };

  const moverTarea = (id: string) => {
    setPlan((prev) => {
      const s = prev.sprints[semKey];
      if (!s) return prev;
      return {
        ...prev,
        sprints: {
          ...prev.sprints,
          [semKey]: {
            ...s,
            tareas: s.tareas.map((ta) =>
              ta.id === id
                ? { ...ta, estatus: (ta.estatus === 'todo' ? 'doing' : ta.estatus === 'doing' ? 'done' : 'todo') as TareaEstatus }
                : ta
            ),
          },
        },
      };
    });
  };

  const eliminarTarea = (id: string) => {
    setPlan((prev) => {
      const s = prev.sprints[semKey];
      if (!s) return prev;
      return { ...prev, sprints: { ...prev.sprints, [semKey]: { ...s, tareas: s.tareas.filter((ta) => ta.id !== id) } } };
    });
  };

  const tareas = sprint?.tareas ?? [];
  const semanaFin = (() => {
    const d = new Date(semanaLunes);
    d.setDate(d.getDate() + 6);
    return d;
  })();
  const semanaLabel = t.semanaLabel.replace('{desde}', fmtDay(semanaLunes, lang)).replace('{hasta}', fmtDay(semanaFin, lang));
  const compromisosMes = plan.compromisos[mesSel] ?? [];
  const sinEvaluacion = loaded && answers === null && user !== undefined;

  const estatusLabel = (e: Estatus): string =>
    e === 'completada' ? t.completada : e === 'en_progreso' ? t.enProgreso : t.pendiente;

  return (
    <div>
      <div className="flex items-center gap-3">
        <AgentAvatar agente="Babel" size={56} className="shrink-0" />
        <div>
          <h3 id="madurez-plan-title" className="text-xl font-bold text-slate-800">
            {t.title}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>
        </div>
      </div>

      {sinEvaluacion ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {t.sinEvaluacion}
        </div>
      ) : null}

      {/* Scrum semanal */}
      <div id="madurez-scrum" className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-700">{t.scrumTitle}</h4>
            <button
              type="button"
              onClick={() => setSemanaOffset((o) => o - 1)}
              className="glass-panel glass-panel-hover p-1 text-slate-600"
              aria-label="Semana anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[150px] text-center text-sm font-medium text-slate-800">{semanaLabel}</span>
            <button
              type="button"
              onClick={() => setSemanaOffset((o) => o + 1)}
              className="glass-panel glass-panel-hover p-1 text-slate-600"
              aria-label="Semana siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-400">{t.scrumHint}</p>

        <div className="mt-2">
          <label className="mb-1 block text-xs font-medium text-slate-500">{t.accionSemana}</label>
          <select
            value={accionSel}
            onChange={(ev) => fijarAccion(ev.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            {opcionesEfectivas.length > 0 ? (
              opcionesEfectivas.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            ) : (
              <option value="">{t.accionSinOpciones}</option>
            )}
          </select>
          {!accionSel && opcionesAccion.length > 0 ? <p className="mt-1 text-xs text-slate-400">{t.sinAccion}</p> : null}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={nuevaTarea}
            onChange={(ev) => setNuevaTarea(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') agregarTarea();
            }}
            placeholder={t.tareaPlaceholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={agregarTarea}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t.agregarTarea}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              ['todo', t.colTodo],
              ['doing', t.colDoing],
              ['done', t.colDone],
            ] as [TareaEstatus, string][]
          ).map(([estatus, header]) => (
            <div key={estatus} className="glass-panel p-2">
              <p className="px-1 pb-1 text-xs font-semibold text-slate-500">{header}</p>
              <div className="space-y-1.5">
                {tareas
                  .filter((ta) => ta.estatus === estatus)
                  .map((ta) => (
                    <div
                      key={ta.id}
                      onClick={() => moverTarea(ta.id)}
                      title="Clic para mover"
                      className={
                        'flex cursor-pointer items-start justify-between gap-2 px-2 py-1.5 text-xs ' +
                        (ta.estatus === 'done'
                          ? 'rounded-md border border-green-200 bg-green-50 text-green-800 line-through'
                          : 'glass-panel glass-panel-hover text-slate-700')
                      }
                    >
                      <span className="min-w-0">{ta.texto}</span>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          eliminarTarea(ta.id);
                        }}
                        className="shrink-0 text-red-500 hover:text-red-700"
                        aria-label="Eliminar tarea"
                      >
                        x
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Siguiente practica por agente */}
      <div id="madurez-agentes" className="mt-6">
        <h4 className="text-sm font-semibold text-slate-700">{t.agentesTitle}</h4>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {MENTORES.map((mentor) => {
            const sig = siguienteDeAgente(mentor);
            return (
              <div key={mentor} className="glass-panel p-3">
                <div className="flex items-center gap-2">
                  <AgentAvatar agente={mentor} size={24} />
                  <span className={'inline-block rounded-full px-2.5 py-1 text-xs font-medium ' + MENTOR_COLOR[mentor]}>
                    {mentor}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600">                  {sig ? (
                    <>
                      <span className="font-semibold text-slate-800">{temaDe[sig.themeId]}</span> ({LEVEL_LABELS[lang][sig.nivel]}) -{' '}
                      {sig.practica.practica}
                    </>
                  ) : (
                    t.agenteSinPendientes
                  )}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plan mensual */}
      <div id="madurez-mensual" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-700">{t.planMensualTitle}</h4>
            <button
              type="button"
              onClick={() => setMesSel((m) => addMonths(m, -1))}
              className="glass-panel glass-panel-hover p-1 text-slate-600"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[110px] text-center text-sm font-medium text-slate-800">{monthLabel(mesSel, lang)}</span>
            <button
              type="button"
              onClick={() => setMesSel((m) => addMonths(m, 1))}
              className="glass-panel glass-panel-hover p-1 text-slate-600"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => generarMes(mesSel)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            {t.actualizarMes}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">{t.planMensualHint}</p>

        {compromisosMes.length === 0 && MENTORES.every((m) => !siguienteDeAgente(m)) ? (
          <div className="glass-panel mt-2 p-3 text-sm text-slate-500">{t.emptyMes}</div>
        ) : (
          <div className="mt-2 space-y-2">
            {MENTORES.map((mentor) => {
              const comp = compromisosMes.find((c) => c.mentor === mentor);
              return (
                <div
                  key={mentor}
                  className="glass-panel grid items-center gap-2 p-3 sm:grid-cols-[110px_1fr_90px_130px_auto]"
                >
                  <span className="flex w-fit items-center gap-1.5">
                    <AgentAvatar agente={mentor} size={20} />
                    <span className={'inline-block rounded-full px-2.5 py-1 text-xs font-medium ' + MENTOR_COLOR[mentor]}>
                      {mentor}
                    </span>
                  </span>
                  {comp ? (
                    <>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {temaDe[comp.themeId]} - {comp.practica}
                        </p>
                        <p className="text-xs text-slate-500">
                          {t.nivelCol}: {LEVEL_LABELS[lang][comp.nivel]}
                        </p>
                      </div>
                      <select
                        value={comp.estatus}
                        onChange={(ev) => cambiarEstatus(mesSel, comp.id, ev.target.value as Estatus)}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700"
                      >
                        <option value="pendiente">{t.pendiente}</option>
                        <option value="en_progreso">{t.enProgreso}</option>
                        <option value="completada">{t.completada}</option>
                      </select>
                      <span
                        className={
                          'rounded-full px-2.5 py-1 text-xs font-medium ' +
                          (comp.estatus === 'completada'
                            ? 'bg-green-100 text-green-800'
                            : comp.estatus === 'en_progreso'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600')
                        }
                      >
                        {estatusLabel(comp.estatus)}
                      </span>
                      <button
                        type="button"
                        onClick={() => eliminarCompromiso(mesSel, comp.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        {t.eliminar}
                      </button>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">{t.sinCompromiso}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Practicas por tema */}
      <div id="madurez-temas" className="mt-6">
        <h4 className="text-sm font-semibold text-slate-700">{t.temasTitle}</h4>
        <div className="mt-2 space-y-2">
          {DIMENSION_IDS.map((id) => {
            const sig = proximaPractica(id);
            return (
              <div key={id} className="glass-panel flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{temaDe[id]}</p>
                  {sig ? (
                    <p className="mt-0.5 text-xs text-slate-600">
                      {t.siguienteCol}: ({LEVEL_LABELS[lang][sig.nivel]}) {sig.practica.practica}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-green-700">{t.temaCompleto}</p>
                  )}
                </div>
                {sig ? (
                  <button
                    type="button"
                    onClick={() => marcarTemaCompletado(id)}
                    className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                  >
                    {t.marcarCompletada}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">{t.guardado}</p>
      <PageTour pageId="madurez" steps={lang === 'en' ? PASOS_TOUR.en : PASOS_TOUR.es} lang={lang} />
    </div>
  );
}
