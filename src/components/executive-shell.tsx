'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import { CommandPalette, type CommandPaletteItem } from '@/components/ui/executive/command-palette';

export interface ExecutiveNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
}

export interface ExecutiveShellProps {
  children: React.ReactNode;
  navItems: ExecutiveNavItem[];
  commandItems?: CommandPaletteItem[];
  brandLabel?: string;
  logoSrc?: string;
  headerRight?: React.ReactNode;
}

const SIDEBAR_STORAGE_KEY = 'mbe-sidebar-collapsed';

// Store minimalista para el estado "colapsado" del sidebar, leído/escrito via
// useSyncExternalStore en vez del patrón anterior (setState dentro de un
// useEffect con un guard `mounted`). useSyncExternalStore usa
// getServerSnapshot durante el render de servidor/hidratación — así el HTML
// del cliente coincide con el del servidor y no hay mismatch — y solo
// resincroniza con localStorage una vez montado, sin necesidad de un setState
// síncrono dentro de un efecto (lo que dispara react-hooks/set-state-in-effect).
let sidebarCollapsedCache = false;
const sidebarListeners = new Set<() => void>();

function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
  } catch {
    return sidebarCollapsedCache;
  }
}

function writeSidebarCollapsed(value: boolean) {
  sidebarCollapsedCache = value;
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, value ? '1' : '0');
  } catch {
    // localStorage no disponible — el valor vive en memoria durante esta
    // sesión (sidebarCollapsedCache) pero no persiste entre recargas.
  }
  sidebarListeners.forEach((listener) => listener());
}

function subscribeSidebarCollapsed(listener: () => void) {
  sidebarListeners.add(listener);
  return () => sidebarListeners.delete(listener);
}

function getSidebarSnapshot(): boolean {
  sidebarCollapsedCache = readSidebarCollapsed();
  return sidebarCollapsedCache;
}

function getSidebarServerSnapshot(): boolean {
  return false;
}

/**
 * Shell ejecutivo reutilizable: sidebar colapsable (con tooltip CSS-only en modo
 * colapsado, sin dependencia extra), header con trigger de CommandPalette (⌘K) y
 * toggle de tema. Se usa como wrapper dentro de una página/route, NO en el layout
 * raíz — así las rutas existentes (landing, onboarding) no se ven afectadas.
 */
export function ExecutiveShell({
  children,
  navItems,
  commandItems = [],
  brandLabel = 'MBE Corpilot AI',
  logoSrc,
  headerRight,
}: ExecutiveShellProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const collapsed = React.useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarSnapshot,
    getSidebarServerSnapshot
  );
  const setCollapsed = (updater: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof updater === 'function' ? updater(sidebarCollapsedCache) : updater;
    writeSidebarCollapsed(next);
  };
  const [commandOpen, setCommandOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen text-foreground">
      <aside
        className={cn(
          'sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur-md transition-[width] duration-200 ease-executive',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-3">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt={brandLabel} className="h-6 w-6 shrink-0 rounded" />
          ) : (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
              M
            </div>
          )}
          {!collapsed ? (
            <span className="truncate text-sm font-semibold tracking-tight">{brandLabel}</span>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-150',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
                {collapsed ? (
                  <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
                    {item.label}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
                <span>Contraer</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="flex w-full max-w-sm items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted"
          >
            <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="flex-1 truncate text-left">Buscar...</span>
            <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
              ⌘K
            </kbd>
          </button>

          <div className="flex shrink-0 items-center gap-2">
            {headerRight}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Cambiar tema"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Moon className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>

      <CommandPalette items={commandItems} open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
