'use client';

import { useState } from 'react';
import { Play, Pause, Settings, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { StrategyInfo, StrategyPerformance } from '@/store/strategyStore';
import { SparklineChart } from '../SparklineChart';
import { StatusBadge } from '../StatusBadge';
import api from '@/lib/api';
import toast from 'react-hot-toast';

/**
 * Step 8.1 — Strategy Card
 *
 * Displays a single strategy's status, metrics, sparkline, positions, and signals.
 * Actions: Pause/Resume, Config.
 */

interface StrategyCardProps {
  strategy: StrategyInfo;
  performance?: StrategyPerformance;
  equityPoints?: number[];
  onConfigClick?: (strategyId: string) => void;
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function pnlColor(n: number): string {
  if (n > 0) return 'text-green-500';
  if (n < 0) return 'text-red-500';
  return 'text-slate-400 dark:text-slate-500';
}

const CATEGORY_COLORS: Record<string, string> = {
  trend_following: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  mean_reversion: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  carry: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  momentum: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
};

const STATUS_MAP: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; label: string }> = {
  running: { variant: 'success', label: 'Running' },
  idle: { variant: 'neutral', label: 'Idle' },
  paused: { variant: 'warning', label: 'Paused' },
  warming_up: { variant: 'info', label: 'Warming Up' },
  error: { variant: 'danger', label: 'Error' },
};

export function StrategyCard({ strategy, performance, equityPoints, onConfigClick }: StrategyCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);

  const s = strategy;
  const state = s.state;
  const status = STATUS_MAP[state.status] || STATUS_MAP.idle;

  async function handleTogglePause() {
    setToggling(true);
    try {
      if (s.paused) {
        await api.strategies.resume(s.id);
        toast.success(`Resumed ${s.name}`);
      } else {
        await api.strategies.pause(s.id);
        toast.success(`Paused ${s.name}`);
      }
    } catch {
      toast.error(`Failed to ${s.paused ? 'resume' : 'pause'} ${s.name}`);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{s.name}</h3>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[s.category] || 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
              {s.category.replace('_', ' ')}
            </span>
            <StatusBadge label={status.label} variant={status.variant} pulse={state.status === 'running'} />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleTogglePause}
              disabled={toggling}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                s.paused
                  ? 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                  : 'border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
              }`}
              title={s.paused ? 'Resume strategy' : 'Pause strategy'}
            >
              {s.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
            {onConfigClick && (
              <button
                onClick={() => onConfigClick(s.id)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                title="Strategy settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-4 text-xs">
          <Metric label="Alloc" value={`${fmt(s.capitalAllocationPercent, 0)}%`} />
          <Metric label="Lev" value={`${s.maxLeverage}x`} />
          <Metric label="Symbols" value={String(s.symbols.length)} />
          <Metric label="P&L" value={`${state.metrics.totalPnl >= 0 ? '+' : ''}$${fmt(state.metrics.totalPnl)}`} color={pnlColor(state.metrics.totalPnl)} />
          {performance && (
            <>
              <Metric label="DD" value={`${fmt(performance.maxDrawdown, 1)}%`} color={performance.maxDrawdown > 10 ? 'text-red-500' : undefined} />
              <Metric label="Sharpe" value={performance.sharpeRatio !== null ? fmt(performance.sharpeRatio, 2) : '—'} />
              <Metric label="WR" value={`${fmt(performance.winRate * 100, 0)}%`} />
            </>
          )}
        </div>

        {/* Sparkline + quick stats */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            {equityPoints && equityPoints.length > 2 && (
              <SparklineChart data={equityPoints} width={100} height={28} />
            )}
            <div className="flex gap-3 text-xs text-slate-400 dark:text-slate-500">
              <span>Signals: {state.metrics.signalsEmitted}</span>
              <span>Trades: {state.metrics.tradesOpened}/{state.metrics.tradesClosed}</span>
            </div>
          </div>
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-0.5"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Less' : 'More'}
          </button>
        </div>
      </div>

      {/* Expanded section: positions + signal log */}
      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 pt-3 space-y-3">
          {/* Active positions */}
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Active Positions</div>
            {state.activePositions.length === 0 ? (
              <div className="text-xs text-slate-400 dark:text-slate-500">No active positions</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {state.activePositions.map(sym => (
                  <span key={sym} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium">
                    {sym}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Symbols universe */}
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Symbol Universe ({s.symbols.length})</div>
            <div className="flex flex-wrap gap-1">
              {s.symbols.map(sym => (
                <span key={sym} className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/50 px-1.5 py-0.5 rounded">
                  {sym}
                </span>
              ))}
            </div>
          </div>

          {/* Timeframes */}
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Timeframes</div>
            <div className="flex gap-1.5">
              {s.timeframes.map(tf => (
                <span key={tf} className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                  {tf}
                </span>
              ))}
            </div>
          </div>

          {/* Error state */}
          {state.status === 'error' && (
            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Error state — check server logs</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <span className="text-slate-400 dark:text-slate-500">{label}: </span>
      <span className={`font-medium ${color || 'text-slate-700 dark:text-slate-300'}`}>{value}</span>
    </div>
  );
}
