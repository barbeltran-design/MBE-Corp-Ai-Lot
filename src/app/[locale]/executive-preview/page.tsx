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
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Clock,
  FileCheck2,
  Gauge,
  Home,
  LayoutDashboard,
  LineChart,
  Megaphone,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck2,
  Users,
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
import BabelAvatar from '@/components/babel/BabelAvatar';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import { useUserRoles } from '@/lib/use-user-roles';
import { getMaturityDimensions } from '@/lib/maturity-dimensions';
import { computeResults, type AssessmentResult, type DimensionAnswers } from '@/lib/maturity-scoring';
import { getAssessmentHistory, getLatestAssessmentAnswers, type AssessmentHistoryPoint } from '@/lib/assessment';
import { getBabelSessionIfExists } from '@/lib/babel-session';
import type { BabelPhaseRecord, MaturityLevel, SessionDoc, UserDoc } from '@/types/firestore';
import type { FinancialGoalsInput, FinancialGoalsResult } from '@/lib/deliverables';

type PhaseStatus = 'completado' | 'en_progreso' | 'pendiente';

interface PhaseRow {
  id: string;
  phase: number;
  topic: string;
  status: PhaseStatus;
  approvedAt: string | null;
  deliverables: string[];
}

const NAV_ICON_MAP = { Home, LayoutDashboard, Gauge, Sparkles, ClipboardList, Users, TrendingUp, LineChart, Megaphone, ShieldCheck, UserCheck2, CalendarClock };

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

  const navItems: ExecutiveNavItem[] = [
    { href: `/${routeLocale}/inicio`, label: t('Inicio', 'Home'), icon: NAV_ICON_MAP.Home },
    { href: `/${routeLocale}/executive-preview`, label: t('Resumen ejecutivo', 'Executive Summary'), icon: NAV_ICON_MAP.LayoutDashboard },
    { href: `/${routeLocale}/babel/convocatorias`, label: t('Convocatorias y fondos', 'Calls & Grants'), icon: NAV_ICON_MAP.Megaphone },
    { href: `/${routeLocale}/babel/indicadores`, label: t('Objetivos estratégicos', 'Strategic Objectives'), icon: NAV_ICON_MAP.TrendingUp },
    { href: `/${routeLocale}/dashboard`, label: t('Evaluación de madurez', 'Maturity Assessment'), icon: NAV_ICON_MAP.Gauge },
    { href: `/${routeLocale}/babel/madurez`, label: t('Mejora del Nivel de Madurez', 'Maturity Level Improvement'), icon: NAV_ICON_MAP.LineChart },
    { href: `/${routeLocale}/babel`, label: t('Reflexión estratégica', 'Strategic Reflection'), icon: NAV_ICON_MAP.Sparkles, group: t('Estrategia Socioambiental', 'Socio-environmental Strategy') },
    { href: `/${routeLocale}/babel/organigrama`, label: t('Organigrama y roles', 'Org Chart & Roles'), icon: NAV_ICON_MAP.Users, group: t('Estrategia Socioambiental', 'Socio-environmental Strategy') },
    { href: `/${routeLocale}/babel/plan-accion`, label: t('Plan de acción estratégico', 'Strategic Action Plan'), icon: NAV_ICON_MAP.ClipboardList, group: t('Estrategia Socioambiental', 'Socio-environmental Strategy') },
  ];
  if (administracionRol) {
    navItems.push({ href: `/${routeLocale}/admin`, label: t('Administración', 'Administration'), icon: NAV_ICON_MAP.ShieldCheck });
  }
  if (especialistaRol) {
    navItems.push({ href: `/${routeLocale}/especialista`, label: t('Panel de Mentor', 'Mentor Panel'), icon: NAV_ICON_MAP.UserCheck2 });
  }
  navItems.push({ href: `/${routeLocale}/agendar`, label: t('Agenda con mentores', 'Book a mentor'), icon: NAV_ICON_MAP.CalendarClock });

  const [user, setUser] = React.useState<User | null | undefined>(undefined);
  const [answers, setAnswers] = React.useState<DimensionAnswers | null>(null);
  const [history, setHistory] = React.useState<AssessmentHistoryPoint[]>([]);
  const [userDoc, setUserDoc] = React.useState<UserDoc | null>(null);
  const [sessionDoc, setSessionDoc] = React.useState<SessionDoc | null>(null);
  const [planCounts, setPlanCounts] = React.useState<{ objetivos: number; acciones: number; entornos: number; convocatorias: number; metasFinancieras: number } | null>(null);
  const [finGoals, setFinGoals] = React.useState<{ input: FinancialGoalsInput; result: FinancialGoalsResult; savedAt: string } | null>(null);

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
            <BabelAvatar size={56} className="shrink-0" />
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <div id="resumen-metricas" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
