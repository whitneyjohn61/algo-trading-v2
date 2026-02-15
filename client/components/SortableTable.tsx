'use client';

import { useState, useMemo, ReactNode } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  render?: (row: T, index: number) => ReactNode;
}

interface SortableTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: string;
  emptyMessage?: string;
  compact?: boolean;
  className?: string;
  onRowClick?: (row: T) => void;
}

type SortDir = 'asc' | 'desc';

export function SortableTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  emptyMessage = 'No data',
  compact = false,
  className = '',
  onRowClick,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const py = compact ? 'py-1.5' : 'py-2.5';
  const px = compact ? 'px-3' : 'px-4';
  const alignClass = (a?: string) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            {columns.map(col => (
              <th
                key={col.key}
                className={`${px} ${py} font-medium text-slate-500 dark:text-slate-400 ${alignClass(col.align)} ${col.sortable ? 'cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200' : ''} ${col.className || ''}`}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={`${px} py-8 text-center text-slate-400 dark:text-slate-500`}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => (
              <tr
                key={String(row[keyField])}
                className={`border-b border-slate-100 dark:border-slate-700/50 ${onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map(col => (
                  <td key={col.key} className={`${px} ${py} ${alignClass(col.align)} text-slate-700 dark:text-slate-300 ${col.className || ''}`}>
                    {col.render ? col.render(row, i) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
