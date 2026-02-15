'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Filter } from 'lucide-react';
import { usePortfolioStore, Position } from '@/store/portfolioStore';
import { SortableTable, Column } from '../SortableTable';

/**
 * Step 7.4 — Open Positions Table
 *
 * Columns: Strategy, Symbol, Side, Entry Price, Size ($), Unrealized P&L, Leverage, Age
 * - Sortable by any column
 * - Filterable by strategy
 * - Expandable rows (SL, TP, orders, funding)
 * - Real-time P&L via store (WebSocket-driven)
 */

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function pnlColor(n: number): string {
  if (n > 0) return 'text-green-500';
  if (n < 0) return 'text-red-500';
  return 'text-slate-400';
}

interface OpenPositionsTableProps {
  /** Optional: provide extended position data with strategy names */
  extendedPositions?: ExtendedPosition[];
}

export interface ExtendedPosition extends Position {
  strategyName?: string;
  stopLoss?: number;
  takeProfit?: number;
  age?: string;
  fundingPaid?: number;
}

export function OpenPositionsTable({ extendedPositions }: OpenPositionsTableProps) {
  const storePositions = usePortfolioStore(s => s.positions);
  const positions: ExtendedPosition[] = extendedPositions || storePositions;

  const [strategyFilter, setStrategyFilter] = useState<string>('all');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  // Unique strategy names for filter
  const strategies = useMemo(() => {
    const names = new Set(positions.map(p => (p as ExtendedPosition).strategyName || 'Manual'));
    return ['all', ...Array.from(names)];
  }, [positions]);

  // Filtered positions
  const filtered = useMemo(() => {
    if (strategyFilter === 'all') return positions;
    return positions.filter(p => (p.strategyName || 'Manual') === strategyFilter);
  }, [positions, strategyFilter]);

  const columns: Column<ExtendedPosition>[] = [
    {
      key: 'expand',
      label: '',
      className: 'w-8',
      render: (row) => (
        <button
          onClick={e => { e.stopPropagation(); setExpandedSymbol(expandedSymbol === row.symbol ? null : row.symbol); }}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          {expandedSymbol === row.symbol
            ? <ChevronDown className="w-3.5 h-3.5" />
            : <ChevronRight className="w-3.5 h-3.5" />
          }
        </button>
      ),
    },
    {
      key: 'strategyName',
      label: 'Strategy',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {row.strategyName || 'Manual'}
        </span>
      ),
    },
    {
      key: 'symbol',
      label: 'Symbol',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-slate-900 dark:text-white">{row.symbol}</span>
      ),
    },
    {
      key: 'side',
      label: 'Side',
      sortable: true,
      render: (row) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          row.side === 'long'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }`}>
          {row.side.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'entryPrice',
      label: 'Entry',
      sortable: true,
      align: 'right',
      render: (row) => <span>${fmt(row.entryPrice)}</span>,
    },
    {
      key: 'size',
      label: 'Size',
      sortable: true,
      align: 'right',
      render: (row) => <span>${fmt(row.size * row.entryPrice, 0)}</span>,
    },
    {
      key: 'unrealizedPnl',
      label: 'Unrealized P&L',
      sortable: true,
      align: 'right',
      render: (row) => {
        const pnlPct = row.entryPrice > 0 ? ((row.markPrice - row.entryPrice) / row.entryPrice) * 100 * (row.side === 'long' ? 1 : -1) : 0;
        return (
          <div className="text-right">
            <div className={`font-medium ${pnlColor(row.unrealizedPnl)}`}>
              {row.unrealizedPnl >= 0 ? '+' : ''}${fmt(row.unrealizedPnl)}
            </div>
            <div className={`text-xs ${pnlColor(pnlPct)}`}>
              {pnlPct >= 0 ? '+' : ''}{fmt(pnlPct, 1)}%
            </div>
          </div>
        );
      },
    },
    {
      key: 'leverage',
      label: 'Lev',
      sortable: true,
      align: 'right',
      render: (row) => <span className="text-xs">{row.leverage}x</span>,
    },
    {
      key: 'markPrice',
      label: 'Mark',
      sortable: true,
      align: 'right',
      render: (row) => <span className="text-xs text-slate-500 dark:text-slate-400">${fmt(row.markPrice)}</span>,
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Open Positions
          <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">
            ({filtered.length})
          </span>
        </h3>

        {strategies.length > 2 && (
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={strategyFilter}
              onChange={e => setStrategyFilter(e.target.value)}
              className="text-xs bg-transparent border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {strategies.map(s => (
                <option key={s} value={s}>{s === 'all' ? 'All Strategies' : s}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <SortableTable
        columns={columns}
        data={filtered}
        keyField="symbol"
        compact
        emptyMessage="No open positions"
      />

      {/* Expanded row details */}
      {expandedSymbol && (() => {
        const pos = filtered.find(p => p.symbol === expandedSymbol) as ExtendedPosition;
        if (!pos) return null;
        return (
          <div className="px-4 pb-3">
            <div className="bg-slate-50 dark:bg-slate-700/30 rounded-lg p-3 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Detail label="Stop Loss" value={pos.stopLoss ? `$${fmt(pos.stopLoss)}` : 'None'} />
              <Detail label="Take Profit" value={pos.takeProfit ? `$${fmt(pos.takeProfit)}` : 'None'} />
              <Detail label="Liquidation" value={pos.liquidationPrice > 0 ? `$${fmt(pos.liquidationPrice)}` : 'N/A'} />
              <Detail label="Margin" value={`$${fmt(pos.margin)}`} />
              {pos.fundingPaid !== undefined && (
                <Detail label="Funding Paid" value={`${pos.fundingPaid >= 0 ? '+' : ''}$${fmt(pos.fundingPaid)}`} color={pnlColor(-(pos.fundingPaid || 0))} />
              )}
              {pos.age && (
                <Detail label="Age" value={pos.age} />
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Detail({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-slate-400 dark:text-slate-500">{label}</div>
      <div className={`font-medium ${color || 'text-slate-700 dark:text-slate-300'}`}>{value}</div>
    </div>
  );
}
