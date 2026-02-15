'use client';

import { usePortfolioStore, StrategyAllocation } from '@/store/portfolioStore';
import { SparklineChart } from '../SparklineChart';

/**
 * Step 7.3 — Strategy Allocation Panel
 *
 * Horizontal bars per strategy showing:
 *  - Name, allocation %, dollar amount, cumulative P&L, Sharpe ratio
 *  - Color-coded: green = profitable, red = in drawdown
 *  - Click → navigates to Strategies tab filtered to that strategy
 */

interface StrategyAllocationPanelProps {
  onStrategyClick?: (strategyId: string) => void;
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function pnlColor(n: number): string {
  if (n > 0) return 'text-green-500';
  if (n < 0) return 'text-red-500';
  return 'text-slate-400 dark:text-slate-500';
}

function barColor(isActive: boolean, pnl: number): string {
  if (!isActive) return 'bg-slate-300 dark:bg-slate-600';
  if (pnl > 0) return 'bg-green-500';
  if (pnl < 0) return 'bg-red-500';
  return 'bg-primary-500';
}

const STRATEGY_COLORS: Record<string, string> = {
  trend_following: '#3b82f6',
  mean_reversion: '#8b5cf6',
  funding_carry: '#f59e0b',
  cross_momentum: '#06b6d4',
};

export function StrategyAllocationPanel({ onStrategyClick }: StrategyAllocationPanelProps) {
  const allocations = usePortfolioStore(s => s.strategyAllocations);
  const totalEquity = usePortfolioStore(s => s.totalEquity);

  if (allocations.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Strategy Allocations</h3>
        <div className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">
          No strategy allocations configured yet.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Strategy Allocations</h3>

      <div className="space-y-3">
        {allocations.map(a => (
          <AllocationRow
            key={a.strategyId}
            allocation={a}
            totalEquity={totalEquity}
            onClick={onStrategyClick ? () => onStrategyClick(a.strategyId) : undefined}
          />
        ))}
      </div>

      {/* Total bar */}
      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium">Total Allocated</span>
          <span>{fmt(allocations.reduce((sum, a) => sum + a.currentPct, 0), 1)}%</span>
        </div>
        <div className="mt-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
          {allocations.map(a => (
            <div
              key={a.strategyId}
              className="h-full transition-all duration-300"
              style={{
                width: `${a.currentPct}%`,
                backgroundColor: STRATEGY_COLORS[a.strategyId] || '#64748b',
                opacity: a.isActive ? 1 : 0.4,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AllocationRow({
  allocation: a,
  totalEquity,
  onClick,
}: {
  allocation: StrategyAllocation;
  totalEquity: number;
  onClick?: () => void;
}) {
  return (
    <div
      className={`group ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Top row: name + metrics */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: STRATEGY_COLORS[a.strategyId] || '#64748b', opacity: a.isActive ? 1 : 0.4 }}
          />
          <span className={`text-sm font-medium ${a.isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'} group-hover:text-primary-500 transition-colors`}>
            {a.strategyName}
          </span>
          {!a.isActive && (
            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded-full">
              paused
            </span>
          )}
          <span className="text-xs text-slate-400 dark:text-slate-500">{a.category}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {a.positionCount} pos
          </span>
          <span className={pnlColor(a.unrealizedPnl)}>
            {a.unrealizedPnl >= 0 ? '+' : ''}${fmt(a.unrealizedPnl)}
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor(a.isActive, a.unrealizedPnl)}`}
            style={{ width: `${Math.min(a.currentPct, 100)}%` }}
          />
        </div>
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-16 text-right">
          {fmt(a.currentPct, 1)}% · ${fmt(a.currentEquity, 0)}
        </span>
      </div>
    </div>
  );
}
