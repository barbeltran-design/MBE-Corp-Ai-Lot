'use client';

// Página de muestra del nuevo sistema de diseño ejecutivo (ExecutiveShell +
// componentes en src/components/ui/executive/). NO sustituye a /dashboard
// (el dashboard real conectado a Firestore); es un escaparate autocontenido
// con datos mock basados en las 6 fases reales de Babel (ver
// src/lib/babel-constants.ts) para validar look & feel antes de conectar
// datos reales. Enteramente client-side, sin llamadas a Firebase.
import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import {
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Clock,
  FileCheck2,
  Gauge,
  LayoutDashboard,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { ExecutiveShell, type ExecutiveNavItem } from '@/components/executive-shell';
import {
  BackgroundBlobs,
  DataTable,
  GlassCard,
  MetricCard,
  ProgressRing,
  type CommandPaletteItem,
} from '@/components/ui/executive';
import { BABEL_PHASE_TOPICS_ES } from '@/lib/babel-constants';
import { cn } from '@/lib/utils';
import { DisplayLangProvider, useDisplayLang } from '@/components/display-lang-provider';

type PhaseStatus = 'completado' | 'en_progreso' | 'pendiente';

interface PhaseRow {
  id: string;
  phase: number;
  topic: string;
  status: PhaseStatus;
  owner: string;
  nextMilestone: string;
  deliverables: string[];
}

const NAV_ICON_MAP = { LayoutDashboard, Gauge, Sparkles, ClipboardList, Users, TrendingUp };

// Datos mock alineados a BABEL_PHASE_TOPICS_ES — 6 fases reales (0 a 5) del
// diagnóstico Babel, con avance narrativo: 0-2 completadas, 3 en progreso,
// 4-5 pendientes.
const PHASE_ROWS: PhaseRow[] = BABEL_PHASE_TOPICS_ES.map((topic, phase) => {
  const status: PhaseStatus = phase <= 2 ? 'completado' : phase === 3 ? 'en_progreso' : 'pendiente';
  const owners = ['Equipo fundador', 'Equipo fundador', 'Mercadotecnia', 'Operaciones', 'Finanzas', 'Dirección general'];
  const milestones = [
    'Cerrado 04 mar',
    'Cerrado 18 mar',
    'Cerrado 02 abr',
    '30 jul — validación de mercado',
    'Sin agendar',
    'Sin agendar',
  ];
  const deliverablesByPhase = [
    ['Acta de calibración', 'Mapa de involucrados'],
    ['Lienzo de propósito', 'Declaración de ADN estratégico'],
    ['Estudio de mercado data-driven', 'Matriz de competencia'],
    ['Modelo Delta (borrador)', 'Mapa de experiencia del cliente'],
    ['Modelo financiero 3 años'],
    ['Pitch deck ejecutivo', 'Tablero de gobernanza ágil'],
  ];
  return {
    id: `fase-${phase}`,
    phase,
    topic,
    status,
    owner: owners[phase] ?? 'Sin asignar',
    nextMilestone: milestones[phase] ?? 'Sin agendar',
    deliverables: deliverablesByPhase[phase] ?? [],
  };
});

const OVERALL_PROGRESS_TREND = [38, 42, 47, 55, 58, 63, 68];
const DELIVERABLES_TREND = [1, 1, 2, 3, 3, 4, 6];
const RISK_TREND = [22, 20, 19, 17, 18, 15, 13];

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

function TopicCell({ phase, topic }: { phase: number; topic: string }) {
  const { lang } = useDisplayLang();
  return (
    <div className="flex flex-col">
      <span className="font-medium text-foreground">{topic}</span>
      <span className="text-xs text-muted-foreground">{lang === 'en' ? `Phase ${phase}` : `Fase ${phase}`}</span>
    </div>
  );
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
    cell: ({ row }) => <TopicCell phase={row.original.phase} topic={row.original.topic} />,
  },
  {
    id: 'status',
    header: 'Estado',
    accessorFn: (row) => row.status,
    cell: ({ row }) => <StatusCell status={row.original.status} />,
  },
  {
    id: 'owner',
    header: 'Responsable',
    accessorFn: (row) => row.owner,
  },
  {
    id: 'nextMilestone',
    header: 'Próximo hito',
    accessorFn: (row) => row.nextMilestone,
  },
];

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

  const t = (es: string, en: string) => lang === 'en' ? en : es;

  const navItems: ExecutiveNavItem[] = [
    { href: `/${routeLocale}/executive-preview`, label: t('Resumen ejecutivo', 'Executive Summary'), icon: NAV_ICON_MAP.LayoutDashboard },
    { href: `/${routeLocale}/babel`, label: t('Reflexión estratégica', 'Strategic Reflection'), icon: NAV_ICON_MAP.Sparkles },
    { href: `/${routeLocale}/babel/organigrama`, label: t('Organigrama y roles', 'Org Chart & Roles'), icon: NAV_ICON_MAP.Users },
    { href: `/${routeLocale}/babel/plan-accion`, label: t('Plan de acción', 'Action Plan'), icon: NAV_ICON_MAP.ClipboardList },
    { href: `/${routeLocale}/babel/indicadores`, label: t('Objetivos financieros', 'Financial Goals'), icon: NAV_ICON_MAP.TrendingUp },
    { href: `/${routeLocale}/dashboard`, label: t('Evaluación de madurez', 'Maturity Assessment'), icon: NAV_ICON_MAP.Gauge },
  ];

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
  ];

  const completedPhases = PHASE_ROWS.filter((r) => r.status === 'completado').length;
  const overallProgress = Math.round((completedPhases / PHASE_ROWS.length) * 100 + 5);

  return (
    <ExecutiveShell navItems={navItems} commandItems={commandItems} brandLabel="MBE Corpilot AI">
      <BackgroundBlobs />
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="animate-fade-in">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{t('Resumen ejecutivo', 'Executive Summary')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Avance del diagnóstico Babel · datos de muestra para validar el nuevo sistema visual.', 'Babel diagnostic progress · sample data to validate the new visual system.')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            className="animate-slide-up"
            style={{ animationDelay: '0ms' }}
            label={t('Fase actual', 'Current phase')}
            value={`${t('Fase', 'Phase')} ${PHASE_ROWS[3].phase}`}
            unit={PHASE_ROWS[3].topic.split(':')[1]?.trim()}
            icon={Sparkles}
            variant="default"
          />
          <MetricCard
            className="animate-slide-up"
            style={{ animationDelay: '60ms' }}
            label={t('Progreso general', 'Overall progress')}
            value={overallProgress}
            unit="%"
            delta={5.2}
            deltaLabel={t('vs. semana pasada', 'vs. last week')}
            trend={OVERALL_PROGRESS_TREND}
            icon={TrendingUp}
            variant="success"
          />
          <MetricCard
            className="animate-slide-up"
            style={{ animationDelay: '120ms' }}
            label={t('Entregables generados', 'Deliverables generated')}
            value={DELIVERABLES_TREND[DELIVERABLES_TREND.length - 1]}
            delta={12.5}
            deltaLabel={t('vs. mes pasado', 'vs. last month')}
            trend={DELIVERABLES_TREND}
            icon={FileCheck2}
            variant="default"
          />
          <MetricCard
            className="animate-slide-up"
            style={{ animationDelay: '180ms' }}
            label={t('Riesgo normativo', 'Regulatory risk')}
            value={RISK_TREND[RISK_TREND.length - 1]}
            unit="/100"
            delta={-2.1}
            deltaLabel={t('reducción sostenida', 'sustained reduction')}
            trend={RISK_TREND}
            icon={ShieldAlert}
            variant="warning"
          />
        </div>

        <GlassCard className="animate-slide-up" style={{ animationDelay: '220ms' }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('Avance por fase', 'Progress by phase')}</h2>
              <p className="text-xs text-muted-foreground">{t('6 fases del diagnóstico Babel (0 a 5)', '6 phases of the Babel diagnostic (0 to 5)')}</p>
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

        <div className="animate-slide-up" style={{ animationDelay: '260ms' }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{t('Detalle de fases', 'Phase details')}</h2>
          </div>
          <DataTable<PhaseRow>
            columns={phaseColumns.map((col) => {
              if (col.id === 'topic') return { ...col, header: t('Fase', 'Phase') };
              if (col.id === 'status') return { ...col, header: t('Estado', 'Status') };
              if (col.id === 'owner') return { ...col, header: t('Responsable', 'Owner') };
              if (col.id === 'nextMilestone') return { ...col, header: t('Próximo hito', 'Next milestone') };
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
                {row.deliverables.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-foreground"
                  >
                    {d}
                  </span>
                ))}
              </div>
            )}
          />
        </div>
      </div>
    </ExecutiveShell>
  );
}
