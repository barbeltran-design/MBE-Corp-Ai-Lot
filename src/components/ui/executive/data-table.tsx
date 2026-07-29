'use client';

import * as React from 'react';
import {
  type ColumnDef,
  type ExpandedState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  /** Contenido expandido bajo una fila; si se omite, ninguna fila es expandible */
  renderSubRow?: (row: TData) => React.ReactNode;
  enableColumnVisibility?: boolean;
  enableExport?: boolean;
  exportFileName?: string;
  emptyMessage?: string;
  className?: string;
}

function columnLabel(header: unknown, fallbackId: string): string {
  return typeof header === 'string' ? header : fallbackId;
}

/**
 * Tabla de datos ejecutiva sobre TanStack Table v8: ordenamiento por columna,
 * expansión de fila opcional (`renderSubRow`), visibilidad de columnas y export a
 * CSV — todo con controles inline, sin depender de un primitivo Popover adicional.
 */
export function DataTable<TData extends object>({
  columns,
  data,
  renderSubRow,
  enableColumnVisibility = false,
  enableExport = false,
  exportFileName = 'export',
  emptyMessage = 'Sin datos.',
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, expanded, columnVisibility },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => Boolean(renderSubRow),
  });

  function handleExportCsv() {
    const visibleColumns = table.getVisibleLeafColumns();
    const header = visibleColumns
      .map((c) => columnLabel(c.columnDef.header, c.id))
      .join(',');
    const rows = table.getRowModel().rows.map((row) =>
      visibleColumns
        .map((col) => {
          const raw = row.getValue(col.id);
          const cell = raw == null ? '' : String(raw).replace(/"/g, '""');
          return /[",\n]/.test(cell) ? `"${cell}"` : cell;
        })
        .join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
      {enableColumnVisibility || enableExport ? (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-3 py-2">
          {enableColumnVisibility ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {table.getAllLeafColumns().map((column) => (
                <button
                  key={column.id}
                  type="button"
                  onClick={() => column.toggleVisibility()}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-150',
                    column.getIsVisible()
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border bg-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {columnLabel(column.columnDef.header, column.id)}
                </button>
              ))}
            </div>
          ) : (
            <span />
          )}
          {enableExport ? (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors duration-150 hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              Exportar CSV
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => {
                  const sortState = header.column.getIsSorted();
                  const SortIcon =
                    sortState === 'asc' ? ArrowUp : sortState === 'desc' ? ArrowDown : ArrowUpDown;
                  return (
                    <th
                      key={header.id}
                      className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-foreground"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon
                            className={cn('h-3 w-3', sortState ? 'opacity-100' : 'opacity-40')}
                            strokeWidth={1.75}
                          />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <tr className="border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-accent/40">
                    {row.getVisibleCells().map((cell, cellIndex) => (
                      <td key={cell.id} className="px-4 py-2.5 text-foreground">
                        <div className="flex items-center gap-2">
                          {cellIndex === 0 && renderSubRow ? (
                            <button
                              type="button"
                              onClick={row.getToggleExpandedHandler()}
                              className="text-muted-foreground transition-transform duration-150"
                              style={{
                                transform: row.getIsExpanded() ? 'rotate(90deg)' : 'rotate(0deg)',
                              }}
                              aria-label={row.getIsExpanded() ? 'Contraer fila' : 'Expandir fila'}
                            >
                              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          ) : null}
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && renderSubRow ? (
                    <tr className="animate-fade-in border-b border-border/60 bg-muted/30 last:border-0">
                      <td colSpan={row.getVisibleCells().length} className="px-4 py-3">
                        {renderSubRow(row.original)}
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
