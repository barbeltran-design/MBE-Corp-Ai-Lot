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
  DataTable,
  GlassCard,
  MetricCard,
  ProgressRing,
  type CommandPaletteItem,
} from '@/components/ui/executive';
import { BABEL_PHASE_TOPICS_ES } from '@/lib/babel-constants';
import { cn } from '@/lib/utils';

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

const STATUS_META: Record<
  PhaseStatus,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  }
> = {
  completado: { label: 'Completado', className: 'text-success', icon: CheckCircle2 },
  en_progreso: { label: 'En progreso', className: 'text-warning', icon: Clock },
  pendiente: { label: 'Pendiente', className: 'text-muted-foreground', icon: CircleDashed },
};

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

const phaseColumns: ColumnDef<PhaseRow>[] = [
  {
    id: 'topic',
    header: 'Fase',
    accessorFn: (row) => row.topic,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{row.original.topic}</span>
        <span className="text-xs text-muted-foreground">Fase {row.original.phase}</span>
      </div>
    ),
  },
  {
    id: 'status',
    header: 'Estado',
    accessorFn: (row) => row.status,
    cell: ({ row }) => {
      const meta = STATUS_META[row.original.status];
      const Icon = meta.icon;
      return (
        <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', meta.className)}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          {meta.label}
        </span>
      );
    },
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

const NAV_ICON_MAP = { LayoutDashboard, Sparkles, Gauge, ClipboardList };

export default function ExecutivePreviewPage() {
  const params = useParams<{ locale: string }>();
  const router = useRouter();
  const locale = params?.locale ?? 'es';

  const navItems: ExecutiveNavItem[] = [
    { href: `/${locale}/executive-preview`, label: 'Resumen ejecutivo', icon: NAV_ICON_MAP.LayoutDashboard },
    { href: `/${locale}/babel`, label: 'Babel AI', icon: NAV_ICON_MAP.Sparkles },
    { href: `/${locale}/dashboard`, label: 'Dashboard real', icon: NAV_ICON_MAP.Gauge },
    { href: `/${locale}/onboarding`, label: 'Diagnóstico', icon: NAV_ICON_MAP.ClipboardList },
  ];

  const commandItems: CommandPaletteItem[] = [
    ...PHASE_ROWS.map((row) => ({
      id: row.id,
      label: row.topic,
      group: 'Fases Babel',
      // Preview sin deep-linking por fase todavía; el placeholder deja el
      // patrón listo para cuando cada fase tenga su propia sub-ruta.
      onSelect: () => {},
    })),
    {
      id: 'go-babel',
      label: 'Ir a Babel AI',
      group: 'Navegación',
      onSelect: () => router.push(`/${locale}/babel`),
    },
    {
      id: 'go-dashboard',
      label: 'Ir al dashboard real',
      group: 'Navegación',
      onSelect: () => router.push(`/${locale}/dashboard`),
    },
  ];

  const completedPhases = PHASE_ROWS.filter((r) => r.status === 'completado').length;
  const overallProgress = Math.round((completedPhases / PHASE_ROWS.length) * 100 + 5); // +5: fase en progreso parcial

  return (
    <ExecutiveShell navItems={navItems} commandItems={commandItems} brandLabel="MBE Corpilot AI">
      {/* Fondo con manchas de color + patrón de puntos: el vidrio necesita
          algo que revelar detrás — sin textura ni color, el backdrop-blur
          no se nota. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-dot-pattern" />
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-[hsl(189_64%_50%_/_0.4)] blur-[120px]" />
        <div className="absolute -right-20 top-0 h-[500px] w-[500px] rounded-full bg-[hsl(189_64%_50%_/_0.3)] blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[700px] -translate-x-1/2 rounded-full bg-[hsl(180_3%_49%_/_0.2)] blur-[140px]" />
        <div className="absolute -bottom-20 right-1/4 h-[350px] w-[350px] rounded-full bg-[hsl(189_64%_50%_/_0.2)] blur-[100px]" />
        <div className="absolute left-1/4 top-1/3 h-[250px] w-[250px] rounded-full bg-[hsl(189_64%_50%_/_0.12)] blur-[90px]" />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="animate-fade-in">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Resumen ejecutivo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Avance del diagnóstico Babel · datos de muestra para validar el nuevo sistema visual.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            className="animate-slide-up"
            style={{ animationDelay: '0ms' }}
            label="Fase actual"
            value={`Fase ${PHASE_ROWS[3].phase}`}
            unit={PHASE_ROWS[3].topic.split(':')[1]?.trim()}
            icon={Sparkles}
            variant="default"
          />
          <MetricCard
            className="animate-slide-up"
            style={{ animationDelay: '60ms' }}
            label="Progreso general"
            value={overallProgress}
            unit="%"
            delta={5.2}
            deltaLabel="vs. semana pasada"
            trend={OVERALL_PROGRESS_TREND}
            icon={TrendingUp}
            variant="success"
          />
          <MetricCard
            className="animate-slide-up"
            style={{ animationDelay: '120ms' }}
            label="Entregables generados"
            value={DELIVERABLES_TREND[DELIVERABLES_TREND.length - 1]}
            delta={12.5}
            deltaLabel="vs. mes pasado"
            trend={DELIVERABLES_TREND}
            icon={FileCheck2}
            variant="default"
          />
          <MetricCard
            className="animate-slide-up"
            style={{ animationDelay: '180ms' }}
            label="Riesgo normativo"
            value={RISK_TREND[RISK_TREND.length - 1]}
            unit="/100"
            delta={-2.1}
            deltaLabel="reducción sostenida"
            trend={RISK_TREND}
            icon={ShieldAlert}
            variant="warning"
          />
        </div>

        <GlassCard className="animate-slide-up" style={{ animationDelay: '220ms' }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Avance por fase</h2>
              <p className="text-xs text-muted-foreground">6 fases del diagnóstico Babel (0 a 5)</p>
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
                  label={`Fase ${row.phase}`}
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
            <h2 className="text-sm font-semibold text-foreground">Detalle de fases</h2>
          </div>
          <DataTable<PhaseRow>
            columns={phaseColumns}
            data={PHASE_ROWS}
            enableExport
            exportFileName="babel-fases"
            emptyMessage="Sin fases registradas."
            renderSubRow={(row) => (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Entregables:</span>
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
