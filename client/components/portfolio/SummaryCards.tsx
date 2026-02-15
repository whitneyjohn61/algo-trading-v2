'use client';

import { TrendingUp, TrendingDown, BarChart3, Activity, Shield } from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { DrawdownGauge } from '../DrawdownGauge';

/**
 * Step 7.1 — Portfolio Summary Cards
 *
 * Four cards across the top of the portfolio dashboard:
 *  1. Total Equity (live, shows all-time return from seed)
 *  2. Today's P&L (realized + unrealized since midnight UTC)
 *  3. Open Positions (count, long/short breakdown)
 *  4. Portfolio Drawdown (gauge + circuit breaker threshold)
 */

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function pnlColor(n: number): string {
  if (n > 0) return 'text-green-500';
  if (n < 0) return 'text-red-500';
  return 'text-slate-400 dark:text-slate-500';
}

function pnlSign(n: number): string {
  return n > 0 ? '+' : '';
}

export function SummaryCards() {
  const {
    totalEquity,
    unrealizedPnl,
    realizedPnlToday,
    positionCount,
    positions,
    drawdownPct,
    peakEquity,
    circuitBreaker,
  } = usePortfolioStore();

  const todayPnl = realizedPnlToday + unrealizedPnl;
  const todayPnlPct = totalEquity > 0 ? (todayPnl / totalEquity) * 100 : 0;

  const longCount = positions.filter(p => p.side === 'long').length;
  const shortCount = positions.filter(p => p.side === 'short').length;

  const cbThreshold = circuitBreaker?.portfolioThreshold ?? 25;
  const cbTriggered = circuitBreaker?.portfolioTriggered ?? false;

  const returnFromPeak = peakEquity > 0 ? ((totalEquity - peakEquity) / peakEquity) * 100 : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Total Equity */}
      <Card>
        <CardHeader icon={<BarChart3 className="w-4 h-4 text-primary-500" />} label="Total Equity" />
        <div className="mt-1">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            ${fmt(totalEquity)}
          </span>
        </div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Peak: ${fmt(peakEquity)}
          {returnFromPeak !== 0 && (
            <span className={`ml-2 ${pnlColor(returnFromPeak)}`}>
              ({pnlSign(returnFromPeak)}{fmt(returnFromPeak, 1)}%)
            </span>
          )}
        </div>
      </Card>

      {/* Today's P&L */}
      <Card>
        <CardHeader
          icon={todayPnl >= 0
            ? <TrendingUp className="w-4 h-4 text-green-500" />
            : <TrendingDown className="w-4 h-4 text-red-500" />
          }
          label="Today's P&L"
        />
        <div className="mt-1">
          <span className={`text-2xl font-bold ${pnlColor(todayPnl)}`}>
            {pnlSign(todayPnl)}${fmt(Math.abs(todayPnl))}
          </span>
        </div>
        <div className="mt-1 flex gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>Realized: <span className={pnlColor(realizedPnlToday)}>{pnlSign(realizedPnlToday)}${fmt(Math.abs(realizedPnlToday))}</span></span>
          <span>Unrealized: <span className={pnlColor(unrealizedPnl)}>{pnlSign(unrealizedPnl)}${fmt(Math.abs(unrealizedPnl))}</span></span>
        </div>
        {todayPnlPct !== 0 && (
          <div className={`mt-0.5 text-xs ${pnlColor(todayPnlPct)}`}>
            {pnlSign(todayPnlPct)}{fmt(Math.abs(todayPnlPct), 2)}% of equity
          </div>
        )}
      </Card>

      {/* Open Positions */}
      <Card>
        <CardHeader icon={<Activity className="w-4 h-4 text-cyan-500" />} label="Open Positions" />
        <div className="mt-1">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            {positionCount}
          </span>
        </div>
        <div className="mt-1 flex gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" /> {longCount} Long
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> {shortCount} Short
          </span>
        </div>
      </Card>

      {/* Portfolio Drawdown */}
      <Card>
        <CardHeader
          icon={<Shield className={`w-4 h-4 ${cbTriggered ? 'text-red-500' : 'text-amber-500'}`} />}
          label="Drawdown"
          badge={cbTriggered ? (
            <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium animate-pulse">
              HALTED
            </span>
          ) : undefined}
        />
        <div className="mt-1 flex items-center gap-3">
          <DrawdownGauge drawdownPct={drawdownPct} threshold={cbThreshold} size="sm" showLabel={false} />
          <div>
            <div className={`text-lg font-bold ${drawdownPct >= 20 ? 'text-red-500' : drawdownPct >= 10 ? 'text-amber-500' : 'text-green-500'}`}>
              {fmt(drawdownPct, 1)}%
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Threshold: {cbThreshold}%
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** Shared card shell */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
      {children}
    </div>
  );
}

function CardHeader({ icon, label, badge }: { icon: React.ReactNode; label: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      {badge}
    </div>
  );
}
