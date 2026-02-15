'use client';

import { useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Clock, DollarSign, Percent, Activity } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';

interface Metrics {
  totalReturn: number;
  totalReturnPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  expectancy: number;
  totalFees: number;
}

interface EquityPoint {
  time: number;
  equity: number;
}

interface Trade {
  id: number;
  side: string;
  entryTime: number;
  entryPrice: number;
  exitTime?: number;
  exitPrice?: number;
  pnl?: number;
  fees: number;
}

interface BacktestResultData {
  metrics: Metrics;
  equityCurveSampled: EquityPoint[];
  trades: Trade[];
  finalBalance: number;
  durationMs: number;
  candlesProcessed: number;
  params: {
    initialBalance: number;
    symbol: string;
    strategyId: string;
    interval: string;
  };
}

interface Props {
  result: BacktestResultData;
}

// ── Metrics Cards ─────────────────────────────────────────────

function MetricCard({ label, value, suffix, icon: Icon, positive }: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ElementType;
  positive?: boolean | null;
}) {
  const colorClass = positive === true
    ? 'text-emerald-600 dark:text-emerald-400'
    : positive === false
      ? 'text-red-500 dark:text-red-400'
      : 'text-slate-900 dark:text-white';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className={`text-lg font-semibold ${colorClass}`}>
        {value}{suffix}
      </div>
    </div>
  );
}

// ── Equity Curve Chart ────────────────────────────────────────

function EquityCurveChart({ data, initialBalance }: { data: EquityPoint[]; initialBalance: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useThemeStore(s => s.theme);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    let chartInstance: ReturnType<typeof import('lightweight-charts').createChart> | null = null;

    (async () => {
      try {
        const { createChart } = await import('lightweight-charts');
        if (!containerRef.current) return;

        const isDark = theme === 'dark';
        chartInstance = createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height: 250,
          layout: {
            background: { color: isDark ? '#1e293b' : '#ffffff' },
            textColor: isDark ? '#94a3b8' : '#64748b',
          },
          grid: {
            vertLines: { color: isDark ? '#334155' : '#e2e8f0' },
            horzLines: { color: isDark ? '#334155' : '#e2e8f0' },
          },
          rightPriceScale: {
            borderColor: isDark ? '#334155' : '#e2e8f0',
          },
          timeScale: {
            borderColor: isDark ? '#334155' : '#e2e8f0',
            timeVisible: true,
          },
        });

        const lineSeries = chartInstance.addLineSeries({
          color: data[data.length - 1]!.equity >= initialBalance ? '#10b981' : '#ef4444',
          lineWidth: 2,
        });

        const chartData = data.map(p => ({
          time: Math.floor(p.time / 1000) as any,
          value: p.equity,
        }));

        lineSeries.setData(chartData);
        chartInstance.timeScale().fitContent();
      } catch { /* lightweight-charts may not be available during SSR */ }
    })();

    return () => {
      if (chartInstance) chartInstance.remove();
    };
  }, [data, theme, initialBalance]);

  return (
    <div ref={containerRef} className="w-full h-[250px] rounded-lg overflow-hidden" />
  );
}

// ── Trade List ────────────────────────────────────────────────

function TradeList({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No trades executed</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">#</th>
            <th className="text-left py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Side</th>
            <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Entry</th>
            <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Exit</th>
            <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">PnL</th>
            <th className="text-right py-2 px-2 text-slate-500 dark:text-slate-400 font-medium">Fees</th>
          </tr>
        </thead>
        <tbody>
          {trades.slice(0, 100).map(t => {
            const pnlColor = (t.pnl || 0) > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : (t.pnl || 0) < 0
                ? 'text-red-500 dark:text-red-400'
                : 'text-slate-500';
            return (
              <tr key={t.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="py-1.5 px-2 text-slate-600 dark:text-slate-400">{t.id}</td>
                <td className="py-1.5 px-2">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    t.side === 'long' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {t.side.toUpperCase()}
                  </span>
                </td>
                <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300">${t.entryPrice.toFixed(2)}</td>
                <td className="py-1.5 px-2 text-right text-slate-700 dark:text-slate-300">{t.exitPrice ? `$${t.exitPrice.toFixed(2)}` : '—'}</td>
                <td className={`py-1.5 px-2 text-right font-medium ${pnlColor}`}>
                  {t.pnl !== undefined ? `$${t.pnl.toFixed(2)}` : '—'}
                </td>
                <td className="py-1.5 px-2 text-right text-slate-500">${t.fees.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {trades.length > 100 && (
        <p className="text-xs text-slate-400 text-center py-2">
          Showing 100 of {trades.length} trades
        </p>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export function BacktestResults({ result }: Props) {
  const { metrics } = result;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Results — {result.params.strategyId}
          </h3>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {(result.durationMs / 1000).toFixed(1)}s
            </span>
            <span>{result.candlesProcessed.toLocaleString()} candles</span>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Total Return"
            value={`$${metrics.totalReturn.toFixed(2)}`}
            suffix={` (${metrics.totalReturnPct}%)`}
            icon={metrics.totalReturn >= 0 ? TrendingUp : TrendingDown}
            positive={metrics.totalReturn >= 0}
          />
          <MetricCard label="Total Trades" value={metrics.totalTrades} icon={BarChart3} />
          <MetricCard label="Win Rate" value={`${(metrics.winRate * 100).toFixed(1)}%`} icon={Percent} positive={metrics.winRate >= 0.5 ? true : false} />
          <MetricCard label="Sharpe" value={metrics.sharpeRatio.toFixed(2)} icon={Activity} positive={metrics.sharpeRatio >= 1 ? true : metrics.sharpeRatio < 0 ? false : null} />
          <MetricCard label="Max Drawdown" value={`${metrics.maxDrawdownPct.toFixed(1)}%`} icon={TrendingDown} positive={metrics.maxDrawdownPct < 10 ? true : false} />
          <MetricCard label="Profit Factor" value={metrics.profitFactor.toFixed(2)} icon={DollarSign} positive={metrics.profitFactor >= 1.5 ? true : metrics.profitFactor < 1 ? false : null} />
          <MetricCard label="Sortino" value={metrics.sortinoRatio.toFixed(2)} icon={Activity} positive={metrics.sortinoRatio >= 1.5 ? true : null} />
          <MetricCard label="Expectancy" value={`$${metrics.expectancy.toFixed(2)}`} icon={DollarSign} positive={metrics.expectancy > 0} />
          <MetricCard label="Total Fees" value={`$${metrics.totalFees.toFixed(2)}`} icon={DollarSign} />
          <MetricCard label="Final Balance" value={`$${result.finalBalance.toLocaleString()}`} icon={DollarSign} positive={result.finalBalance > result.params.initialBalance} />
        </div>
      </div>

      {/* Equity Curve */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Equity Curve</h4>
        <EquityCurveChart data={result.equityCurveSampled} initialBalance={result.params.initialBalance} />
      </div>

      {/* Trade List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          Trades ({result.trades.length})
        </h4>
        <TradeList trades={result.trades} />
      </div>
    </div>
  );
}
