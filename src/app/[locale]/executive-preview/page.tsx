'use client';

// Resumen ejecutivo con DATOS REALES del usuario: madurez (último diagnóstico
// en assessments/{uid}/entries + tendencia), avance de Babel (sessions/babel_uid:
// fases aprobadas, fase actual, mensajes) y conteo del plan de acción
// (localStorage babel_plan_accion_v2). Sustituyó al escaparate con datos mock;
// usa los mismos componentes ExecutiveShell + ui/executive del dashboard.
import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import {
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Clock,
  Coins,
  Cog,
  Compass,
  Crown,
  FileCheck2,
  Gauge,
  Globe,
  Handshake,
  Home,
  Landmark,
  LayoutDashboard,
  Medal,
  MessagesSquare,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck2,
  Users,
  Wrench,
} from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { ExecutiveShell, type ExecutiveNavItem } from '@/components/executive-shell';
import {
  BackgroundBlobs,
  DataTable,
  GlassCard,
  MetricCard,
  ProgressRing,
  type CommandPaletteItem,
} from '@/components/ui/executive';
import { babelPhaseTopics } from '@/lib/babel-constants';
import { cn } from '@/lib/utils';
import { DisplayLangProvider, useDisplayLang } from '@/components/display-lang-provider';
import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';
import AgentAvatar from '@/components/agentes/AgentAvatar';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { useUserRoles } from '@/lib/use-user-roles';
import { getMaturityDimensions } from '@/lib/maturity-dimensions';
import { computeResults, type AssessmentResult, type DimensionAnswers } from '@/lib/maturity-scoring';
import { getAssessmentHistory, getLatestAssessmentAnswers, type AssessmentHistoryPoint } from '@/lib/assessment';
import { getBabelSessionIfExists } from '@/lib/babel-session';
import type { BabelPhaseRecord, MaturityLevel, SessionDoc, UserDoc } from '@/types/firestore';
import type { FinancialGoalsInput, FinancialGoalsResult } from '@/lib/deliverables';
import { MISIONES_PART_LABELS, SUBMUNDOS_ESTRATEGIA_LABELS, nivelLabelPuntos } from '@/lib/worlds';

type PhaseStatus = 'completado' | 'en_progreso' | 'pendiente';

interface PhaseRow {
  id: string;
  phase: number;
  topic: string;
  status: PhaseStatus;
  approvedAt: string | null;
  deliverables: string[];
}

const NAV_ICON_MAP = { Home, LayoutDashboard, Globe, Medal, Wrench, Crown, Compass, ShieldCheck, UserCheck2, Coins, Handshake, Scale, Cog, Landmark };

const STATUS_CLASS: Record<PhaseStatus, string> = {
  completado: 'text-success',
  en_progreso: 'text-warning',
  pendiente: 'text-muted-foreground',
};

const STATUS_ICON: Record<PhaseStatus, React.ComponentType<{ className?: string; strokeWidth?: number | string }>> = {
  completado: CheckCircle2,
  en_progreso: Clock,
  pendiente: CircleDashed,
};

const MATURITY_LEVEL_LABEL: Record<MaturityLevel, [string, string]> = {
  execution: ['Ejecución', 'Execution'],
  standard: ['Estándar', 'Standard'],
  control: ['Control', 'Control'],
  optimization: ['Optimización', 'Optimization'],
  excellence: ['Excelencia', 'Excellence'],
  influencer: ['Influencer', 'Influencer'],
};

const PLAN_STORAGE_KEY = 'babel_plan_accion_v2';
const FIN_GOALS_LAST_KEY = 'babel_financial_goals_v1';

function TopicCell({ topic }: { topic: string }) {
  return <span className="font-medium text-foreground">{topic}</span>;
}

function StatusCell({ status }: { status: PhaseStatus }) {
  const { lang } = useDisplayLang();
  const labels: Record<PhaseStatus, string> = {
    completado: lang === 'en' ? 'Completed' : 'Completado',
    en_progreso: lang === 'en' ? 'In progress' : 'En progreso',
    pendiente: lang === 'en' ? 'Pending' : 'Pendiente',
  };
  const Icon = STATUS_ICON[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', STATUS_CLASS[status])}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {labels[status]}
    </span>
  );
}

const phaseColumns: ColumnDef<PhaseRow>[] = [
  {
    id: 'topic',
    header: 'Fase',
    accessorFn: (row) => row.topic,
    cell: ({ row }) => <TopicCell topic={row.original.topic} />,
  },
  {
    id: 'status',
    header: 'Estado',
    accessorFn: (row) => row.status,
    cell: ({ row }) => <StatusCell status={row.original.status} />,
  },
  {
    id: 'approvedAt',
    header: 'Aprobada el',
    accessorFn: (row) => row.approvedAt ?? '',
  },
];

/** Extrae los títulos `### `/`## ` del resumen aprobado como entregables. */
function extractDeliverables(summary: string, lang: 'es' | 'en'): string[] {
  const headings = summary
    .split('\n')
    .map((line) => line.trim().match(/^#{2,3}\s+(.+)$/)?.[1])
    .filter((h): h is string => Boolean(h))
    .map((h) => h.replace(/\*\*/g, '').trim())
    .filter((h) => h.length > 0);
  if (headings.length > 0) return Array.from(new Set(headings)).slice(0, 6);
  const firstLine = summary.split('\n').map((l) => l.trim()).find((l) => l.length > 0);
  return firstLine ? [firstLine.slice(0, 80)] : [lang === 'en' ? 'Approved summary' : 'Resumen aprobado'];
}

function formatDate(ts: Timestamp | undefined, locale: string): string | null {
  if (!ts) return null;
  const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts as unknown as string);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ExecutivePreviewPage() {
  const params = useParams<{ locale: string }>();
  const routeLocale = params?.locale ?? 'es';
  return (
    <DisplayLangProvider initialLang={routeLocale as 'es' | 'en'}>
      <ExecutivePreviewContent routeLocale={routeLocale} />
    </DisplayLangProvider>
  );
}

function ExecutivePreviewContent({ routeLocale }: { routeLocale: string }) {
  const router = useRouter();
  const { lang } = useDisplayLang();
  const { administracion: administracionRol, especialista: especialistaRol } = useUserRoles();

  const t = (es: string, en: string) => (lang === 'en' ? en : es);
  const locale = lang === 'en' ? 'en' : 'es';

  const pasosTour: TourStep[] = [
    {
      selector: '#resumen-titulo',
      title: t('Resumen ejecutivo', 'Executive Summary'),
      description: t(
        'Vista general de tu avance: madurez, fases aprobadas y conversaciones con Babel.',
        'Overview of your progress: maturity, approved phases and conversations with Babel.'
      ),
    },
    {
      selector: '#resumen-metricas',
      title: t('Métricas clave', 'Key metrics'),
      description: t(
        'Tu madurez global, la fase actual, las fases aprobadas y los mensajes intercambiados con Babel.',
        'Your overall maturity, current phase, approved phases and messages exchanged with Babel.'
      ),
    },
    {
      selector: '#resumen-mundos',
      title: t('Avance por mundo', 'Progress by world'),
      description: t(
        'El estado de cada mundo de MBE: misiones completadas, puntos ganados por mundo e insignias obtenidas.',
        'The state of each MBE world: completed missions, points earned per world and badges earned.'
      ),
    },
    {
      selector: '#resumen-insignias',
      title: t('Mis insignias', 'My badges'),
      description: t(
        'Logros desbloqueados por tus avances: misiones, madurez, plan de acción y comunidad.',
        'Achievements unlocked by your progress: missions, maturity, action plan and community.'
      ),
    },
    {
      selector: '#resumen-fases',
      title: t('Avance por fase', 'Progress by phase'),
      description: t(
        'Las 5 fases del diagnóstico Babel y su estado. La tabla debajo muestra entregables de cada fase.',
        'The 5 phases of the Babel diagnostic and their status. The table below shows deliverables per phase.'
      ),
    },
    {
      selector: '#resumen-madurez',
      title: t('Diagnóstico de madurez', 'Maturity assessment'),
      description: t(
        'Puntaje por tema y tus fortalezas y áreas de oportunidad para priorizar mejoras.',
        'Score per topic plus your strengths and areas of opportunity to prioritize improvements.'
      ),
    },
    {
      selector: '#resumen-plan',
      title: t('Tu plan de negocio', 'Your business plan'),
      description: t(
        'Resumen de tu plan, fases aprobadas y plan de acción, con accesos directos para editarlos.',
        'Summary of your plan, approved phases and action plan, with shortcuts to edit them.'
      ),
    },
  ];

  // Misiones comunes de los mundos premium: Apoyo de Especialistas y Plan de Acción.
  const premiumMisiones = () => [
    { href: `/${routeLocale}/agendar`, label: t('Misión 1: Apoyo de Especialistas', 'Mission 1: Specialist Support') },
    { href: `/${routeLocale}/babel/plan-accion`, label: t('Misión de Plan de Acción', 'Action Plan Mission') },
  ];

  const navItems: ExecutiveNavItem[] = [
    { href: `/${routeLocale}/inicio`, label: t('Inicio', 'Home'), icon: NAV_ICON_MAP.Home },
    { href: `/${routeLocale}/executive-preview`, label: t('Resumen ejecutivo', 'Executive Summary'), icon: NAV_ICON_MAP.LayoutDashboard },
    {
      href: `/${routeLocale}/worlds/partida`,
      label: t('Mundo de Partida', 'Starting World'),
      icon: NAV_ICON_MAP.Globe,
      children: MISIONES_PART_LABELS.map((m) => ({
        href: `/${routeLocale}${m.ruta}`,
        label: t(`Misión ${m.n}: ${m.es}`, `Mission ${m.n}: ${m.en}`),
      })),
    },
    { href: `/${routeLocale}/babel/madurez`, label: t('Mundo de Retos', 'Challenges World'), icon: NAV_ICON_MAP.Medal },
    {
      label: t('Toolbox', 'Toolbox'),
      icon: NAV_ICON_MAP.Wrench,
      titleOnly: true,
      children: [
        { href: `/${routeLocale}/babel/convocatorias`, label: t('Convocatorias y fondos', 'Calls & Grants') },
        { href: `/${routeLocale}/refplace`, label: t('Reference Place', 'Reference Place') },
        { href: `/${routeLocale}/club`, label: t('Juntas de Mentoría', 'Mentoring Meetings') },
      ],
    },
    {
      label: t('Mundos Premium', 'Premium Worlds'),
      icon: NAV_ICON_MAP.Crown,
      titleOnly: true,
      children: [
        {
          href: `/${routeLocale}/worlds?v=estrategia`,
          label: t('Mundo de la Estrategia', 'Strategy World'),
          icon: NAV_ICON_MAP.Compass,
          children: [
            ...SUBMUNDOS_ESTRATEGIA_LABELS.map((m) => ({
              href: `/${routeLocale}${m.ruta}`,
              label: t(`Misión ${m.n}: ${m.es}`, `Mission ${m.n}: ${m.en}`),
            })),
            { href: `/${routeLocale}/agendar`, label: t('Misión 7: Apoyo de Especialistas', 'Mission 7: Specialist Support') },
          ],
        },
        { href: `/${routeLocale}/worlds?v=dinero`, label: t('Mundo del Dinero', 'Money World'), icon: NAV_ICON_MAP.Coins, children: premiumMisiones() },
        { href: `/${routeLocale}/worlds?v=cliente`, label: t('Mundo del Cliente', 'Customer World'), icon: NAV_ICON_MAP.Handshake, children: premiumMisiones() },
        { href: `/${routeLocale}/worlds?v=normativo`, label: t('Mundo Normativo', 'Compliance World'), icon: NAV_ICON_MAP.Scale, children: premiumMisiones() },
        { href: `/${routeLocale}/worlds?v=operativo`, label: t('Mundo Operativo', 'Operations World'), icon: NAV_ICON_MAP.Cog, children: premiumMisiones() },
        { href: `/${routeLocale}/worlds?v=cultura`, label: t('Mundo de la Cultura', 'Culture World'), icon: NAV_ICON_MAP.Landmark, children: premiumMisiones() },
      ],
    },
  ];
  if (administracionRol) {
    navItems.push({ href: `/${routeLocale}/admin`, label: t('Administración', 'Administration'), icon: NAV_ICON_MAP.ShieldCheck });
  }
  if (especialistaRol) {
    navItems.push({ href: `/${routeLocale}/especialista`, label: t('Panel de Mentor', 'Mentor Panel'), icon: NAV_ICON_MAP.UserCheck2 });
  }

  const [user, setUser] = React.useState<User | null | undefined>(undefined);
  const [answers, setAnswers] = React.useState<DimensionAnswers | null>(null);
  const [history, setHistory] = React.useState<AssessmentHistoryPoint[]>([]);
  const [userDoc, setUserDoc] = React.useState<UserDoc | null>(null);
  const [sessionDoc, setSessionDoc] = React.useState<SessionDoc | null>(null);
  const [planCounts, setPlanCounts] = React.useState<{ objetivos: number; acciones: number; entornos: number; convocatorias: number; metasFinancieras: number } | null>(null);
  const [finGoals, setFinGoals] = React.useState<{ input: FinancialGoalsInput; result: FinancialGoalsResult; savedAt: string } | null>(null);
  const [worldsYo, setWorldsYo] = React.useState<{ puntos: number; nivel: string; partida: number[]; tablero: boolean } | null>(null);
  const [madurezPlan, setMadurezPlan] = React.useState<{ cumplidas: number; compromisosMes: number } | null>(null);
  const [orgRoles, setOrgRoles] = React.useState(0);

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
        const [latestAnswers, historyData, userSnap, session] = await Promise.all([
          getLatestAssessmentAnswers(user.uid),
          getAssessmentHistory(user.uid),
          getDoc(doc(getFirebaseDb(), 'users', user.uid)),
          getBabelSessionIfExists(user.uid),
        ]);
        if (cancelled) return;
        setAnswers(latestAnswers);
        setHistory(historyData);
        setUserDoc(userSnap.exists() ? (userSnap.data() as UserDoc) : null);
        setSessionDoc(session);
      } catch (err) {
        console.error('[MBE ExecutivePreview] failed to load data', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const result: AssessmentResult | null = React.useMemo(
    () => (answers ? computeResults(getMaturityDimensions(locale), answers) : null),
    [answers, locale]
  );

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PLAN_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setPlanCounts({
        objetivos: Array.isArray(parsed.objetivos) ? parsed.objetivos.length : 0,
        acciones: Array.isArray(parsed.acciones) ? parsed.acciones.length : 0,
        entornos: Array.isArray(parsed.entornos) ? parsed.entornos.length : 0,
        convocatorias: Array.isArray(parsed.convocatorias) ? parsed.convocatorias.length : 0,
        metasFinancieras: Array.isArray(parsed.fds) ? parsed.fds.length : 0,
      });
    } catch (err) {
      console.error('[MBE ExecutivePreview] failed to read plan from localStorage', err);
    }
  }, []);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FIN_GOALS_LAST_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.input && parsed.result) setFinGoals(parsed);
    } catch (err) {
      console.error('[MBE ExecutivePreview] failed to read financial goals from localStorage', err);
    }
  }, []);

  // Progreso de mundos: /api/worlds (users/{uid}.worlds.partida + puntosClub).
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/worlds', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (cancelled) return;
        if (data?.yo) {
          setWorldsYo({
            puntos: Number(data.yo.puntos ?? 0),
            nivel: String(data.yo.nivel ?? ''),
            partida: Array.isArray(data.yo.partida) ? data.yo.partida.map(Number) : [],
            tablero: data.yo.tablero === true,
          });
        }
      } catch (err) {
        console.error('[MBE ExecutivePreview] failed to load worlds progress', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Plan de madurez (Mundo de Retos): prácticas completadas del mes actual.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem('babel_madurez_plan_v1');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      let cumplidas = 0;
      if (parsed && typeof parsed.completados === 'object' && parsed.completados !== null) {
        cumplidas = Object.values(parsed.completados).reduce((acc: number, v) => acc + Number(v ?? 0), 0);
      }
      const mesActual = new Date().toISOString().slice(0, 7);
      const compromisosMes = Array.isArray(parsed?.compromisos?.[mesActual]) ? parsed.compromisos[mesActual].length : 0;
      setMadurezPlan({ cumplidas, compromisosMes });
    } catch (err) {
      console.error('[MBE ExecutivePreview] failed to read maturity plan', err);
    }
  }, []);

  // Organigrama guardado (localStorage) para la Misión 5 de Estrategia.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem('babel_orgchart_v1');
      const parsed = raw ? JSON.parse(raw) : null;
      setOrgRoles(Array.isArray(parsed?.roles) ? parsed.roles.length : 0);
    } catch (err) {
      console.error('[MBE ExecutivePreview] failed to read org chart', err);
    }
  }, []);

  const phaseTopics = babelPhaseTopics(locale);
  const approvedPhases: BabelPhaseRecord[] = [...(sessionDoc?.phases ?? [])]
    .filter((p) => p.phase >= 0 && p.phase <= 4)
    .sort((a, b) => a.phase - b.phase);
  const currentPhase = Math.min(Math.max(sessionDoc?.currentPhase ?? 0, 0), 5);
  const approvedCount = approvedPhases.length;
  const messageCount = sessionDoc?.messages?.length ?? 0;
  const allPhasesDone = currentPhase >= 5;

  const PHASE_ROWS: PhaseRow[] = phaseTopics.map((topic, phase) => {
    const record = approvedPhases.find((p) => p.phase === phase);
    const status: PhaseStatus = record ? 'completado' : phase === currentPhase ? 'en_progreso' : 'pendiente';
    return {
      id: `fase-${phase}`,
      phase,
      topic,
      status,
      approvedAt: formatDate(record?.approvedAt, locale),
      deliverables: record ? extractDeliverables(record.summary, locale) : [],
    };
  });

  const maturityTrend = [...history].reverse().slice(-7).map((h) => h.totalScore);
  const maturityDelta =
    history.length >= 2 ? Math.round((history[0].totalScore - history[1].totalScore) * 10) / 10 : undefined;
  const approvalsTrend = approvedPhases
    .slice()
    .sort((a, b) => (a.approvedAt?.toMillis?.() ?? 0) - (b.approvedAt?.toMillis?.() ?? 0))
    .map((_, i) => i + 1);

  // ── Avance por mundo ─────────────────────────────────────────────
  const partidaHechas = new Set((worldsYo?.partida ?? []).map(Number));
  const partidaPts = MISIONES_PART_LABELS.reduce((acc, m) => acc + (partidaHechas.has(m.n) ? m.pts : 0), 0);
  const partidaTotalPts = MISIONES_PART_LABELS.reduce((acc, m) => acc + m.pts, 0);
  const mundoPartidaCompleto = partidaHechas.size >= MISIONES_PART_LABELS.length;

  const faseAprobada = (n: number) => approvedPhases.some((p) => p.phase === n);
  const mE0 = faseAprobada(0);
  const mE1 = faseAprobada(1);
  const mE2 = faseAprobada(2);
  const mE3 = faseAprobada(3);
  const mE4 = faseAprobada(4);
  const mE5 = orgRoles > 0;
  const mE6 = (planCounts?.acciones ?? 0) > 0;
  const estrategiaHechas = [mE0, mE1, mE2, mE3, mE4, mE5, mE6].filter(Boolean).length;
  const estrategiaPts = estrategiaHechas * 25;
  const estrategiaTotalPts = SUBMUNDOS_ESTRATEGIA_LABELS.length * 25;
  const retosNivel = result ? MATURITY_LEVEL_LABEL[result.overallLevel][0] : '—';

  const insignias = React.useMemo(() => {
    const arr: { id: string; icono: string; titulo: [string, string]; desc: [string, string]; earned: boolean }[] = [
      { id: 'primerPaso', icono: '🎓', titulo: ['Primer paso', 'First step'], desc: ['Completa la Misión 1 del Mundo de Partida', 'Complete Starting World Mission 1'], earned: partidaHechas.has(1) },
      { id: 'tablero', icono: '🎯', titulo: ['Tablero de retos', 'Challenges board'], desc: ['Completa la Misión 2 del Mundo de Partida', 'Complete Starting World Mission 2'], earned: worldsYo?.tablero === true },
      { id: 'partidaCompleta', icono: '🗺️', titulo: ['Partida completada', 'Starting World complete'], desc: [`Completa las ${MISIONES_PART_LABELS.length} misiones del Mundo de Partida`, `Complete all ${MISIONES_PART_LABELS.length} Starting World missions`], earned: mundoPartidaCompleto },
      { id: 'reevaluado', icono: '🔄', titulo: ['Reevaluado', 'Re-evaluated'], desc: ['Repite tu evaluación de madurez', 'Repeat your maturity assessment'], earned: history.length >= 2 },
      { id: 'rumbo60', icono: '🧭', titulo: ['Rumbo firme', 'Steady course'], desc: ['Alcanza 60 puntos de madurez global', 'Reach 60 overall maturity points'], earned: (result?.overallScore ?? 0) >= 60 },
      { id: 'influencer', icono: '👑', titulo: ['Influencer', 'Influencer'], desc: ['Alcanza 90 puntos de madurez global', 'Reach 90 overall maturity points'], earned: (result?.overallScore ?? 0) >= 90 },
      { id: 'calibrado', icono: '⭐', titulo: ['Calibrado', 'Calibrated'], desc: ['Completa la Misión 0 de Estrategia (Calibración)', 'Complete Strategy Mission 0 (Calibration)'], earned: mE0 },
      { id: 'proposito', icono: '🧭', titulo: ['Estratega', 'Strategist'], desc: ['Completa la Misión 1 de Estrategia (Propósito)', 'Complete Strategy Mission 1 (Purpose)'], earned: mE1 },
      { id: 'entorno', icono: '🌐', titulo: ['Observador', 'Observer'], desc: ['Completa la Misión 2 de Estrategia (El Entorno)', 'Complete Strategy Mission 2 (The Environment)'], earned: mE2 },
      { id: 'capacidades', icono: '💪', titulo: ['Autoconocimiento', 'Self-awareness'], desc: ['Completa la Misión 3 de Estrategia (Mis Capacidades)', 'Complete Strategy Mission 3 (My Capabilities)'], earned: mE3 },
      { id: 'enfoque', icono: '🎯', titulo: ['Foco', 'Focus'], desc: ['Completa la Misión 4 de Estrategia (El Enfoque)', 'Complete Strategy Mission 4 (Strategic Focus)'], earned: mE4 },
      { id: 'organigrama', icono: '🏢', titulo: ['Organizador', 'Organizer'], desc: ['Completa la Misión 5 de Estrategia (Organigrama y Roles)', 'Complete Strategy Mission 5 (Org Chart & Roles)'], earned: mE5 },
      { id: 'planMaestro', icono: '📋', titulo: ['Plan maestro', 'Master plan'], desc: ['Completa la Misión 6 de Estrategia (Plan de Acción)', 'Complete Strategy Mission 6 (Action Plan)'], earned: mE6 },
      { id: 'reto', icono: '🏅', titulo: ['Primer reto', 'First challenge'], desc: ['Completa una práctica de tu plan de madurez', 'Complete a practice in your maturity plan'], earned: (madurezPlan?.cumplidas ?? 0) > 0 },
      { id: 'clubero', icono: '🤝', titulo: ['Miembro del club', 'Club member'], desc: ['Consigue tus primeros puntos', 'Earn your first points'], earned: (worldsYo?.puntos ?? 0) > 0 },
      { id: 'orquesta', icono: '🎻', titulo: ['Empresario Orquesta', 'Orchestra Business Owner'], desc: ['Alcanza 500 puntos', 'Reach 500 points'], earned: (worldsYo?.puntos ?? 0) >= 500 },
    ];
    return arr;
  }, [partidaHechas, worldsYo, mundoPartidaCompleto, history.length, result, mE0, mE1, mE2, mE3, mE4, mE5, mE6, madurezPlan]);
  const insigniasGanadas = insignias.filter((b) => b.earned).length;

  const commandItems: CommandPaletteItem[] = [
    ...PHASE_ROWS.map((row) => ({
      id: row.id,
      label: row.topic,
      group: t('Fases Babel', 'Babel Phases'),
      onSelect: () => {},
    })),
    {
      id: 'go-babel',
      label: t('Ir a Babel AI', 'Go to Babel AI'),
      group: t('Navegación', 'Navigation'),
      onSelect: () => router.push(`/${routeLocale}/babel`),
    },
    {
      id: 'go-dashboard',
      label: t('Ir al dashboard', 'Go to dashboard'),
      group: t('Navegación', 'Navigation'),
      onSelect: () => router.push(`/${routeLocale}/dashboard`),
    },
    {
      id: 'go-plan',
      label: t('Ir al plan de acción', 'Go to action plan'),
      group: t('Navegación', 'Navigation'),
      onSelect: () => router.push(`/${routeLocale}/babel/plan-accion`),
    },
  ];

  if (user === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('Cargando...', 'Loading...')}</p>
      </main>
    );
  }

  if (user === null) {
    return (
      <ExecutiveShell navItems={navItems} commandItems={commandItems} brandLabel="MBE Corpilot AI" logoSrc="/logo-mbe.png">
        <BackgroundBlobs />
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <GlassCard className="animate-fade-in">
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {t('Resumen ejecutivo', 'Executive Summary')}
              </h1>
              <p className="max-w-md text-sm text-muted-foreground">
                {t(
                  'Inicia sesión para ver tu resumen ejecutivo con datos reales: madurez, avance de Babel y plan de acción.',
                  'Sign in to see your executive summary with real data: maturity, Babel progress and action plan.'
                )}
              </p>
              <button
                type="button"
                onClick={() => router.push(`/${routeLocale}`)}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {t('Iniciar sesión', 'Sign in')}
              </button>
            </div>
          </GlassCard>
        </div>
      </ExecutiveShell>
    );
  }

  const strengths = result
    ? [...result.dimensions].sort((a, b) => b.score - a.score).slice(0, 3)
    : [];
  const opportunities = result
    ? [...result.dimensions].sort((a, b) => a.score - b.score).slice(0, 3)
    : [];

  const subscriptionLabel = (() => {
    const s = userDoc?.subscription;
    if (s === 'pro' || s === 'active' || s === 'premium') return t('Plan Pro', 'Pro plan');
    if (s === 'cancelled') return t('Plan cancelado', 'Cancelled plan');
    return t('Plan gratuito', 'Free plan');
  })();

  const fmtMoney = (v: number | undefined) => '$' + (v ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const finGoalsDateLabel = finGoals
    ? (() => {
        try {
          return new Date(finGoals.savedAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch {
          return '';
        }
      })()
    : '';

  return (
    <ExecutiveShell navItems={navItems} commandItems={commandItems} brandLabel="MBE Corpilot AI" logoSrc="/logo-mbe.png">
      <BackgroundBlobs />
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div id="resumen-titulo" className="animate-fade-in">
          <div className="flex items-center gap-3">
            <AgentAvatar size={56} className="shrink-0" />
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {t('Resumen ejecutivo', 'Executive Summary')}
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {userDoc?.name
              ? t(
                  `Hola ${userDoc.name}. Resumen de tu avance en MBE Corpilot AI.`,
                  `Hi ${userDoc.name}. Summary of your progress in MBE Corpilot AI.`
                )
              : t(
                  'Resumen de tu avance en MBE Corpilot AI.',
                  'Summary of your progress in MBE Corpilot AI.'
                )}
          </p>
        </div>

        <div id="resumen-metricas" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            className="animate-slide-up"
            style={{ animationDelay: '0ms' }}
            label={t('Madurez global', 'Overall maturity')}
            value={result ? Math.round(result.overallScore) : '—'}
            unit="/120"
            delta={result && maturityDelta !== undefined ? maturityDelta : undefined}
            deltaLabel={t('vs. diagnóstico anterior', 'vs. previous assessment')}
            trend={maturityTrend.length > 1 ? maturityTrend : undefined}
            icon={Gauge}
            variant={result && result.overallScore >= 60 ? 'success' : 'default'}
          />
          <MetricCard
            className="animate-slide-up"
            style={{ animationDelay: '60ms' }}
            label={t('Fase actual', 'Current phase')}
            value={`${t('Fase', 'Phase')} ${currentPhase}`}
            unit={
              currentPhase < 5
                ? phaseTopics[currentPhase]?.split(':')[1]?.trim()
                : t('completado', 'completed')
            }
            icon={Sparkles}
            variant="default"
          />
          <MetricCard
            className="animate-slide-up"
            style={{ animationDelay: '120ms' }}
            label={t('Fases aprobadas', 'Approved phases')}
            value={approvedCount}
            unit={`/5`}
            trend={approvalsTrend.length > 1 ? approvalsTrend : undefined}
            icon={FileCheck2}
            variant={allPhasesDone ? 'success' : 'default'}
          />
          <MetricCard
            className="animate-slide-up"
            style={{ animationDelay: '180ms' }}
            label={t('Mensajes con Babel', 'Messages with Babel')}
            value={messageCount}
            unit={t('mensajes', 'messages')}
            icon={MessagesSquare}
            variant="default"
          />
        </div>

        <div id="resumen-mundos" className="animate-slide-up" style={{ animationDelay: '220ms' }}>
          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{t('Avance por mundo', 'Progress by world')}</h2>
                <p className="text-xs text-muted-foreground">
                  {t(
                    'Misiones completadas, puntos e insignias de cada mundo.',
                    'Completed missions, points and badges of each world.'
                  )}
                </p>
              </div>
              <Globe className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg">🎓</span>
                  <h3 className="flex-1 text-sm font-semibold text-foreground">{t('Mundo de Partida', 'Starting World')}</h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {partidaPts}/{partidaTotalPts} {t('pts', 'pts')}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {MISIONES_PART_LABELS.map((m) => {
                    const done = partidaHechas.has(m.n);
                    return (
                      <li key={m.n} className="flex items-center gap-2 text-sm">
                        <span className="shrink-0">{done ? '✅' : '⭕'}</span>
                        <span className={cn('truncate', done ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                          {t(`Misión ${m.n}: ${m.es}`, `Mission ${m.n}: ${m.en}`)}
                        </span>
                        <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          +{m.pts}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={() => router.push(`/${routeLocale}/worlds/partida`)}
                  className="mt-3 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/60"
                >
                  {t('Ir al Mundo de Partida', 'Go to the Starting World')}
                </button>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg">👑</span>
                  <h3 className="flex-1 text-sm font-semibold text-foreground">{t('Mundo de la Estrategia', 'Strategy World')}</h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {estrategiaPts}/{estrategiaTotalPts} {t('pts', 'pts')}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {SUBMUNDOS_ESTRATEGIA_LABELS.map((m) => {
                    const done = [mE0, mE1, mE2, mE3, mE4, mE5, mE6][m.n] === true;
                    return (
                      <li key={m.n} className="flex items-center gap-2 text-sm">
                        <span className="shrink-0">{done ? '✅' : '⭕'}</span>
                        <span className={cn('truncate', done ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                          {t(`Misión ${m.n}: ${m.es}`, `Mission ${m.n}: ${m.en}`)}
                        </span>
                        <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          +{m.pts}
                        </span>
                      </li>
                    );
                  })}
                  <li className="flex items-center gap-2 text-sm">
                    <span className="shrink-0">👩‍💼</span>
                    <span className="truncate text-muted-foreground">
                      {t('Misión 7: Apoyo de Especialistas', 'Mission 7: Specialist Support')}
                    </span>
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => router.push(`/${routeLocale}/worlds?v=estrategia`)}
                  className="mt-3 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/60"
                >
                  {t('Ir al Mundo de la Estrategia', 'Go to the Strategy World')}
                </button>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg">🥇</span>
                  <h3 className="flex-1 text-sm font-semibold text-foreground">{t('Mundo de Retos', 'Challenges World')}</h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {retosNivel}
                  </span>
                </div>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="shrink-0">{result ? '✅' : '⭕'}</span>
                    <span className={cn('truncate', result ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                      {t('Diagnóstico de madurez', 'Maturity assessment')}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                      {result ? `${Math.round(result.overallScore)}/120` : '—'}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="shrink-0">{result ? '✅' : '⭕'}</span>
                    <span className={cn('truncate', result ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                      {t('Nivel global', 'Overall level')}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                      {result ? MATURITY_LEVEL_LABEL[result.overallLevel][0] : '—'}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="shrink-0">📈</span>
                    <span className="truncate text-muted-foreground">{t('Prácticas completadas', 'Completed practices')}</span>
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">{madurezPlan?.cumplidas ?? 0}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="shrink-0">🔄</span>
                    <span className="truncate text-muted-foreground">{t('Reevaluaciones', 'Re-assessments')}</span>
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">{Math.max(history.length - 1, 0)}</span>
                  </li>
                </ul>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {insignias.filter((b) => ['reevaluado', 'rumbo60', 'influencer', 'reto'].includes(b.id) && b.earned).map((b) => (
                    <span key={b.id} className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-900/30 dark:text-teal-200">
                      {b.icono} {t(b.titulo[0], b.titulo[1])}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/${routeLocale}/babel/madurez`)}
                  className="mt-3 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/60"
                >
                  {t('Ir al Mundo de Retos', 'Go to the Challenges World')}
                </button>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg">🧰</span>
                  <h3 className="flex-1 text-sm font-semibold text-foreground">{t('Toolbox', 'Toolbox')}</h3>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {worldsYo?.puntos ?? 0} {t('pts', 'pts')}
                  </span>
                </div>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="shrink-0">🎪</span>
                    <span className="flex-1 truncate text-muted-foreground">{t('Nivel de comunidad', 'Community level')}</span>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
                      {worldsYo?.nivel ? nivelLabelPuntos(worldsYo.nivel, locale) : '—'}
                    </span>
                  </li>
                  {[
                    { href: '/babel/convocatorias', label: t('Convocatorias y fondos', 'Calls & Grants') },
                    { href: '/refplace', label: t('Reference Place', 'Reference Place') },
                    { href: '/club', label: t('Juntas de Mentoría', 'Mentoring Meetings') },
                  ].map((tool) => (
                    <li key={tool.href}>
                      <button
                        type="button"
                        onClick={() => router.push(`/${routeLocale}${tool.href}`)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <span className="shrink-0">▸</span>
                        <span className="flex-1 truncate">{tool.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {insignias.filter((b) => ['clubero', 'orquesta'].includes(b.id) && b.earned).map((b) => (
                    <span key={b.id} className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-900/30 dark:text-teal-200">
                      {b.icono} {t(b.titulo[0], b.titulo[1])}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        <GlassCard id="resumen-insignias" className="animate-slide-up" style={{ animationDelay: '260ms' }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('Mis insignias', 'My badges')}</h2>
              <p className="text-xs text-muted-foreground">
                {t(
                  `Logros desbloqueados por tus avances. Tienes ${insigniasGanadas} de ${insignias.length}.`,
                  `Achievements unlocked by your progress. You have ${insigniasGanadas} of ${insignias.length}.`
                )}
              </p>
            </div>
            <Medal className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {insignias.map((b) => (
              <div
                key={b.id}
                className={cn(
                  'rounded-xl border p-3 text-center',
                  b.earned
                    ? 'border-teal-200/70 bg-teal-50/60 dark:border-teal-800/50 dark:bg-teal-900/20'
                    : 'border-border/60 bg-background/40 opacity-60'
                )}
              >
                <div className="text-2xl">{b.earned ? b.icono : '🔒'}</div>
                <p className={cn('mt-1 text-xs font-bold', b.earned ? 'text-teal-700 dark:text-teal-200' : 'text-muted-foreground')}>
                  {t(b.titulo[0], b.titulo[1])}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{t(b.desc[0], b.desc[1])}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        {finGoals ? (
          <GlassCard className="animate-slide-up" style={{ animationDelay: '220ms' }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t('Objetivos financieros', 'Financial goals')}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t(
                    'Metas de tu punto de equilibrio y proyección (última versión guardada).',
                    'Break-even and projection goals (last saved version).'
                  )}
                </p>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label={t('Utilidad deseada', 'Desired profit')}
                value={fmtMoney(finGoals.input.desiredProfit)}
                icon={TrendingUp}
                variant="default"
              />
              <MetricCard
                label={t('Punto de equilibrio', 'Break-even point')}
                value={fmtMoney(finGoals.result.breakEvenWithMarketing)}
                icon={TrendingUp}
                variant="default"
              />
              <MetricCard
                label={t('Ingreso meta', 'Goal revenue')}
                value={fmtMoney(finGoals.result.targetRevenueWithMarketing)}
                icon={TrendingUp}
                variant="success"
              />
              <MetricCard
                label={t('% Costos variables', '% Variable costs')}
                value={((finGoals.result.totalVariablePctWithMarketing ?? 0) * 100).toFixed(1).replace('.', ',')}
                unit="%"
                icon={TrendingUp}
                variant="default"
              />
            </div>
            {finGoalsDateLabel ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {t('Última actualización', 'Last updated')}: {finGoalsDateLabel}
              </p>
            ) : null}
          </GlassCard>
        ) : null}

        <GlassCard id="resumen-fases" className="animate-slide-up" style={{ animationDelay: '260ms' }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('Avance por fase', 'Progress by phase')}</h2>
              <p className="text-xs text-muted-foreground">{t('5 fases del diagnóstico Babel (0 a 4)', '5 phases of the Babel diagnostic (0 to 4)')}</p>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {PHASE_ROWS.map((row) => (
              <div key={row.id} className="flex flex-col items-center gap-2">
                <ProgressRing
                  value={row.status === 'completado' ? 100 : row.status === 'en_progreso' ? 55 : 0}
                  size={72}
                  thickness={6}
                  variant={
                    row.status === 'completado' ? 'success' : row.status === 'en_progreso' ? 'warning' : 'default'
                  }
                  label={`${t('Fase', 'Phase')} ${row.phase}`}
                />
                <span className="max-w-[7.5rem] text-center text-[11px] leading-tight text-muted-foreground">
                  {row.topic.split(':')[1]?.trim() ?? row.topic}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="animate-slide-up" style={{ animationDelay: '300ms' }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{t('Detalle de fases', 'Phase details')}</h2>
          </div>
          <DataTable<PhaseRow>
            columns={phaseColumns.map((col) => {
              if (col.id === 'topic') return { ...col, header: t('Fase', 'Phase') };
              if (col.id === 'status') return { ...col, header: t('Estado', 'Status') };
              if (col.id === 'approvedAt') return { ...col, header: t('Aprobada el', 'Approved on') };
              return col;
            })}
            data={PHASE_ROWS}
            enableExport
            exportFileName={t('babel-fases', 'babel-phases')}
            exportLabel={t('Exportar CSV', 'Export CSV')}
            emptyMessage={t('Sin fases registradas.', 'No phases registered.')}
            expandLabel={t('Expandir fila', 'Expand row')}
            collapseLabel={t('Contraer fila', 'Collapse row')}
            renderSubRow={(row) => (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">{t('Entregables:', 'Deliverables:')}</span>
                {row.deliverables.length > 0 ? (
                  row.deliverables.map((d) => (
                    <span
                      key={d}
                      className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-foreground"
                    >
                      {d}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t('Aún no hay entregables en esta fase.', 'No deliverables yet in this phase.')}
                  </span>
                )}
              </div>
            )}
          />
        </div>

        <GlassCard id="resumen-madurez" className="animate-slide-up" style={{ animationDelay: '340ms' }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('Diagnóstico de madurez', 'Maturity assessment')}</h2>
              <p className="text-xs text-muted-foreground">
                {result
                  ? t(
                      `Tu nivel general es ${MATURITY_LEVEL_LABEL[result.overallLevel][0]}.`,
                      `Your overall level is ${MATURITY_LEVEL_LABEL[result.overallLevel][1]}.`
                    )
                  : t('Aún no has completado tu evaluación de madurez.', 'You have not completed your maturity assessment yet.')}
              </p>
            </div>
            <Gauge className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          </div>
          {result ? (
            <>
              <div className="space-y-2.5">
                {[...result.dimensions]
                  .sort((a, b) => b.score - a.score)
                  .map((d) => (
                    <div key={d.id} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 text-xs font-medium text-foreground">{d.tema}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-accent/60">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(Math.round((d.score / 120) * 100), 100)}%` }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right font-mono text-xs text-muted-foreground">
                        {Math.round(d.score)} · {MATURITY_LEVEL_LABEL[d.level][0]}
                      </span>
                    </div>
                  ))}
              </div>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-success">
                    {t('Fortalezas', 'Strengths')}
                  </h3>
                  <ul className="space-y-1.5 text-sm">
                    {strengths.map((d) => (
                      <li key={d.id} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{d.tema}</span> · {Math.round(d.score)}/120
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-warning">
                    {t('Áreas de oportunidad', 'Areas of opportunity')}
                  </h3>
                  <ul className="space-y-1.5 text-sm">
                    {opportunities.map((d) => (
                      <li key={d.id} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{d.tema}</span> · {Math.round(d.score)}/120
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="max-w-md text-sm text-muted-foreground">
                {t(
                  'Completa el diagnóstico inicial para ver tu madurez por tema, fortalezas y áreas de oportunidad.',
                  'Complete the initial assessment to see your maturity by topic, strengths and areas of opportunity.'
                )}
              </p>
              <button
                type="button"
                onClick={() => router.push(`/${routeLocale}/onboarding`)}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {t('Hacer mi diagnóstico', 'Take my assessment')}
              </button>
            </div>
          )}
        </GlassCard>

        <GlassCard id="resumen-plan" className="animate-slide-up" style={{ animationDelay: '380ms' }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('Tu plan de negocio', 'Your business plan')}</h2>
              <p className="text-xs text-muted-foreground">
                {t('Estado de las fases aprobadas y del plan de acción.', 'Status of approved phases and the action plan.')}
              </p>
            </div>
            <ClipboardList className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">{t('Plan actual', 'Current plan')}</span>
                <span className="font-medium text-foreground">{subscriptionLabel}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">{t('Fases aprobadas', 'Approved phases')}</span>
                <span className="font-medium text-foreground">{approvedCount} / 5</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">{t('Diagnóstico de madurez', 'Maturity assessment')}</span>
                <span className="font-medium text-foreground">
                  {result ? `${Math.round(result.overallScore)}/120` : t('Pendiente', 'Pending')}
                </span>
              </div>
              {planCounts ? (
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="text-muted-foreground">{t('Plan de acción', 'Action plan')}</span>
                  <span className="font-medium text-foreground">
                    {t(
                      `${planCounts.objetivos} objetivos · ${planCounts.acciones} acciones`,
                      `${planCounts.objetivos} objectives · ${planCounts.acciones} actions`
                    )}
                  </span>
                </div>
              ) : null}
              {planCounts && planCounts.entornos + planCounts.convocatorias + planCounts.metasFinancieras > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('Entorno y finanzas', 'Environment & finance')}</span>
                  <span className="font-medium text-foreground">
                    {t(
                      `${planCounts.entornos} amenazas · ${planCounts.convocatorias} convocatorias · ${planCounts.metasFinancieras} metas`,
                      `${planCounts.entornos} threats · ${planCounts.convocatorias} opportunities · ${planCounts.metasFinancieras} goals`
                    )}
                  </span>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col items-start justify-center gap-3">
              <p className="text-sm text-muted-foreground">
                {allPhasesDone
                  ? t(
                      'Tienes las 5 fases aprobadas. Compila tu plan completo en Babel con /compilar y descárgalo en PDF.',
                      'All 5 phases approved. Compile your full plan in Babel with /compilar and download it as PDF.'
                    )
                  : t(
                      'Sigue aprobando fases en Babel y captura tus objetivos en el Plan de Acción. Al terminar, compila el plan con /compilar.',
                      'Keep approving phases in Babel and capture your objectives in the Action Plan. When done, compile the plan with /compilar.'
                    )}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`/${routeLocale}/babel/plan-accion`)}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {t('Editar plan de acción', 'Edit action plan')}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/${routeLocale}/babel`)}
                  className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/60"
                >
                  {t('Ir a Babel', 'Go to Babel')}
                </button>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
      <PageTour pageId="resumen-ejecutivo" steps={pasosTour} lang={locale} />
    </ExecutiveShell>
  );
}
