'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import { CommandPalette, type CommandPaletteItem } from '@/components/ui/executive/command-palette';
import { useDisplayLang } from '@/components/display-lang-provider';

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

function LangToggle() {
  const { lang, setLang } = useDisplayLang();
  const pathname = usePathname();
  const router = useRouter();
  const navigateLang = (newLang: 'es' | 'en') => {
    setLang(newLang);
    const isDashboard = pathname.includes('/dashboard');
    if (isDashboard) {
      const segments = pathname.split('/');
      if (segments[1] === 'es' || segments[1] === 'en') {
        segments[1] = newLang;
      }
      router.replace(segments.join('/'));
    }
  };
  return (
    <div className="flex gap-0.5 rounded-full border border-glass-border bg-glass p-0.5 text-xs">
      <button
        type="button"
        onClick={() => navigateLang('es')}
        className={'rounded-full px-2.5 py-1 font-medium transition-colors ' + (lang === 'es' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
      >
        ES
      </button>
      <button
        type="button"
        onClick={() => navigateLang('en')}
        className={'rounded-full px-2.5 py-1 font-medium transition-colors ' + (lang === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
      >
        EN
      </button>
    </div>
  );
}

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
            'sticky top-0 flex h-screen shrink-0 flex-col border-r border-glass-border bg-glass shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-2xl backdrop-saturate-150 transition-[width] duration-200 ease-executive',
            collapsed ? 'w-16' : 'w-60'
          )}
        >
          <div className="flex h-14 items-center gap-2 border-b border-glass-border px-3">
            {logoSrc ? (
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
              const active = pathname === item.href || pathname === `${item.href}/`;
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

          <div className="border-t border-glass-border p-2">
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
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-glass-border bg-glass px-4 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-2xl backdrop-saturate-150">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="flex w-full max-w-sm items-center gap-2 rounded-md border border-glass-border bg-glass px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent"
            >
              <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span className="flex-1 truncate text-left">Buscar...</span>
              <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-glass-border bg-glass px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
                ⌘K
              </kbd>
            </button>

            <div className="flex shrink-0 items-center gap-2">
              {headerRight}
              <LangToggle />
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
