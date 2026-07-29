import { cn } from '@/lib/utils';

export interface ProgressRingProps {
  /** 0-100 */
  value: number;
  size?: number;
  thickness?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  showValue?: boolean;
  label?: string;
  className?: string;
}

const variantStrokeVar: Record<NonNullable<ProgressRingProps['variant']>, string> = {
  default: 'hsl(var(--primary))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  danger: 'hsl(var(--destructive))',
};

/**
 * Anillo de progreso radial. Sin JS de estado: el valor se anima vía transición CSS
 * de `stroke-dashoffset` (200ms, misma curva ejecutiva, por debajo del límite de
 * 300ms del spec), así que es un componente de servidor válido — cualquier cambio
 * de `value` entre renders anima suavemente.
 */
export function ProgressRing({
  value,
  size = 96,
  thickness = 8,
  variant = 'default',
  showValue = true,
  label,
  className,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={variantStrokeVar[variant]}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-200 ease-executive"
        />
      </svg>
      {showValue || label ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showValue ? (
            <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
              {Math.round(clamped)}%
            </span>
          ) : null}
          {label ? <span className="text-[10px] text-muted-foreground">{label}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
