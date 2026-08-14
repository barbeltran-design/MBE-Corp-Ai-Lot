'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import { CommandPalette, type CommandPaletteItem } from '@/components/ui/executive/command-palette';
import { useDisplayLang } from '@/components/display-lang-provider';
import { UserMenu } from '@/components/user-menu';

export interface ExecutiveNavItem {
  href?: string;
  label: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  group?: string;
  children?: ExecutiveNavItem[];
  // Solo título (no navega); sus hijos se despliegan con el chevron.
  titleOnly?: boolean;
}

export interface ExecutiveShellProps {
  children: React.ReactNode;
  navItems: ExecutiveNavItem[];
  commandItems?: CommandPaletteItem[];
  brandLabel?: string;
  logoSrc?: string;
  headerRight?: React.ReactNode;
}

/** ¿El ítem coincide con la ruta actual? (quita el query; para /worlds?v=X compara v). */
function isItemActive(item: ExecutiveNavItem, pathname: string, search: string): boolean {
  if (!item.href) return false;
  const idx = item.href.indexOf('?');
  const base = idx === -1 ? item.href : item.href.slice(0, idx);
  const qs = idx === -1 ? '' : item.href.slice(idx + 1);
  if (pathname === base || pathname === `${base}/`) {
    if (qs.startsWith('v=')) {
      try {
        return new URLSearchParams(search).get('v') === qs.slice(2);
      } catch {
        return false;
      }
    }
    return true;
  }
  return false;
}

function hasActiveDescendant(item: ExecutiveNavItem, pathname: string, search: string): boolean {
  return isItemActive(item, pathname, search) || (item.children ?? []).some((c) => hasActiveDescendant(c, pathname, search));
}

/** Aplana la navegación (padres + hijos) para la paleta de comandos. */
function flattenNav(items: ExecutiveNavItem[], group?: string): ExecutiveNavItem[] {
  return items.flatMap((item) => {
    const g = item.group ?? group ?? 'Navegación';
    const self = item.href && !item.titleOnly ? [{ ...item, group: g }] : [];
    return [...self, ...flattenNav(item.children ?? [], g)];
  });
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
    const segments = pathname.split('/');
    if (segments[1] === 'es' || segments[1] === 'en') {
      segments[1] = newLang;
    }
    const qs = typeof window !== 'undefined' ? window.location.search : '';
    router.replace(segments.join('/') + (qs || ''));
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
  brandLabel = 'MBE Corp-AI-Lot',
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
  const [logoFailed, setLogoFailed] = React.useState(false);

  const router = useRouter();
  const paletteItems: CommandPaletteItem[] = React.useMemo(() => {
    if (commandItems.length > 0) return commandItems;
    return flattenNav(navItems).map((item) => ({
      id: item.href ?? item.label,
      label: item.label,
      group: item.group ?? 'Navegación',
      icon: item.icon,
      onSelect: () => item.href && router.push(item.href),
    }));
  }, [commandItems, navItems, router]);

  const search = typeof window !== 'undefined' ? window.location.search : '';
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});
  const toggleSection = (label: string) => setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));

  // Al navegar, abre automáticamente la sección que contiene la ruta activa.
  React.useEffect(() => {
    setOpenSections((prev) => {
      let changed = false;
      const next = { ...prev };
      const scan = (items: ExecutiveNavItem[]) => {
        for (const it of items) {
          if ((it.children?.length ?? 0) > 0 && hasActiveDescendant(it, pathname, search)) {
            if (!next[it.label]) {
              next[it.label] = true;
              changed = true;
            }
          }
          scan(it.children ?? []);
        }
      };
      scan(navItems);
      return changed ? next : prev;
    });
  }, [pathname, search, navItems]);

  const renderNav = (item: ExecutiveNavItem, depth: number): React.ReactNode => {
    const hasChildren = (item.children?.length ?? 0) > 0;
    const expanded = Boolean(openSections[item.label]);
    const active = isItemActive(item, pathname, search);
    const Icon = item.icon;

    const arrow = hasChildren ? (
      <button
        type="button"
        aria-label={expanded ? 'Contraer subsección' : 'Expandir subsección'}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleSection(item.label);
        }}
        className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-accent"
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-150', expanded && 'rotate-90')} strokeWidth={1.75} />
      </button>
    ) : null;

    // Fila tipo título (no navega): encabezado de sección con chevron.
    if (item.titleOnly) {
      if (collapsed) return null;
      return (
        <React.Fragment key={item.label}>
          <div
            className={cn(
              'flex w-full items-center gap-2 rounded-md text-muted-foreground/70',
              depth > 0 ? 'px-2.5 py-1 text-xs font-semibold normal-case tracking-normal' : 'px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider'
            )}
            role={hasChildren ? 'button' : undefined}
            tabIndex={hasChildren ? 0 : undefined}
            onClick={hasChildren ? () => toggleSection(item.label) : undefined}
            onKeyDown={hasChildren ? (e) => { if (e.key === 'Enter' || e.key === ' ') toggleSection(item.label); } : undefined}
          >
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} /> : null}
            <span className="flex-1 truncate">{item.label}</span>
            {arrow}
          </div>
          {hasChildren && expanded ? <div className="space-y-0.5">{item.children!.map((c) => renderNav(c, depth + 1))}</div> : null}
        </React.Fragment>
      );
    }

    const rowClass = cn(
      'group relative flex w-full items-center gap-3 rounded-md font-medium transition-colors duration-150',
      depth > 0 ? 'py-1.5 text-[13px]' : 'py-2 text-sm',
      collapsed ? 'justify-center px-2.5' : depth > 0 ? 'pl-6 pr-2.5' : 'px-2.5',
      active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
    );

    const content = (
      <>
        {Icon ? (
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        ) : (
          <span className={cn('shrink-0', collapsed ? 'w-0' : 'w-4')} />
        )}
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
        {!collapsed && hasChildren ? arrow : null}
        {collapsed ? (
          <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
            {item.label}
          </span>
        ) : null}
      </>
    );

    return (
      <React.Fragment key={item.label}>
        {item.href ? (
          <Link
            href={item.href}
            title={collapsed ? item.label : undefined}
            onClick={hasChildren ? () => toggleSection(item.label) : undefined}
            className={rowClass}
          >
            {content}
          </Link>
        ) : (
          <button
            type="button"
            onClick={hasChildren ? () => toggleSection(item.label) : undefined}
            className={rowClass}
          >
            {content}
          </button>
        )}
        {hasChildren && expanded && !collapsed ? (
          <div className="space-y-0.5">{item.children!.map((c) => renderNav(c, depth + 1))}</div>
        ) : null}
      </React.Fragment>
    );
  };

  return (
      <div className="flex min-h-screen text-foreground">
        <aside
          className={cn(
            'sticky top-0 flex h-screen shrink-0 flex-col border-r border-glass-border bg-glass shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-2xl backdrop-saturate-150 transition-[width] duration-200 ease-executive',
            collapsed ? 'w-16' : 'w-60'
          )}
        >
          <div className="flex h-14 items-center gap-2 border-b border-glass-border px-3">
            {logoSrc && !logoFailed ? (
              <img src={logoSrc} alt={brandLabel} className="h-9 w-9 shrink-0 rounded" onError={() => setLogoFailed(true)} />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
                M
              </div>
            )}
            {!collapsed ? (
              <span className="truncate text-sm font-semibold tracking-tight">{brandLabel}</span>
            ) : null}
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {navItems.map((item, index) => {
              const prev = navItems[index - 1];
              const groupLabel = item.group && (!prev || prev.group !== item.group) ? item.group : null;
              return (
                <React.Fragment key={item.label}>
                  {groupLabel && !collapsed ? (
                    <div className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {groupLabel}
                    </div>
                  ) : null}
                  {renderNav(item, 0)}
                </React.Fragment>
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
              <UserMenu />
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

          <main className="flex-1 p-6">{children}</main>
        </div>

        <CommandPalette items={paletteItems} open={commandOpen} onOpenChange={setCommandOpen} />
      </div>
  );
}
