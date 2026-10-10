import { useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../kit/Icon';

export interface Column<T> {
  id: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Makes the column sortable. Omit for columns where ordering would read as a ranking. */
  sortValue?: (row: T) => string | number;
  numeric?: boolean;
}

interface SortableTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** When present, every row gets an "Abrir" button. */
  onOpen?: (row: T) => void;
  openLabel?: (row: T) => string;
}

type Sort = { id: string; dir: 'ascending' | 'descending' } | null;

/** Semantic, keyboard-sortable table. The first column is the row header. */
export function SortableTable<T>({ caption, columns, rows, rowKey, onOpen, openLabel }: SortableTableProps<T>) {
  const [sort, setSort] = useState<Sort>(null);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.id === sort?.id);
    if (!sort || !col?.sortValue) return rows;
    const get = col.sortValue;
    const factor = sort.dir === 'ascending' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')) * factor;
    });
  }, [rows, columns, sort]);

  const toggle = (id: string) =>
    setSort((s) => (s?.id === id ? (s.dir === 'ascending' ? { id, dir: 'descending' } : null) : { id, dir: 'ascending' }));

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-ink-900">
          <tr className="border-b border-white/10">
            {columns.map((c) => {
              const active = sort?.id === c.id ? sort.dir : undefined;
              return (
                <th key={c.id} scope="col" aria-sort={c.sortValue ? (active ?? 'none') : undefined} className={`px-3 py-2 font-mono text-[10px] font-semibold tracking-[0.1em] text-fog uppercase ${c.numeric ? 'text-right' : ''}`}>
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggle(c.id)} aria-label={`Ordenar por ${c.header}`} className="focus-ring inline-flex items-center gap-1 rounded uppercase hover:text-snow">
                      {c.header}
                      <Icon name="chevron" size={10} className={active === 'ascending' ? '-rotate-90 text-forge-bright' : active === 'descending' ? 'rotate-90 text-forge-bright' : 'opacity-40'} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
            {onOpen && (
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Ações</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length + (onOpen ? 1 : 0)} className="px-3 py-8 text-center text-fog">
                Nenhum registro no período e filtro atuais.
              </td>
            </tr>
          )}
          {sorted.map((row) => (
            <tr key={rowKey(row)} className="border-b border-white/[0.05] hover:bg-white/[0.03]">
              {columns.map((c, i) =>
                i === 0 ? (
                  <th key={c.id} scope="row" className="px-3 py-2 font-semibold text-snow">
                    {c.render(row)}
                  </th>
                ) : (
                  <td key={c.id} className={`px-3 py-2 text-fog ${c.numeric ? 'text-right font-display text-snow tabular-nums' : ''}`}>
                    {c.render(row)}
                  </td>
                ),
              )}
              {onOpen && (
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => onOpen(row)} aria-label={openLabel?.(row) ?? 'Abrir'} className="focus-ring rounded-md bg-white/[0.07] px-2 py-1 text-[11px] font-semibold text-snow hover:bg-forge/20">
                    Abrir
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
