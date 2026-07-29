'use client';

import * as React from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from './glass-card';

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  /** Variación en puntos porcentuales, p.ej. 4.2 o -1.1 */
  delta?: number;
  deltaLabel?: string;
  /** Serie para el sparkline (sin ejes, decorativo) */
  trend?: number[];
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const variantAccentClass: Record<NonNullable<MetricCardProps['variant']>, string> = {
  default: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

const variantStrokeVar: Record<NonNullable<MetricCardProps['variant']>, string> = {
  default: 'hsl(var(--primary))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  danger: 'hsl(var(--destructive))',
};

/**
 * Tarjeta de métrica ejecutiva: valor en mono, delta con flecha semántica
 * (success/danger), sparkline opcional (Recharts, sin ejes) y estado de carga
 * con shimmer. Construida sobre GlassCard.
 */
export function MetricCard({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  trend,
  icon: Icon,
  variant = 'default',
  loading = false,
  className,
  style,
}: MetricCardProps) {
  const gradientId = React.useId();

  if (loading) {
    return (
      <GlassCard className={cn('animate-fade-in', className)} style={style}>
        <div className="space-y-3">
          <div className="h-3 w-24 animate-shimmer rounded bg-gradient-to-r from-muted via-accent to-muted bg-[length:200%_100%]" />
          <div className="h-7 w-32 animate-shimmer rounded bg-gradient-to-r from-muted via-accent to-muted bg-[length:200%_100%]" />
        </div>
      </GlassCard>
    );
  }

  const deltaPositive = typeof delta === 'number' && delta > 0;
  const deltaNegative = typeof delta === 'number' && delta < 0;
  const DeltaIcon = deltaPositive ? ArrowUpRight : deltaNegative ? ArrowDownRight : Minus;

  return (
    <GlassCard
      interactive
      className={cn('flex animate-slide-up flex-col gap-3', className)}
      style={style}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon ? (
          <span className={cn('rounded-md bg-accent/60 p-1.5', variantAccentClass[variant])}>
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </span>
          {unit ? <span className="text-sm text-muted-foreground">{unit}</span> : null}
        </div>

        {trend && trend.length > 1 ? (
          <div className="h-8 w-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend.map((v, i) => ({ i, v }))}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={variantStrokeVar[variant]} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={variantStrokeVar[variant]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={variantStrokeVar[variant]}
                  strokeWidth={1.5}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>

      {typeof delta === 'number' ? (
        <div className="flex items-center gap-1 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              deltaPositive && 'text-success',
              deltaNegative && 'text-danger',
              !deltaPositive && !deltaNegative && 'text-muted-foreground'
            )}
          >
            <DeltaIcon className="h-3 w-3" strokeWidth={2} />
            {Math.abs(delta).toFixed(1)}%
          </span>
          {deltaLabel ? <span className="text-muted-foreground">{deltaLabel}</span> : null}
        </div>
      ) : null}
    </GlassCard>
  );
}
