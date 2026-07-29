import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const glassCardVariants = cva(
  'relative rounded-2xl border border-glass-border bg-glass shadow-[0_20px_50px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-200 ease-executive',
  {
    variants: {
      interactive: {
        true: 'cursor-pointer hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30',
        false: '',
      },
      padding: {
        none: '',
        sm: 'p-4',
        default: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      interactive: false,
      padding: 'default',
    },
  }
);

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {}

/**
 * Superficie base del sistema ejecutivo: vidrio esmerilado (backdrop-blur) con un
 * borde de 1px casi invisible. En `interactive`, se eleva sutilmente al hover
 * (translate + sombra al 5% de opacidad) — sin sombras pesadas ni gradientes.
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, interactive, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(glassCardVariants({ interactive, padding }), className)}
      {...props}
    />
  )
);
GlassCard.displayName = 'GlassCard';

export { glassCardVariants };
