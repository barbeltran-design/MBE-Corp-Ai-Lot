'use client';

import * as React from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from 'cmdk';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CommandPaletteItem {
  id: string;
  label: string;
  group: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  shortcut?: string;
  keywords?: string[];
  onSelect: () => void;
}

export interface CommandPaletteProps {
  items: CommandPaletteItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
}

/**
 * Paleta de comandos global (⌘K / Ctrl+K), construida sobre cmdk (que ya trae
 * @radix-ui/react-dialog como dependencia transitiva — no se agrega ninguna
 * dependencia nueva al proyecto).
 *
 * Se puede usar no controlada (maneja su propio estado, solo reacciona al atajo de
 * teclado) o controlada (pasando `open` + `onOpenChange`), que es el modo que usa
 * ExecutiveShell para que el botón de búsqueda del header también pueda abrirla.
 */
export function CommandPalette({
  items,
  open: openProp,
  onOpenChange,
  placeholder = 'Buscar páginas, acciones...',
}: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(!open);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // Radix Dialog.Content ya maneja Escape-to-close internamente; no se duplica aquí.
  }, [open, setOpen]);

  const groups = React.useMemo(() => {
    const map = new Map<string, CommandPaletteItem[]>();
    for (const item of items) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      label="Paleta de comandos"
      shouldFilter
      loop
      overlayClassName="fixed inset-0 z-50 animate-fade-in bg-background/70 backdrop-blur-sm"
      contentClassName={cn(
        'fixed left-1/2 top-[18%] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2',
        'animate-slide-up-modal overflow-hidden rounded-lg border border-border',
        'bg-popover text-popover-foreground shadow-2xl shadow-black/20 focus:outline-none'
      )}
      className="flex flex-col"
    >
      <div className="flex items-center gap-2 border-b border-border px-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <CommandInput
          placeholder={placeholder}
          className="flex h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <CommandKbd className="shrink-0">Esc</CommandKbd>
      </div>
      <CommandList className="max-h-80 overflow-y-auto p-2">
        <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
          Sin resultados.
        </CommandEmpty>
        {groups.map(([group, groupItems], index) => (
          <React.Fragment key={group}>
            {index > 0 && <CommandSeparator className="my-1 h-px bg-border" />}
            <CommandGroup
              heading={group}
              className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {groupItems.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.id}
                    value={[item.label, ...(item.keywords ?? [])].join(' ')}
                    onSelect={() => {
                      setOpen(false);
                      item.onSelect();
                    }}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground',
                      'transition-colors duration-150 aria-selected:bg-accent aria-selected:text-accent-foreground'
                    )}
                  >
                    {Icon ? (
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    ) : null}
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.shortcut ? <CommandKbd>{item.shortcut}</CommandKbd> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export function CommandKbd({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border',
        'bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground',
        className
      )}
    >
      {children}
    </kbd>
  );
}
